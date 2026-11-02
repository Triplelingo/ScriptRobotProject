import os
import json
import base64
import requests
import io
import uuid
import shutil
import wave   # TTS 음성 길이 계산용
import asyncio

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from transformers import pipeline   # 업로드 대본 감정 자동 분류용

import azure.cognitiveservices.speech as speechsdk
from pydub import AudioSegment
from sqlalchemy import text

# Import the existing SQLAlchemy connection engine asset
from database import engine

# Load system environment keys from backend/.env file
load_dotenv()

# Ensure recording storage directory exists to avoid mount crash
os.makedirs("recordings", exist_ok=True)

app = FastAPI()

# ====================================================================
# 0. SCRIPT PARSING & EMOTION CLASSIFICATION HELPERS
# ====================================================================
def parse_script_content(content: str):
    """
    '캐릭터: 대사' 형식의 대본 텍스트를 줄 단위로 파싱.
    반환: [{"line_order", "character_name", "dialogue"}, ...]
    """
    parsed_lines = []

    # 줄바꿈 통일 (Windows CRLF / 구형 Mac CR 대응)
    raw_lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    line_order = 1

    for raw_line in raw_lines:
        line = raw_line.strip()
        if not line or ":" not in line:      # 빈 줄·지문(콜론 없음)은 건너뜀
            continue

        character_name, dialogue = line.split(":", 1)   # 대사 안의 콜론은 보존
        character_name = character_name.strip()
        dialogue = dialogue.strip()

        if not character_name or not dialogue:
            continue

        parsed_lines.append({
            "line_order": line_order,
            "character_name": character_name,
            "dialogue": dialogue
        })
        line_order += 1

    return parsed_lines


emotion_classifier = None   # 첫 호출 시 1회만 로드 (서버 기동 시간 단축)


def _get_emotion_classifier():
    """RoBERTa 감정 분류 모델 지연 로딩"""
    global emotion_classifier
    if emotion_classifier is None:
        print("[AI] 감정 분석 모델 로딩 중...")
        emotion_classifier = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            device=-1                        # CPU 추론
        )
        print("[AI] 감정 분석 모델 로딩 완료!")
    return emotion_classifier


def classify_script_lines(parsed_lines, window: int = 3):
    """
    대사 목록 전체를 문맥(앞 window줄) 포함해 감정 분류.
    parse_router.classify_with_context와 같은 방식이지만,
    웹 화면·DB에서 7개 감정을 그대로 쓰므로 fear/disgust를 다른 감정으로 합치지 않음.
    동기 함수 → 호출부에서 asyncio.to_thread로 실행해 이벤트 루프(WebSocket ping) 차단 방지.
    """
    classifier = _get_emotion_classifier()
    emotions = []
    for idx, line in enumerate(parsed_lines):
        # 앞 window줄을 '인물: 대사' 형태로 묶어 문맥으로 사용
        context = " [SEP] ".join(
            f"{p['character_name']}: {p['dialogue']}"
            for p in parsed_lines[max(0, idx - window):idx]
        )
        text_in = f"{context} [SEP] {line['dialogue']}" if context else line["dialogue"]
        result = classifier(text_in, truncation=True)[0]   # 512토큰 초과 시 잘라서 처리
        emotions.append(result["label"].lower())
    return emotions



#ws_router.py import
from ws_router import router as ws_router, send_to_robot
app.include_router(ws_router)

# Mount recordings directory for static user voice playback
app.mount("/recordings", StaticFiles(directory="recordings"), name="recordings")

# Enable CORS so your React frontend (Vite/localhost:5173) can securely call port 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====================================================================
# LINKING DB AND SETTINGS PAGE (USER PROFILE UPDATE)
# ====================================================================
class UpdateProfileRequest(BaseModel):
    user_id: int
    name: str
    nickname: str


