"""
lcd_mouth.py
------------
LCD 입 모양 애니메이션 모듈 (Azure TTS viseme 기반 립싱크).

[동작 개요]
- Azure TTS가 합성 시 넘겨주는 viseme 타임라인 [(오프셋ms, viseme_id), ...]을 받아
  오디오 재생 시각에 맞춰 해당 입 모양 프레임을 LCD에 표시한다.
- Azure viseme 22종(0~21)을 11개 입 모양으로 묶어 사용한다.
- 모든 프레임은 임포트 시 미리 렌더링해 두고, 표시할 때는 이미지만 교체한다.
- luma의 diff_to_previous 덕분에 바뀐 영역(입 부분)만 SPI로 전송된다.
  → 배경을 바꾸면 전체 화면 전송(약 276ms)이 일어나므로 배경은 항상 검정 고정.

- 입 모양은 _SHAPE_SPECS의 숫자만 바꿔 조정한다 (색은 상단 팔레트).
  입 그림은 가로 180px × 세로 100px 안에 들어가야 프레임레이트(약 25fps)가 유지된다.

[공개 API]
- animate_visemes(timeline, duration=None, t0=None, stop_event=None) : viseme 립싱크
- animate_speaking(duration, interval=0.15, stop_event=None)        : 기존 뻐끔거림 (폴백용)
- close_mouth()                                                     : 입 다문 상태로 리셋
"""

import sys
import threading
import time
from bisect import bisect_right

from luma.core.interface.serial import spi
from luma.lcd.device import ili9486
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from luma.core.framebuffer import diff_to_previous   # 다른 import 줄들 아래에 추가
# ─────────────────────────────────────────────────────────────
# SPI/LCD 초기화 — 모듈 임포트 시 한 번만 실행
# rotate=1: 패널 물리 장착 방향(90도) 보정값, 실측으로 확인된 값
# bus_speed_hz=16MHz: 32MHz는 점퍼선 배선이 못 버텨 화면이 안 나왔음, 16MHz가 안정 상한
# ─────────────────────────────────────────────────────────────
_serial = spi(port=0, device=0, gpio_DC=24, gpio_RST=25, bgr=True, bus_speed_hz=16000000)
# num_segments=1: 바뀐 영역을 16개 블록으로 쪼개지 않고 사각형 하나로 전송 → 입이 바뀔 때 블록이 뒤섞여 보이는 현상 완화
_device = ili9486(_serial, width=320, height=480, rotate=1, framebuffer=diff_to_previous(num_segments=1))
_device.command(0x20)   # 패널 기본값이 색 반전 상태라 초기화 직후 반전 해제 (INVOFF, 실측 확인)
_W, _H = _device.size        # 회전 적용 후 (480, 320)
_CX, _CY = _W // 2, _H // 2  # 입 모양 중심 좌표

# SPI 전송은 동시에 두 스레드가 하면 화면이 깨지므로 표시 함수 전체를 락으로 보호
# (예: 애니메이션 스레드가 도는 중에 standby 처리에서 close_mouth() 호출)
_lock = threading.Lock()
_current_shape = None        # 현재 LCD에 떠 있는 입 모양 (같은 모양 재전송 방지용)

# aplay 프로세스 기동 지연 보정값(ms)
# 입이 소리보다 먼저 움직이면 값을 키우고(+), 늦게 움직이면 줄인다(-). 실측 후 조정.
AUDIO_LATENCY_MS = 0

# 마지막 viseme 이후 duration 정보가 없을 때 입을 유지할 여유 시간(ms)
_TAIL_MS = 200


# ─────────────────────────────────────────────────────────────
# Azure viseme ID(0~21) → 입 모양 키 매핑
# 참고: Azure Speech viseme ID는 영어(en-US) 음소 그룹 기준
# ─────────────────────────────────────────────────────────────
VISEME_TO_SHAPE = {
    0:  "rest",         # 무음
    1:  "open_mid",     # æ, ə, ʌ
    2:  "open_wide",    # ɑ
    3:  "round_open",   # ɔ
    4:  "open_mid",     # ɛ, ʊ
    5:  "round_small",  # ɝ
    6:  "smile",        # j, i, ɪ
    7:  "round_small",  # w, u
    8:  "round_open",   # o
    9:  "open_wide",    # aʊ
    10: "round_open",   # ɔɪ
    11: "open_wide",    # aɪ
    12: "open_mid",     # h
    13: "round_small",  # ɹ
    14: "tongue_up",    # l (혀끝을 윗니 뒤로)
    15: "teeth",        # s, z
    16: "round_small",  # ʃ, tʃ, dʒ, ʒ (입술이 앞으로 모임)
    17: "th",           # ð (이 사이로 혀)
    18: "fv",           # f, v (윗니가 아랫입술에 닿음)
    19: "teeth",        # d, t, n, θ
    20: "teeth",        # k, g, ŋ
    21: "closed",       # p, b, m (입술 완전히 닫힘)
}

