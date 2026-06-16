from fastapi import APIRouter
from pydantic import BaseModel
import re
import json
from transformers import pipeline

router = APIRouter()

emotion_classifier = None

def load_anchors():
    global emotion_classifier
    emotion_classifier = pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=1
    )
    print("[감정 분류 모델 로드 완료] j-hartmann/emotion-english-distilroberta-base")

def classify_emotion(line: str, context: str = "") -> tuple[str, float]:
    text = f"{context} [SEP] {line}" if context else line
    result = emotion_classifier(text)[0][0]
    
    raw_label = result["label"].lower()   # joy / sadness / anger 등
    confidence = round(result["score"], 3)
    
    # 모델 출력 레이블 → 딕셔너리 키 매핑
    LABEL_MAP = {
        "joy":      "joy",
        "surprise": "surprise",
        "neutral":  "neutral",
        "sadness":  "sadness",
        "anger":    "anger",
        "fear":     "sadness",    # fear → sadness 패턴 사용
        "disgust":  "anger",      # disgust → anger 패턴 사용
    }
    
    mapped = LABEL_MAP.get(raw_label, "neutral")
    return mapped, confidence

def classify_with_context(dialogues, idx, window=3):
    start = max(0, idx - window)
    
    # 장면 전환 감지 — 문맥 초기화
    # 같은 장면 내 대사만 문맥으로 사용
    context_lines = []
    for d in dialogues[start:idx]:
        if d.get("scene_break"):   # 장면 전환 플래그
            context_lines = []     # 초기화
        else:
            context_lines.append(f"{d['character']}: {d['line']}")
    
    context = " [SEP] ".join(context_lines)
    return classify_emotion(dialogues[idx]["line"], context)

# ── 파싱 로직 ──
SKIP     = re.compile(r'^(?:INT|EXT|FADE|CUT|DISSOLVE|ACT|SCENE)\b', re.IGNORECASE)
CPAT     = re.compile(r'^[ \t]*([A-Z][A-Z\s\'\-.]{0,39}?)(?:\s*\([^)]{1,40}\))?\s*$')
VALU     = re.compile(r'^[A-Z][A-Z\s\'\-.]+$')
ICOL     = re.compile(r'^([A-Z][A-Z\s\'\-.]{0,38}?)(?:\s*\([^)]{0,60}\))?\s*:\s*(.+)')
SDIR     = re.compile(r'\(([^)]{1,80})\)')

EMOTION_PATTERNS = {
    "anger":      {"tilt":(90,90),  "roll":(60,120), "pan":(90,90),  "mode":"repeat", "speed":0.3},
    "joy":        {"tilt":(90,90),  "roll":(90,90),  "pan":(70,110), "mode":"repeat", "speed":0.3},
    "surprise":   {"tilt":(60,60),  "roll":(120,120),"pan":(90,90),  "mode":"hold",   "speed":0.4},
    "sadness":    {"tilt":(90,90),  "roll":(90,90),  "pan":(60,60),  "mode":"hold",   "speed":0.6},
    "excitement": {"tilt":(60,120), "roll":(90,90),  "pan":(90,90),  "mode":"repeat", "speed":0.25},
    "shame":      {"tilt":(60,60),  "roll":(60,60),  "pan":(60,60),  "mode":"hold",   "speed":0.5},
    "neutral":    {"tilt":(90,90),  "roll":(90,90),  "pan":(88,92),  "mode":"repeat", "speed":0.04},
}

def is_char(line: str) -> str | None:
    s = line.strip()
    if not s or SKIP.match(s): return None
    m = CPAT.match(line)
    if not m: return None
    name = m.group(1).strip()
    return name if VALU.match(name) else None

def x_stage(text: str) -> tuple[str, str | None]:
    dirs = []
    clean = SDIR.sub(lambda m: (dirs.append(m.group(1)), '')[1], text).strip()
    return clean, '; '.join(dirs) if dirs else None

def parse_screenplay(text: str) -> list[dict]:
    lines = text.splitlines()
    res = []
    i = 0
    scene_break_next = False   # ← 추가
    
    while i < len(lines):
        line = lines[i]
        
        # 씬 헤더 감지 (INT. / EXT. 로 시작하는 줄)
        if re.match(r'^\s*(?:INT|EXT)[\.\s]', line, re.IGNORECASE):
            scene_break_next = True   # ← 다음 대사에 scene_break 플래그
            i += 1
            continue
        
        ch = is_char(line)
        if ch:
            dl = []; i += 1
            while i < len(lines):
                cur = lines[i]
                if not cur.strip(): i += 1; break
                if is_char(cur): break
                dl.append(cur.strip()); i += 1
            raw = ' '.join(dl).strip()
            if not raw: continue
            cl, st = x_stage(raw)
            if not cl: continue
            e = {"character": ch, "line": cl, "scene_break": scene_break_next}
            scene_break_next = False   # ← 플래그 사용 후 초기화
            if st: e["stage_dir"] = st
            res.append(e)
        else:
            i += 1
    return res

def parse_inline(text: str) -> list[dict]:
    res = []
    for line in text.splitlines():
        m = ICOL.match(line)
        if not m: continue
        name = m.group(1).strip()
        if not VALU.match(name): continue
        cl, st = x_stage(m.group(2).strip())
        if not cl: continue
        e = {"character": name, "line": cl}
        if st: e["stage_dir"] = st
        res.append(e)
    return res

def detect_fmt(text: str) -> str:
    lines = text.splitlines()
    total = max(len(lines), 1)
    cnt_a = sum(1 for l in lines if is_char(l))
    cnt_b = sum(1 for l in lines if ICOL.match(l))
    if cnt_a / total > 0.03 and cnt_b / total < 0.01: return "screenplay"
    if cnt_b / total > 0.03 and cnt_a / total < 0.01: return "inline_colon"
    return "screenplay" if cnt_a >= cnt_b else "inline_colon"

# ── 요청/응답 스키마 ──
class ParseRequest(BaseModel):
    text:   str
    format: str = "auto"

class DialogueLine(BaseModel):
    index:          int
    character:      str
    line:           str
    stage_dir:      str | None = None
    emotion:        str
    confidence:     float
    motion_pattern: dict

class ParseResponse(BaseModel):
    format_detected: str
    total_lines:     int
    characters:      list[str]
    dialogue:        list[DialogueLine]

# ── 엔드포인트 ──
@router.post("/api/parse", response_model=ParseResponse)
async def parse_script(req: ParseRequest):
    fmt = req.format if req.format != "auto" else detect_fmt(req.text)
    raw = parse_screenplay(req.text) if fmt == "screenplay" else parse_inline(req.text)

    dialogue = []
    seen, characters = set(), []

    for idx, entry in enumerate(raw):
        emotion, confidence = classify_with_context(raw, idx)
        if entry["character"] not in seen:
            seen.add(entry["character"])
            characters.append(entry["character"])
        dialogue.append(DialogueLine(
            index          = idx + 1,
            character      = entry["character"],
            line           = entry["line"],
            stage_dir      = entry.get("stage_dir"),
            emotion        = emotion,
            confidence     = confidence,
            motion_pattern = EMOTION_PATTERNS[emotion],
        ))

    return ParseResponse(
        format_detected = fmt,
        total_lines     = len(dialogue),
        characters      = characters,
        dialogue        = dialogue,
    )