@app.put("/api/users/profile")
async def update_user_profile(req: UpdateProfileRequest):
    try:
        with engine.begin() as conn:
            user = conn.execute(
                text("SELECT user_id FROM users WHERE user_id = :user_id"),
                {"user_id": req.user_id}
            ).fetchone()

            if not user:
                raise HTTPException(status_code=404, detail="User not found.")

            existing_nickname = conn.execute(
                text("SELECT user_id FROM users WHERE nickname = :nickname AND user_id != :user_id"),
                {"nickname": req.nickname, "user_id": req.user_id}
            ).fetchone()

            if existing_nickname:
                raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")

            conn.execute(
                text("""
                    UPDATE users
                    SET name = :name,
                        nickname = :nickname
                    WHERE user_id = :user_id
                """),
                {
                    "name": req.name,
                    "nickname": req.nickname,
                    "user_id": req.user_id
                }
            )

        return {
            "status": "success",
            "message": "프로필이 성공적으로 업데이트되었습니다.",
            "user": {
                "user_id": req.user_id,
                "name": req.name,
                "nickname": req.nickname
            }
        }

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        print(f"[Profile Update Error]: {e}")
        raise HTTPException(status_code=500, detail="Database update failed.")


# ====================================================================
# 1. LOCAL ADMINISTRATIVE SYSTEM LOGISTICS OLLAMA PIPELINE (FAST)
# ====================================================================
def get_feedback_from_ollama(expected, user_text):
    prompt = f"""
Expected Script Line: "{expected}"
User Utterance Captured: "{user_text}"

Analyze the phrase briefly. State any missed words or pronunciation anomalies in 1 concise sentence.
"""
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "mistral",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": 45,
                    "temperature": 0.3
                }
            },
            timeout=8
        )
        return response.json().get("response", "").strip()
    except Exception as e:
        print(f"Ollama Connection Error: {e}")
        return "Review difficult consonant transitions and maintain smooth sentence flow."

# ====================================================================
# 2. HOMEPAGE & USER MANAGEMENT ENDPOINTS
# ====================================================================
@app.get("/")
def home():
    return {"message": "Server Running"}


@app.get("/users")
def get_users():
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT user_id, name, nickname, email, status, created_at
            FROM users
        """))

        users = []
        for row in result:
            users.append({
                "user_id": row.user_id,
                "name": row.name,
                "nickname": row.nickname,
                "email": row.email,
                "status": row.status,
                "created_at": str(row.created_at)
            })
        return users


@app.patch("/users/{user_id}/status")
def update_status(user_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE users SET status = :status WHERE user_id = :user_id"),
            {"status": data["status"], "user_id": user_id}
        )
        conn.commit()
    return {"message": "success"}


@app.patch("/users/{user_id}")
def update_user(user_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE users
                SET name = :name,
                    nickname = :nickname,
                    email = :email
                WHERE user_id = :user_id
            """),
            {
                "name": data["name"],
                "nickname": data["nickname"],
                "email": data["email"],
                "user_id": user_id
            }
        )
        conn.commit()
    return {"message": "success"}


@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM users WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        conn.commit()
    return {"message": "success"}


# ====================================================================
# 3. AUTHENTICATION INFRASTRUCTURE (LOGIN & REGISTRATION)
# ====================================================================
@app.post("/register")
def register_user(data: dict = Body(...)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT email FROM users WHERE email = :email"),
            {"email": data["email"]}
        ).fetchone()

        if result:
            return {"success": False, "message": "이미 가입된 이메일입니다."}

        conn.execute(
            text("""
                INSERT INTO users (name, nickname, email, password, login_type, status)
                VALUES (:name, :nickname, :email, :password, 'LOCAL', 'ACTIVE')
            """),
            {
                "name": data["name"],
                "nickname": data["nickname"],
                "email": data["email"],
                "password": data["password"]
            }
        )
        conn.commit()
    return {"success": True, "message": "회원가입 성공"}


@app.post("/login")
def login_user(data: dict = Body(...)):
    with engine.connect() as conn:
        user = conn.execute(
            text("""
                SELECT user_id, name, nickname, email, password, login_type, status
                FROM users
                WHERE email = :email
            """),
            {"email": data["email"]}
        ).fetchone()

        if not user:
            return {"success": False, "message": "존재하지 않는 이메일입니다."}

        if user.password != data["password"]:
            return {"success": False, "message": "비밀번호가 일치하지 않습니다."}

        if user.status == "BLOCKED":
            return {"success": False, "message": "차단된 계정입니다."}

        return {
            "success": True,
            "message": "로그인 성공",
            "user": {
                "user_id": user.user_id,
                "name": user.name,
                "nickname": user.nickname,
                "email": user.email,
                "login_type": user.login_type,
                "status": user.status
            }
        }