# 매핑에 없는 ID가 들어왔을 때 사용할 기본 모양
_FALLBACK_SHAPE = "open_mid"


# ─────────────────────────────────────────────────────────────
# 입 모양 렌더링 (카툰 입술 + 치아·혀)
# 4배 크게 그린 뒤 축소(슈퍼샘플링)해 테두리를 부드럽게 만들고,
# 입 영역(180×100) 밖은 항상 검정이라 diff_to_previous로 입 부분만 전송된다.
# ─────────────────────────────────────────────────────────────
import math

# 입 크기 배율: 이 숫자 하나로 입 전체 크기를 조절한다 (1.0 = 180×100px)
# 크게 할수록 매 프레임 전송 영역이 넓어져 fps가 떨어진다 (1.0≈25fps 실측, 1.4≈13~15fps 예상)
MOUTH_SCALE = 1.4
_BW, _BH = 180, 100          # 도형 설계 기준 크기 (_SHAPE_SPECS 좌표는 이 크기의 4배 캔버스 기준)
_RW, _RH = int(_BW * MOUTH_SCALE), int(_BH * MOUTH_SCALE)   # 실제 화면에 그려지는 입 영역 크기
_SS = 4                      # 슈퍼샘플링 배율: 4배 크게 그린 뒤 축소해 테두리를 부드럽게
_N = 120                     # 곡선 하나를 근사하는 점 개수

# ── 색상 팔레트 (RGB) ─────────────────────────────────────
BG          = (0, 0, 0)         # 배경 — 검정 고정 (바꾸면 매 프레임 전체 화면 전송 발생)
LIP_UP_TOP  = (150, 40, 62)     # 윗입술 바깥쪽 (빛을 덜 받아 어두움)
LIP_UP_BOT  = (196, 64, 86)     # 윗입술 안쪽
LIP_LO_TOP  = (226, 100, 116)   # 아랫입술 안쪽 (빛을 받아 밝음)
LIP_LO_BOT  = (172, 50, 72)     # 아랫입술 바깥쪽
LIP_SEAM    = (104, 22, 42)     # 다문 입술 사이 선
LIP_SHINE   = (255, 196, 206)   # 아랫입술 광택
INSIDE      = (44, 9, 19)       # 입 안쪽 (어두운 구강)
TEETH       = (244, 240, 230)   # 치아
TEETH_GAP   = (222, 216, 204)   # 앞니 가운데 틈 (은은하게)
TONGUE      = (212, 96, 110)    # 혀


def _bump(t: float, p: float) -> float:
    """-1~1 구간에서 가운데가 1, 양 끝이 0인 곡선. p가 작을수록 둥글고, 클수록 납작하다."""
    t = abs(t)
    return 0.0 if t >= 1 else (1 - t * t) ** p


