"""
lcd_mouth.py
------------
LCD 입 모양 애니메이션 모듈 (Azure TTS viseme 기반 립싱크).

[동작 개요]
- Azure TTS가 합성 시 넘겨주는 viseme 타임라인 [(오프셋ms, viseme_id), ...]을 받아
  오디오 재생 시각에 맞춰 해당 입 모양 프레임을 LCD에 표시한다.
- Azure viseme 22종(0~21)을 9개 입 모양으로 묶어 사용한다.
- 모든 프레임은 임포트 시 미리 렌더링해 두고, 표시할 때는 이미지만 교체한다.
- luma의 diff_to_previous 덕분에 바뀐 영역(입 부분)만 SPI로 전송된다.
  → 배경을 바꾸면 전체 화면 전송(약 276ms)이 일어나므로 배경은 항상 검정 고정.

⚠️ 현재 입 도형은 placeholder. 실제 디자인이 정해지면 _render_shape() 내부만
   PNG 로드 등으로 교체하면 되며, 호출부(ws_client.py)는 수정할 필요 없다.
   단, 입 그림은 가로 180px × 세로 100px 정도 안에 들어가야 프레임레이트가 유지된다.

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
from PIL import Image, ImageDraw

# ─────────────────────────────────────────────────────────────
# SPI/LCD 초기화 — 모듈 임포트 시 한 번만 실행
# rotate=1: 패널 물리 장착 방향(90도) 보정값, 실측으로 확인된 값
# bus_speed_hz=16MHz: 32MHz는 점퍼선 배선이 못 버텨 화면이 안 나왔음, 16MHz가 안정 상한
# ─────────────────────────────────────────────────────────────
_serial = spi(port=0, device=0, gpio_DC=24, gpio_RST=25, bgr=True, bus_speed_hz=16000000)
_device = ili9486(_serial, width=320, height=480, rotate=1)

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
    14: "teeth",        # l
    15: "teeth",        # s, z
    16: "round_small",  # ʃ, tʃ, dʒ, ʒ (입술이 앞으로 모임)
    17: "teeth",        # ð
    18: "fv",           # f, v (윗니가 아랫입술에 닿음)
    19: "teeth",        # d, t, n, θ
    20: "teeth",        # k, g, ŋ
    21: "closed",       # p, b, m (입술 완전히 닫힘)
}

# 매핑에 없는 ID가 들어왔을 때 사용할 기본 모양
_FALLBACK_SHAPE = "open_mid"


# ─────────────────────────────────────────────────────────────
# 입 모양 렌더링 (placeholder 도형)
# ─────────────────────────────────────────────────────────────
def _ellipse(draw, w, h, fill="white"):
    """화면 중심 기준 가로 w, 세로 h 타원을 그린다."""
    draw.ellipse([_CX - w // 2, _CY - h // 2, _CX + w // 2, _CY + h // 2], fill=fill)


def _render_shape(kind: str) -> Image.Image:
    """입 모양 키 하나에 대한 전체 화면 이미지를 생성한다 (배경 검정 고정)."""
    img = Image.new("RGB", (_W, _H), "black")
    d = ImageDraw.Draw(img)

    if kind == "rest":            # 다문 입: 얇은 선
        _ellipse(d, 160, 6)
    elif kind == "closed":        # p/b/m: 입술을 꾹 다문 상태 (rest보다 두껍고 짧게)
        _ellipse(d, 140, 14)
    elif kind == "open_wide":     # 크게 벌림
        _ellipse(d, 170, 100)
    elif kind == "open_mid":      # 중간 벌림
        _ellipse(d, 160, 60)
    elif kind == "round_open":    # 동그랗게 벌림 (o 계열)
        _ellipse(d, 100, 90)
    elif kind == "round_small":   # 입술 오므림 (u/w 계열)
        _ellipse(d, 60, 56)
    elif kind == "smile":         # 옆으로 벌림 (i 계열)
        _ellipse(d, 180, 34)
    elif kind == "teeth":         # 살짝 벌리고 윗니가 보이는 상태
        _ellipse(d, 170, 46)                            # 바깥 입술
        _ellipse(d, 156, 34, fill="black")              # 입 안쪽 (검정으로 파냄)
        d.rectangle([_CX - 60, _CY - 17, _CX + 60, _CY - 7], fill="white")  # 윗니
    elif kind == "fv":            # 윗니가 아랫입술을 누르는 상태
        _ellipse(d, 160, 30)                            # 입 외곽
        d.rectangle([_CX - 55, _CY - 15, _CX + 55, _CY - 5], fill="black")  # 윗니와 입술 경계선
    else:
        raise ValueError(f"알 수 없는 입 모양: {kind}")

    return img


# 사용하는 모든 입 모양을 임포트 시점에 미리 렌더링 (표시할 때 PIL 연산 비용 제거)
SHAPES = ["rest", "closed", "open_wide", "open_mid", "round_open",
          "round_small", "smile", "teeth", "fv"]
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
#   python lcd_mouth.py shapes : 9개 입 모양을 하나씩 표시 (디자인 확인용)
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