# ====================================================================
# 4. CUSTOM SCENARIO PARSING & SELECTION DATA-LOGS
# ====================================================================
@app.delete("/scripts/{script_id}")

@app.post("/scripts/upload")
async def upload_script(
    user_id: int = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    level: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        filename = file.filename or ""
        if "." not in filename:
            raise HTTPException(status_code=400, detail="파일 확장자를 확인할 수 없습니다.")

        extension = filename.rsplit(".", 1)[1].lower()
        if extension not in ["txt"]:
            raise HTTPException(status_code=400, detail="현재는 TXT 파일만 업로드할 수 있습니다.")

        file_bytes = await file.read()
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content = file_bytes.decode("cp949")
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="TXT 파일의 문자 인코딩을 읽을 수 없습니다.")

        content = content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="대본 파일이 비어 있습니다.")

        parsed_lines = parse_script_content(content)
        if not parsed_lines:
            raise HTTPException(status_code=400, detail="'인물: 대사' 형식의 대사를 찾을 수 없습니다.")

        # 감정 분류는 수 초 걸리므로 별도 스레드에서 실행 → 그동안 로봇 WebSocket·다른 요청 정상 처리
        emotions = await asyncio.to_thread(classify_script_lines, parsed_lines)

        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO scripts (user_id, title, content, category, level)
                    VALUES (:user_id, :title, :content, :category, :level)
                """),
                {
                    "user_id": user_id,
                    "title": title,
                    "content": content,
                    "category": category,
                    "level": level
                }
            )
            script_id = result.lastrowid

            for line, emotion in zip(parsed_lines, emotions):   # 대사와 분류 결과를 짝지어 저장
                conn.execute(
                    text("""
                        INSERT INTO script_lines (
                            script_id, line_order, character_name, dialogue, emotion
                        )
                        VALUES (
                            :script_id, :line_order, :character_name, :dialogue, :emotion
                        )
                    """),
                    {
                        "script_id": script_id,
                        "line_order": line["line_order"],
                        "character_name": line["character_name"],
                        "dialogue": line["dialogue"],
                        "emotion": emotion
                    }
                )

        raw_lines = [
            line.strip()
            for line in content.replace("\r", "").split("\n")
            if line.strip()
        ]
        dialog_lines = [line for line in raw_lines if ":" in line]
        characters = set()

        for line in dialog_lines:
            character = line.split(":", 1)[0].strip()
            if character:
                characters.add(character)

        return {
            "success": True,
            "message": "대본 업로드 성공",
            "script": {
                "script_id": script_id,
                "title": title,
                "category": category,
                "level": level,
                "filename": filename,
                "character_count": len(characters),
                "characters": list(characters),
                "line_count": len(dialog_lines)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Script Upload Error] {e}")
        raise HTTPException(status_code=500, detail=f"대본 업로드 실패: {str(e)}")


@app.post("/scripts")
def create_script(data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO scripts (user_id, title, content)
                VALUES (:user_id, :title, :content)
            """),
            {
                "user_id": data.get("user_id"),
                "title": data["title"],
                "content": data["content"]
            }
        )
        conn.commit()
    return {"success": True, "message": "대본 저장 성공"}


@app.get("/scripts")
def get_scripts():
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT script_id, user_id, title, content, created_at FROM scripts ORDER BY script_id DESC")
        )
        scripts = []
        for row in result:
            scripts.append({
                "script_id": row.script_id,
                "user_id": row.user_id,
                "title": row.title,
                "content": row.content,
                "created_at": str(row.created_at)
            })
        return scripts


@app.get("/api/scripts")
async def get_all_scripts_api():
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT script_id, user_id, title, content, status, created_at FROM scripts ORDER BY script_id DESC")
        )
        scripts = []
        for row in result:
            scripts.append({
                "script_id": row.script_id,
                "user_id": row.user_id,
                "title": row.title,
                "content": row.content,
                "status": getattr(row, 'status', 'ACTIVE'),
                "created_at": str(row.created_at)
            })
        return scripts