def _vgrad(size, y0, y1, c0, c1):
    """y0→y1 구간에서 c0→c1로 바뀌는 세로 그라데이션 이미지 (구간 밖은 끝 색으로 유지)"""
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(size[1]):
        t = min(1.0, max(0.0, (y - y0) / max(1.0, y1 - y0)))
        d.line([(0, y), (size[0], y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(c0, c1)))
    return img


def _poly_mask(size, poly):
    """다각형 영역만 255인 마스크"""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def _draw_mouth(w, tu, tl, ou=0, ol=0, p=0.7, bow=14,
                upper=0, lower=0, tongue=0, tongue_style="low", seam=8):
    """
    입 모양 하나를 그려 전체 화면 이미지(480×320)로 반환한다.
    좌표는 4배 설계 캔버스(720×400) 기준이며, 캔버스 중심(360, 200)이 원점이다.

    Args:
        w           : 입꼬리까지의 반폭
        tu, tl      : 윗입술·아랫입술 두께 (가운데 기준, 입꼬리로 갈수록 얇아짐)
        ou, ol      : 벌어진 입 안쪽의 위·아래 반높이 (둘 다 0이면 다문 입)
        p           : 입 모양 곡률 (0.4 = 동그랗게 오므림, 0.8 = 옆으로 납작)
        bow         : 윗입술 가운데 V자 굴곡(큐피드 활) 깊이
        upper/lower : 윗니·아랫니가 입 안쪽 경계에서 드러나는 길이
        tongue      : 혀 크기 (0이면 혀 없음)
        tongue_style: "low"(바닥에 놓인 혀) / "tip"(이 사이로 나온 혀, th) / "up"(혀끝을 위로 올림, l)
        seam        : 다문 입일 때 입술 사이 선 굵기
    """
    size = (_BW * _SS, _BH * _SS)                    # 설계용 캔버스는 배율과 무관하게 고정
    big = Image.new("RGB", size, BG)
    cx, cy = size[0] / 2, size[1] / 2
    wi = w * 0.93                                    # 입 안쪽 반폭
    closed = not (ou or ol)

    xs = [w * (-1 + 2 * i / _N) for i in range(_N + 1)]   # 왼쪽 입꼬리 → 오른쪽 입꼬리

    def inner_up(x):   # 입 안쪽 위 경계 (화면 위쪽이 음수)
        return -ou * _bump(x / wi, 0.55)

    def inner_lo(x):   # 입 안쪽 아래 경계
        return ol * _bump(x / wi, 0.55)

    def seam_y(x):     # 다문 입의 입술 경계 (살짝 웃는 곡선)
        return 6 * _bump(x / w, 1.0)

    def outer_up(x):   # 윗입술 바깥선 = 안쪽 경계 − 두께 + 가운데 V자 굴곡
        dip = bow * math.exp(-(x / (w * 0.11)) ** 2)
        return (seam_y(x) if closed else inner_up(x)) - tu * _bump(x / w, p * 0.6) + dip

    def outer_lo(x):   # 아랫입술 바깥선 (위보다 두툼)
        return (seam_y(x) if closed else inner_lo(x)) + tl * _bump(x / w, p * 0.55)

    def pts(f, rev=False):
        seq = reversed(xs) if rev else xs
        return [(cx + x, cy + f(x)) for x in seq]

    up_edge = seam_y if closed else inner_up         # 윗입술 아래 경계
    lo_edge = seam_y if closed else inner_lo         # 아랫입술 위 경계

    # 1) 윗입술: 바깥쪽이 어둡고 안쪽으로 갈수록 밝아지는 그라데이션
    up_mask = _poly_mask(size, pts(outer_up) + pts(up_edge, rev=True))
    big.paste(_vgrad(size, cy + outer_up(0) - bow, cy + up_edge(0), LIP_UP_TOP, LIP_UP_BOT), (0, 0), up_mask)

    # 2) 아랫입술: 안쪽이 밝고 바깥쪽으로 갈수록 어두워지는 그라데이션
    lo_mask = _poly_mask(size, pts(lo_edge) + pts(outer_lo, rev=True))
    big.paste(_vgrad(size, cy + lo_edge(0), cy + outer_lo(0), LIP_LO_TOP, LIP_LO_BOT), (0, 0), lo_mask)

    # 3) 아랫입술 광택: 흐리게 번진 빛을 아랫입술 영역 안에만 얹음
    hx, hy = cx + w * 0.10, cy + lo_edge(0) + tl * 0.40
    shine = Image.new("L", size, 0)
    ImageDraw.Draw(shine).ellipse([hx - w * 0.20, hy - tl * 0.13, hx + w * 0.20, hy + tl * 0.13], fill=150)
    shine = ImageChops.multiply(shine.filter(ImageFilter.GaussianBlur(14)), lo_mask)
    big.paste(Image.new("RGB", size, LIP_SHINE), (0, 0), shine)

    if closed:
        # 4') 다문 입: 입술 사이 선 (입꼬리 근처에서 자연스럽게 사라지도록 92%까지만)
        seam_pts = [(cx + x, cy + seam_y(x)) for x in xs if abs(x) <= w * 0.92]
        line = Image.new("L", size, 0)
        ImageDraw.Draw(line).line(seam_pts, fill=255, width=seam)
        big.paste(Image.new("RGB", size, LIP_SEAM), (0, 0), line.filter(ImageFilter.GaussianBlur(2)))
    else:
        # 4) 입 안쪽: 별도 레이어에 치아·혀를 그린 뒤 입 안 모양으로 잘라 붙임
        inner_poly = pts(inner_up) + pts(inner_lo, rev=True)
        layer = Image.new("RGB", size, INSIDE)
        dl = ImageDraw.Draw(layer)

        if tongue and tongue_style == "low":       # 바닥에 놓인 혀
            tw = wi * 0.62
            dl.ellipse([cx - tw, cy + ol - tongue, cx + tw, cy + ol + tongue], fill=TONGUE)
        if tongue and tongue_style == "up":        # 혀끝을 윗니 뒤로 올린 혀 (l)
            tw = wi * 0.30
            dl.ellipse([cx - tw, cy - ou * 0.55, cx + tw, cy + ol * 1.6], fill=TONGUE)

        if upper:                                  # 윗니: 위 경계를 따라 띠 모양
            dl.polygon(pts(inner_up) + [(cx + x, cy + inner_up(x) + upper) for x in reversed(xs)], fill=TEETH)
            dl.line([cx, cy - ou, cx, cy - ou + upper], fill=TEETH_GAP, width=4)   # 앞니 사이 틈
        if lower:                                  # 아랫니
            dl.polygon(pts(inner_lo) + [(cx + x, cy + inner_lo(x) - lower) for x in reversed(xs)], fill=TEETH)

        if tongue and tongue_style == "tip":       # 이 사이로 살짝 나온 혀 (th)
            tw = wi * 0.30
            dl.ellipse([cx - tw, cy - tongue * 0.5, cx + tw, cy + tongue * 0.5], fill=TONGUE)

        # 4-1) 윗입술 아래로 지는 옅은 그림자: 윗니 윗부분만 살짝 어둡게 해서 깊이감 표현
        edge = Image.new("L", size, 0)
        ImageDraw.Draw(edge).line(pts(inner_up), fill=90, width=12)
        layer.paste(Image.new("RGB", size, INSIDE), (0, 0), edge.filter(ImageFilter.GaussianBlur(6)))

        big.paste(layer, (0, 0), _poly_mask(size, inner_poly))

    # 5) 축소(안티에일리어싱) 후 검정 전체 화면 가운데에 배치
    small = big.resize((_RW, _RH), Image.LANCZOS)   # 배율만큼 확대·축소
    frame = Image.new("RGB", (_W, _H), BG)
    frame.paste(small, (_CX - _RW // 2, _CY - _RH // 2))
    return frame


# 입 모양별 파라미터 (4배 좌표, 입 영역 720×400 / 세로는 중심에서 ±190 이내)
_SHAPE_SPECS = {
    # 무음: 편하게 다문 입
    "rest":        dict(w=260, tu=34, tl=44, p=0.8),
    # p/b/m: 입술을 꾹 다물어 살짝 말려 들어감 (좁고 얇게)
    "closed":      dict(w=230, tu=26, tl=32, p=0.9, seam=14, bow=8),
    # ɑ, aɪ, aʊ: 크게 벌림 — 윗니 살짝, 혀 바닥
    "open_wide":   dict(w=240, tu=34, tl=44, ou=88, ol=108, p=0.55, upper=26, tongue=46),
    # æ, ə, ʌ, ɛ, h: 중간 벌림
    "open_mid":    dict(w=265, tu=34, tl=44, ou=50, ol=72, p=0.65, upper=26, tongue=34),
    # ɔ, o, ɔɪ: 동그랗게 벌림
    "round_open":  dict(w=150, tu=42, tl=50, ou=70, ol=90, p=0.42, upper=20, tongue=30),
    # u, w, ɹ, ɝ, ʃ: 입술을 앞으로 오므림 (작은 구멍 + 두툼한 입술)
    "round_small": dict(w=112, tu=48, tl=54, ou=24, ol=28, p=0.75, bow=10),
    # i, ɪ, j: 옆으로 길게 벌려 위아래 이가 보임
    "smile":       dict(w=320, tu=26, tl=34, ou=30, ol=30, p=0.85, upper=20, lower=16),
    # s, z, t, d, n, k, g: 이를 거의 맞물린 상태
    "teeth":       dict(w=285, tu=30, tl=38, ou=22, ol=24, p=0.80, upper=18, lower=20),
    # f, v: 윗니가 아랫입술에 얹힘 (아래쪽 입 안이 거의 안 보임)
    "fv":          dict(w=270, tu=32, tl=48, ou=34, ol=6, p=0.75, upper=40),
    # θ, ð: 위아래 이 사이로 혀끝이 나옴
    "th":          dict(w=275, tu=32, tl=40, ou=30, ol=30, p=0.75, upper=16, lower=14,
                        tongue=34, tongue_style="tip"),
    # l: 입을 벌리고 혀끝을 윗니 뒤에 붙임
    "tongue_up":   dict(w=250, tu=34, tl=44, ou=58, ol=70, p=0.60, upper=22,
                        tongue=1, tongue_style="up"),
}


def _render_shape(kind: str) -> Image.Image:
    """입 모양 키 하나에 대한 전체 화면 이미지 생성 (배경 검정 고정)"""
    if kind not in _SHAPE_SPECS:
        raise ValueError(f"알 수 없는 입 모양: {kind}")
    spec = dict(_SHAPE_SPECS[kind])
    for k in ("tu", "tl"):                          # 입술 두께 확대
        spec[k] = spec[k] * 1.45
    for k in ("ou", "ol", "upper", "lower"):        # 입 벌림·치아 확대
        if k in spec:
            spec[k] = spec[k] * 1.15
    if spec.get("tongue_style", "low") != "up" and "tongue" in spec:
        spec["tongue"] = spec["tongue"] * 1.15      # 혀 확대 ("up"은 크기 플래그라 제외)
    return _draw_mouth(**spec)


SHAPES = list(_SHAPE_SPECS.keys())


# 사용하는 모든 입 모양을 임포트 시점에 미리 렌더링 (표시할 때 PIL 연산 비용 제거)
_FRAMES = {k: _render_shape(k) for k in SHAPES}


def _show(shape: str, force: bool = False) -> None:
    """
    입 모양 하나를 LCD에 표시한다.
    - 현재 표시 중인 모양과 같으면 전송을 생략한다 (force=True면 강제 전송).
    - 한 번 전송에 약 40ms 블로킹된다 (입 영역만 바뀌는 경우 기준).
    """
    global _current_shape
    with _lock:
        if shape == _current_shape and not force:
            return
        _device.display(_FRAMES[shape])
        _current_shape = shape


# ─────────────────────────────────────────────────────────────
# viseme 립싱크
# ─────────────────────────────────────────────────────────────
def animate_visemes(timeline, duration: float = None, t0: float = None,
                    stop_event: threading.Event = None) -> dict:
    """
    viseme 타임라인에 맞춰 입 모양을 재생한다. (blocking — asyncio.to_thread로 호출 전제)

    Args:
        timeline  : [[오프셋ms, viseme_id], ...] — 오디오 시작 기준, 정렬 안 돼 있어도 됨
        duration  : 오디오 전체 길이(초). 주면 그 시점까지 재생 후 종료,
                    없으면 마지막 viseme + _TAIL_MS 후 종료
        t0        : 오디오 재생을 시작한 시각(time.monotonic() 값).
                    aplay를 띄운 직후 값을 넘기면 된다. None이면 호출 시점 기준.
        stop_event: set()되면 즉시 중단 (end_session 등)

    Returns:
        {"shown": 실제 표시한 프레임 수, "events": 전체 viseme 수} — 프레임 드롭 확인용
    """
    # 타임라인이 없으면 기존 뻐끔거림으로 폴백 (서버가 viseme를 안 보낸 경우 대비)
    if not timeline:
        if duration:
            animate_speaking(duration, stop_event=stop_event)
        else:
            close_mouth()
        return {"shown": 0, "events": 0}

    # (오프셋, ID)를 정수로 정규화하고 오프셋 기준 정렬
    events = sorted((int(ms), int(vid)) for ms, vid in timeline)
    offsets = [ms for ms, _ in events]   # bisect 검색용 오프셋 리스트

    # 시작 기준 시각 결정 + aplay 지연 보정
    if t0 is None:
        t0 = time.monotonic()
    t0 += AUDIO_LATENCY_MS / 1000

    # 종료 시점(ms): duration 우선, 없으면 마지막 이벤트 + 여유 시간
    end_ms = duration * 1000 if duration else offsets[-1] + _TAIL_MS

    shown = 0
    last_idx = None
    while True:
        # 외부 중단 요청 확인
        if stop_event is not None and stop_event.is_set():
            break

        # 매 루프마다 실제 경과 시간을 다시 계산 → 전송 지연이 누적되지 않음
        now_ms = (time.monotonic() - t0) * 1000
        if now_ms >= end_ms:
            break

        # 현재 시각까지 도달한 마지막 이벤트 인덱스
        # 전송(40ms) 중에 지나간 짧은 viseme들은 자연스럽게 건너뛰어짐 (프레임 드롭)
        idx = bisect_right(offsets, now_ms) - 1

        if idx != last_idx:
            if idx < 0:
                _show("rest")   # 첫 viseme 전: 다문 입
            else:
                _show(VISEME_TO_SHAPE.get(events[idx][1], _FALLBACK_SHAPE))
            shown += 1
            last_idx = idx

        # 다음 이벤트(또는 종료 시점)까지 대기 — 최대 10ms 단위로 쪼개 중단 요청에 빠르게 반응
        next_ms = offsets[idx + 1] if idx + 1 < len(offsets) else end_ms
        wait_s = max(0.0, (next_ms - (time.monotonic() - t0) * 1000) / 1000)
        if wait_s > 0:
            if stop_event is not None:
                stop_event.wait(min(wait_s, 0.01))
            else:
                time.sleep(min(wait_s, 0.01))

    # 재생 종료 후 다문 입으로 정리
    _show("rest")
    return {"shown": shown, "events": len(events)}


# ─────────────────────────────────────────────────────────────
# 기존 API (폴백·하위 호환용)
# ─────────────────────────────────────────────────────────────
def draw_mouth_closed():
    """입 다문 상태 (기존 호환용)"""
    _show("rest")


def draw_mouth_open():
    """입 벌린 상태 (기존 호환용)"""
    _show("open_mid")


def animate_speaking(duration: float, interval: float = 0.15,
                     stop_event: threading.Event = None):
    """
    viseme 정보가 없을 때 쓰는 폴백: duration(초) 동안 열림/닫힘 반복.
    asyncio.to_thread로 호출되는 것을 전제로 blocking sleep 사용.
    """
    if duration <= 0:
        _show("rest")
        return

    end_time = time.monotonic() + duration
    is_open = False
    while time.monotonic() < end_time:
        if stop_event is not None and stop_event.is_set():
            break
        _show("open_mid" if is_open else "rest")
        is_open = not is_open
        time.sleep(interval)

    _show("rest")


def close_mouth():
    """대기(standby)나 세션 종료 시 입 다문 상태로 리셋 (강제 전송으로 화면 상태 확실히 맞춤)"""
    _show("rest", force=True)


# ─────────────────────────────────────────────────────────────
# 단독 실행 테스트
#   python lcd_mouth.py shapes : 11개 입 모양을 하나씩 표시 (디자인 확인용)
#   python lcd_mouth.py demo   : 더미 타임라인으로 립싱크 재생 + 프레임 드롭 확인
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "demo"

    if mode == "shapes":
        for k in SHAPES:
            print(f"[shape] {k}")
            _show(k)
            time.sleep(1.0)
        close_mouth()

    elif mode == "demo":
        # "Hello, how are you?"를 대략 흉내 낸 손으로 만든 타임라인 (실제 Azure 값 아님)
        dummy = [
            [0, 0], [100, 12], [180, 4], [260, 14], [330, 8],     # Hel-lo
            [500, 0],                                             # 쉼표 무음
            [580, 12], [650, 9],                                  # how
            [820, 2], [900, 13],                                  # are
            [980, 6], [1050, 7],                                  # you
            [1250, 0],
        ]
        t_start = time.monotonic()
        result = animate_visemes(dummy, duration=1.5)
        elapsed = time.monotonic() - t_start
        print(f"[demo] {elapsed:.2f}s 동안 {result['shown']}프레임 표시 "
              f"(viseme {result['events']}개)")

    else:
        print("사용법: python lcd_mouth.py [shapes|demo]")