@app.get("/api/scripts/{script_id}")
async def get_parsed_script(script_id: int):
    # 1) 대본 원문 + 저장된 대사 조회
    with engine.connect() as conn:
        script = conn.execute(
            text("""
                SELECT script_id, title, content, created_at
                FROM scripts
                WHERE script_id = :script_id
            """),
            {"script_id": script_id}
        ).mappings().first()

        if not script:
            raise HTTPException(status_code=404, detail="대본이 없습니다.")

        db_lines = conn.execute(
            text("""
                SELECT line_id, line_order, character_name, dialogue, emotion
                FROM script_lines
                WHERE script_id = :script_id
                ORDER BY line_order ASC
            """),
            {"script_id": script_id}
        ).mappings().all()

    # 2) script_lines가 비어 있으면(업로드 API 이전에 넣은 대본) 원문을 파싱·감정 분류해 저장
    if not db_lines and script["content"]:
        print(f"[Auto-Parse] script {script_id}: script_lines 없음 → content 파싱")
        raw_parsed = parse_script_content(script["content"])
        emotions = await asyncio.to_thread(classify_script_lines, raw_parsed)   # 이벤트 루프 차단 방지

        with engine.begin() as save_conn:       # 정상 종료 시 자동 commit
            for line, emotion in zip(raw_parsed, emotions):
                save_conn.execute(
                    text("""
                        INSERT INTO script_lines (script_id, line_order, character_name, dialogue, emotion)
                        VALUES (:script_id, :line_order, :character_name, :dialogue, :emotion)
                    """),
                    {
                        "script_id": script_id,
                        "line_order": line["line_order"],
                        "character_name": line["character_name"],
                        "dialogue": line["dialogue"],
                        "emotion": emotion
                    }
                )

        # 새 연결로 재조회 — 기존 연결은 REPEATABLE READ 스냅샷 때문에 방금 넣은 행이 안 보일 수 있음
        with engine.connect() as conn:
            db_lines = conn.execute(
                text("""
                    SELECT line_id, line_order, character_name, dialogue, emotion
                    FROM script_lines
                    WHERE script_id = :script_id
                    ORDER BY line_order ASC
                """),
                {"script_id": script_id}
            ).mappings().all()

    robot_characters = [
        "Alex", "Romeo", "Jack", "Miranda", "Interviewer",
        "Examiner", "Jake", "Staff", "Friend"
    ]

    # 3) 프론트 형식으로 변환 (id: 화면 순번, line_id: DB PK → 감정 수정 PATCH에 사용)
    parsed_lines = []
    for index, line in enumerate(db_lines):
        character = line["character_name"]
        parsed_lines.append({
            "id": index + 1,
            "line_id": line["line_id"],
            "character": character,
            "text": line["dialogue"],
            "scores": None,
            "emotion": line["emotion"] or "neutral",
            "avatar": "🤖" if character in robot_characters else "나"
        })

    return {
        "title": script["title"],
        "lines": parsed_lines
    }

@app.patch("/api/scripts/{script_id}/lines/{line_id}/emotion")
async def update_script_line_emotion(
    script_id: int,
    line_id: int,
    payload: dict
):
    emotion = payload.get("emotion")
    allowed_emotions = {
        "anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"
    }

    if emotion not in allowed_emotions:
        raise HTTPException(status_code=400, detail="올바르지 않은 감정입니다.")

    with engine.begin() as conn:
        result = conn.execute(
            text("""
                UPDATE script_lines
                SET emotion = :emotion
                WHERE script_id = :script_id
                  AND line_id = :line_id
            """),
            {
                "emotion": emotion,
                "script_id": script_id,
                "line_id": line_id
            }
        )

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="해당 대사를 찾을 수 없습니다.")

    return {
        "success": True,
        "script_id": script_id,
        "line_id": line_id,
        "emotion": emotion
    }

# ====================================================================
# 5. NATURAL EMOTIONAL TEXT-TO-SPEECH (BROWSER BINARY AUDIO RETURN)
# ====================================================================
@app.post("/api/speak")
async def robot_speak(
    text: str = Form(...),
    emotion: str = Form("neutral"),
    character: str = Form("Alex"),
    speed: float = Form(1.0)
):
    try:
        speech_key = os.getenv("AZURE_SPEECH_KEY")
        speech_region = os.getenv("AZURE_SPEECH_REGION")

        if not speech_key or not speech_region:
            print("[TTS Error] Azure Speech Key or Region missing.")
            return Response(content=b"", status_code=500)

        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            region=speech_region
        )
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
        )

        male_characters = ["Alex", "Romeo", "Jack", "Interviewer", "Examiner", "Jake"]
        voice_name = "en-US-DavisNeural" if character in male_characters else "en-US-JennyNeural"

        emo = (emotion or "neutral").lower()
        if emo == "joy":
            style = "cheerful"
        elif emo == "sadness":
            style = "sad"
        elif emo == "anger":
            style = "angry"
        elif emo == "fear":
            style = "whispering"
        elif emo == "disgust":
            style = "unfriendly"
        elif emo == "surprise":
            style = "excited"
        else:
            style = "default"

        rate_pct = int(round((speed - 1.0) * 100))
        rate_str = f"{'+' if rate_pct >= 0 else ''}{rate_pct}%"

        safe_text = (
            text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
        )

        if style != "default":
            express_open = f"<mstts:express-as style='{style}' styledegree='1.0'>"
            express_close = "</mstts:express-as>"
        else:
            express_open = ""
            express_close = ""

        ssml_string = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
    <voice name='{voice_name}'>
        {express_open}
            <prosody rate='{rate_str}'>
                {safe_text}
            </prosody>
        {express_close}
    </voice>
</speak>"""

        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        result = synthesizer.speak_ssml_async(ssml_string).get()
        del synthesizer

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return Response(content=result.audio_data, media_type="audio/wav")
        else:
            if result.reason == speechsdk.ResultReason.Canceled:
                cancellation = result.cancellation_details
                print(f"[TTS CANCELED] Reason: {cancellation.reason} | Details: {cancellation.error_details}")
            return Response(content=b"", status_code=500)

    except Exception as err:
        print(f"[TTS Server Exception] {err}")
        return Response(content=b"", status_code=500)


# ====================================================================
# 6. AUDIO TRANSCODING & PRONUNCIATION COGNITIVE CORE (RAM STREAMING)
# ====================================================================
@app.post("/api/evaluate")
async def evaluate_audio(
    reference_text: str = Form(...), 
    file: UploadFile = File(...)
):
    try:
        audio_bytes = await file.read()

        # ⚡ 1. In-Memory Transcoding (Bypasses slow disk writes)
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        
        wav_io = io.BytesIO()
        audio.export(wav_io, format="wav")
        wav_bytes = wav_io.getvalue()

        # ⚡ 2. Direct PushAudioInputStream to Azure
        push_stream = speechsdk.audio.PushAudioInputStream()
        push_stream.write(wav_bytes)
        push_stream.close()

        speech_config = speechsdk.SpeechConfig(
            subscription=os.getenv("AZURE_SPEECH_KEY"),
            region=os.getenv("AZURE_SPEECH_REGION")
        )
        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

        # ⚡ 3. Granularity.Word evaluates significantly faster than Phoneme
        pron_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Word
        )

        recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        pron_config.apply_to(recognizer)
        result = recognizer.recognize_once()

        del recognizer

        # Save audio file to recordings/ folder for playback
        audio_unique_name = f"{uuid.uuid4()}.wav"
        audio_filepath = os.path.join("recordings", audio_unique_name)
        with open(audio_filepath, "wb") as f:
            f.write(wav_bytes)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            pron_result = speechsdk.PronunciationAssessmentResult(result)

            # 🌟 Conditional triggering: Skip slow Ollama LLM if fluent
            is_fluent = (pron_result.pronunciation_score >= 80 and pron_result.fluency_score >= 80)
            if is_fluent:
                feedback = "Great pronunciation and natural pacing! Keep up the momentum."
            else:
                feedback = get_feedback_from_ollama(reference_text, result.text)

            word_details = []
            for word in pron_result.words:
                word_details.append({
                    "word": word.word,
                    "accuracy": word.accuracy_score,
                    "error_type": word.error_type if word.error_type else "None"
                })

            return {
                "status": "success",
                "audio_url": f"http://localhost:8000/recordings/{audio_unique_name}",
                "user_text": result.text,
                "accuracy": pron_result.accuracy_score,
                "fluency": pron_result.fluency_score,
                "completeness": pron_result.completeness_score,
                "pronunciation": pron_result.pronunciation_score,
                "words": word_details,
                "feedback": feedback
            }

        return {
            "status": "error", 
            "message": f"Speech not recognized or matched. Status code: {result.reason}"
        }

    except Exception as err:
        return {"status": "error", "message": f"Internal Server Error: {str(err)}"}

# ====================================================================
# 7. PRACTICE RESULTS PERSISTENCE (USED BY RESULTPAGE)
# ====================================================================
@app.post("/practice-results")
def save_practice_result(data: dict = Body(...)):
    required_fields = [
        "user_id", "script_id", "score", "accuracy_score", 
        "fluency_score", "pronunciation_score", "practiced_lines"
    ]

    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"{field} 값이 필요합니다.")

    try:
        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO practice_results (
                        user_id, script_id, role_name, score,
                        accuracy_score, fluency_score, pronunciation_score, practiced_lines
                    )
                    VALUES (
                        :user_id, :script_id, :role_name, :score,
                        :accuracy_score, :fluency_score, :pronunciation_score, :practiced_lines
                    )
                """),
                {
                    "user_id": data["user_id"],
                    "script_id": data["script_id"],
                    "role_name": data.get("role_name"),
                    "score": data["score"],
                    "accuracy_score": data["accuracy_score"],
                    "fluency_score": data["fluency_score"],
                    "pronunciation_score": data["pronunciation_score"],
                    "practiced_lines": data["practiced_lines"]
                }
            )
            result_id = result.lastrowid

        return {"success": True, "message": "연습 기록 저장 성공", "result_id": result_id}

    except Exception as e:
        print(f"[Practice Result Save Error] {e}")
        raise HTTPException(status_code=500, detail=f"연습 기록 저장 실패: {str(e)}")


@app.get("/practice-results/{user_id}")
def get_practice_results(user_id: int):
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT pr.result_id, pr.user_id, pr.script_id, s.title,
                           pr.role_name, pr.score, pr.accuracy_score, pr.fluency_score,
                           pr.pronunciation_score, pr.practiced_lines, pr.practiced_at
                    FROM practice_results pr
                    LEFT JOIN scripts s ON pr.script_id = s.script_id
                    WHERE pr.user_id = :user_id
                    ORDER BY pr.practiced_at DESC, pr.result_id DESC
                """),
                {"user_id": user_id}
            )

            history = []
            for row in result:
                history.append({
                    "result_id": row.result_id,
                    "user_id": row.user_id,
                    "script_id": row.script_id,
                    "title": row.title,
                    "role_name": row.role_name,
                    "score": row.score,
                    "accuracy_score": row.accuracy_score,
                    "fluency_score": row.fluency_score,
                    "pronunciation_score": row.pronunciation_score,
                    "practiced_lines": row.practiced_lines,
                    "practiced_at": str(row.practiced_at)
                })

        return {"success": True, "count": len(history), "results": history}
    except Exception as e:
        print(f"[Practice Result Read Error] {e}")
        raise HTTPException(status_code=500, detail=f"연습 기록 조회 실패: {str(e)}")


@app.get("/practice-results/detail/{result_id}")
def get_practice_result_detail(result_id: int):
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT pr.result_id, pr.user_id, pr.script_id, s.title,
                           pr.role_name, pr.score, pr.accuracy_score, pr.fluency_score,
                           pr.pronunciation_score, pr.practiced_lines, pr.practiced_at
                    FROM practice_results pr
                    LEFT JOIN scripts s ON pr.script_id = s.script_id
                    WHERE pr.result_id = :result_id
                """),
                {"result_id": result_id}
            ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="연습 기록이 없습니다.")

        return {
            "success": True,
            "result": {
                "result_id": row.result_id,
                "user_id": row.user_id,
                "script_id": row.script_id,
                "title": row.title,
                "role_name": row.role_name,
                "score": row.score,
                "accuracy_score": row.accuracy_score,
                "fluency_score": row.fluency_score,
                "pronunciation_score": row.pronunciation_score,
                "practiced_lines": row.practiced_lines,
                "practiced_at": str(row.practiced_at)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Practice Result Detail Error] {e}")
        raise HTTPException(status_code=500, detail=f"연습 상세 기록 조회 실패: {str(e)}")


# ====================================================================
# 8. WEBSOCKET & RPi5 ROBOT HARDWARE CONTROL
# ====================================================================

class RobotSpeakRequest(BaseModel):
    text: str
    emotion: str = "neutral"
    character: str = "Alex"
    voice: str = "Jenny"
    speed: float = 1.0

@app.post("/api/robot/speak")
async def robot_speak_to_rpi5(req: RobotSpeakRequest):
    EMOTION_STYLE = {
        "joy":      ("cheerful",    "+8.0%",  "+12.0%"),
        "surprise": ("excited",     "+12.0%", "+20.0%"),
        "anger":    ("angry",       "+5.0%",  "-5.0%"),
        "sadness":  ("sad",         "-15.0%", "-10.0%"),
        "fear":     ("terrified",   "+18.0%", "+15.0%"),
        "disgust":  ("unfriendly",  "-10.0%", "-6.0%"),
        "neutral":  ("general",     "+0.0%",  "+0.0%"),
    }
    
    voice_name = 'en-US-AvaNeural' if req.voice == 'Jenny' else 'en-US-AndrewNeural'
    style, rate, pitch = EMOTION_STYLE.get(req.emotion, ("general", "+0.0%", "+0.0%"))

    base_rate = float(rate.replace('%', '').replace('+', ''))
    adjusted = base_rate + (req.speed - 1.0) * 100
    rate = f"{'+' if adjusted >= 0 else ''}{adjusted:.1f}%"
    
    ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
        <voice name='{voice_name}'>
            <mstts:express-as style='{style}' styledegree='2.0'>
                <prosody rate='{rate}' pitch='{pitch}'>
                    {req.text}
                </prosody>
            </mstts:express-as>
        </voice>
    </speak>"""

    speech_config = speechsdk.SpeechConfig(
        subscription=os.getenv("AZURE_SPEECH_KEY"),
        region=os.getenv("AZURE_SPEECH_REGION")
    )
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
    )

    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

    # ── viseme 수집 ─────────────────────────────────────────
    # 합성 중 Azure가 음소별 입 모양 ID와 오디오 내 시점을 이벤트로 보내줌
    visemes = []
    def on_viseme(evt):
        # audio_offset 단위는 100ns tick → 10,000으로 나눠 ms로 변환
        visemes.append([int(evt.audio_offset / 10000), int(evt.viseme_id)])
    synthesizer.viseme_received.connect(on_viseme)   # 합성 시작 전에 콜백 등록해야 이벤트를 받음
    # ────────────────────────────────────────────────────────

    # 합성을 별도 스레드에서 실행 → 기다리는 동안에도 서버가 다른 요청·연결 확인(ping)을 처리할 수 있음
    result = await asyncio.to_thread(lambda: synthesizer.speak_ssml_async(ssml).get())
    del synthesizer

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio_b64 = base64.b64encode(result.audio_data).decode()
        print(f"[서버] 🗣️ TTS 완료 — viseme {len(visemes)}개")
        sent = await send_to_robot({
            "type": "speak",
            "line_id": 0,
            "audio_b64": audio_b64,
            "emotion": req.emotion,
            "visemes": visemes,
        })
        if not sent:
            # 로봇 미연결 → 프론트가 폴백(또는 경고) 처리할 수 있도록 상태를 구분해서 반환
            return {"status": "no_robot"}

        # TTS 음성 실제 재생 시간(초) 계산 → 프론트가 이 시간만큼 버튼을 잠금
        with wave.open(io.BytesIO(result.audio_data)) as w:
            duration = w.getnframes() / w.getframerate()

        return {"status": "sent", "visemes": len(visemes), "duration": duration}
    else:
        # 합성 취소 시 Azure가 알려주는 상세 사유를 함께 반환 (키·리전·SSML 오류 구분용)
        details = result.cancellation_details
        print(f"[서버] ❌ TTS 취소: {details.reason} / {details.error_details}")
        return {
            "status": "error",
            "reason": str(details.reason),
            "message": details.error_details,
        }

@app.post("/api/robot/standby")
async def robot_standby():
    await send_to_robot({"type": "standby"})
    return {"status": "sent"}

@app.post("/api/robot/end_recording")
async def robot_end_recording():
    await send_to_robot({"type": "end_recording"})
    return {"status": "sent"}


# ====================================================================
# 9. SCRIPT LINES MANAGEMENT
# ====================================================================
@app.post("/api/scripts/{script_id}/lines")
async def save_script_lines(script_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM script_lines WHERE script_id = :script_id"),
            {"script_id": script_id}
        )
        for line in data["lines"]:
            conn.execute(
                text("""
                    INSERT INTO script_lines 
                    (script_id, line_order, character_name, dialogue, emotion)
                    VALUES (:script_id, :line_order, :character_name, :dialogue, :emotion)
                """),
                {
                    "script_id": script_id,
                    "line_order": line["id"],
                    "character_name": line["character"],
                    "dialogue": line["text"],
                    "emotion": line["emotion"]
                }
            )
        conn.commit()
    return {"success": True}

@app.patch("/api/lines/{line_id}/emotion")
async def update_line_emotion(line_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE script_lines 
                SET emotion = :emotion 
                WHERE line_id = :line_id
            """),
            {"emotion": data["emotion"], "line_id": line_id}
        )
        conn.commit()
    return {"success": True}

@app.get("/api/scripts/{script_id}/lines")
async def get_script_lines(script_id: int):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT line_id, line_order, character_name, dialogue, emotion
                FROM script_lines
                WHERE script_id = :script_id
                ORDER BY line_order
            """),
            {"script_id": script_id}
        )
        lines = []
        for row in result:
            lines.append({
                "line_id": row.line_id,
                "id": row.line_order,
                "character": row.character_name,
                "text": row.dialogue,
                "emotion": row.emotion
            })
        return lines


# ====================================================================
# 10. PRACTICE SESSION HISTORY (OPTIONAL SESSIONS ENDPOINTS)
# ====================================================================
@app.post("/api/sessions")
async def save_session(data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO practice_sessions
                (user_id, script_id, chosen_role, total_lines, average_score)
                VALUES (:user_id, :script_id, :chosen_role, :total_lines, :average_score)
            """),
            {
                "user_id": data["user_id"],
                "script_id": data["script_id"],
                "chosen_role": data["chosen_role"],
                "total_lines": data["total_lines"],
                "average_score": data["average_score"]
            }
        )
        conn.commit()
    return {"success": True}

@app.get("/api/sessions/{user_id}")
async def get_sessions(user_id: int):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT ps.session_id, ps.chosen_role, ps.total_lines, 
                       ps.average_score, ps.created_at, s.title
                FROM practice_sessions ps
                JOIN scripts s ON ps.script_id = s.script_id
                WHERE ps.user_id = :user_id
                ORDER BY ps.created_at DESC
            """),
            {"user_id": user_id}
        )
        sessions = []
        for row in result:
            sessions.append({
                "session_id": row.session_id,
                "title": row.title,
                "chosen_role": row.chosen_role,
                "total_lines": row.total_lines,
                "average_score": round(row.average_score),
                "created_at": str(row.created_at)
            })
        return sessions


@app.get("/api/test/speak")
async def test_speak(emotion: str = "joy"):
    import numpy as np
    from scipy.io.wavfile import write
    
    sr = 16000
    t = np.linspace(0, 1, sr)
    wave = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    buf = io.BytesIO()
    write(buf, sr, wave)
    audio_b64 = base64.b64encode(buf.getvalue()).decode()
    
    await send_to_robot({
        "type": "speak",
        "line_id": 0,
        "audio_b64": audio_b64,
        "emotion": emotion
    })
    return {"status": "sent", "emotion": emotion}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)