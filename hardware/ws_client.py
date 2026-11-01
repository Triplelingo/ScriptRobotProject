# RPi5 WebSocket 클라이언트
# ─────────────────────────────────────────────────────────────
# 서버(FastAPI)와 WebSocket으로 연결해 로봇 동작을 수행한다.
#   speak        : TTS 음성 재생 + 서보 고갯짓 + LCD viseme 립싱크
#   standby      : 대기 상태로 복귀 (녹음 레벨 LED 모니터링 시작)
#   end_recording: 녹음 종료 (LED 끄기)
#   set_volume   : 스피커 볼륨 변경 (웹 슬라이더)
#   end_session  : 세션 종료 (서보·입 모양 초기화)
# 실행: python -u ws_client.py   (핫스팟 환경: SERVER_HOST=192.168.137.1 python -u ws_client.py)
# ─────────────────────────────────────────────────────────────
from servo_controller import perform, reset
from lcd_mouth import animate_visemes, close_mouth   # LCD 입 모양 (viseme 립싱크)
import asyncio
import json
import base64
import websockets
import subprocess
import tempfile
import io
import lgpio
import sounddevice as sd
import numpy as np
import threading
import os
import re
import time      # aplay 시작 시각(t0) 기록용 — 립싱크 기준점
import wave      # WAV 헤더에서 재생 길이 계산, 볼륨 증폭

stop_event = threading.Event()    # LED 모니터링(녹음 레벨 표시) 스레드 중단용
speak_stop = threading.Event()    # 입 애니메이션 중단용 (stop_event와 분리)

# ─────────────────────────────────────────────────────────────
# 볼륨 제어: 0~100%는 ALSA 믹서(PCM), 100% 초과는 소프트웨어 증폭
# ─────────────────────────────────────────────────────────────
VOLUME_FILE = os.path.expanduser("~/.robot_volume")   # 마지막 볼륨 저장 위치 (재부팅 후 유지)
ALSA_CARD = "0"                                       # aplay -D plughw:0,0 과 같은 카드 번호
current_volume = 60                                   # 현재 볼륨(%)


def _find_mixer_control():
    """USB 스피커의 볼륨 믹서 이름을 찾는다. 없으면 None (→ 전 구간 소프트웨어 증폭)."""
    try:
        out = subprocess.run(["amixer", "-c", ALSA_CARD, "scontrols"],
                             capture_output=True, text=True, timeout=2).stdout
    except Exception:
        return None
    names = re.findall(r"'([^']+)'", out)              # Simple mixer control 'PCM',0 → PCM
    for preferred in ("PCM", "Speaker", "Master", "Headphone"):
        if preferred in names:
            return preferred
    return names[0] if names else None


MIXER_CONTROL = _find_mixer_control()
print(f"[RPi5] 🔈 볼륨 믹서: {MIXER_CONTROL or '없음 (소프트웨어 증폭만 사용)'}")


def apply_volume(volume) -> int:
    """볼륨(0~150%) 적용 후 파일에 저장. 실제 적용된 값을 반환."""
    global current_volume
    current_volume = max(0, min(150, int(volume)))
    if MIXER_CONTROL:
        # -M: 사람 귀 기준 비율로 매핑 → 슬라이더를 움직인 만큼 자연스럽게 크기가 변함
        # 하드웨어 믹서는 100%까지만, 초과분은 apply_gain()에서 처리
        subprocess.run(["amixer", "-c", ALSA_CARD, "-q", "-M", "sset", MIXER_CONTROL,
                        f"{min(current_volume, 100)}%"], timeout=2)
    try:
        with open(VOLUME_FILE, "w") as f:
            f.write(str(current_volume))
    except OSError:
        pass
    return current_volume


def apply_gain(audio_bytes: bytes) -> bytes:
    """믹서로 처리 못 하는 구간(100% 초과, 또는 믹서 없음)은 WAV 샘플을 직접 증폭·감쇠한다."""
    if MIXER_CONTROL and current_volume <= 100:
        return audio_bytes                             # 믹서가 처리하므로 그대로
    # 믹서가 있으면 100% 초과분만 증폭 (믹서는 이미 100%), 없으면 전체 비율 적용
    gain = current_volume / 100
    if gain == 1.0:
        return audio_bytes
    try:
        with wave.open(io.BytesIO(audio_bytes)) as r:
            params = r.getparams()
            frames = r.readframes(r.getnframes())
        if params.sampwidth != 2:                      # 16bit PCM만 처리
            return audio_bytes
        samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) * gain
        samples = np.clip(samples, -32768, 32767).astype(np.int16)   # 증폭 시 찢어짐(오버플로) 방지
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setparams(params)
            w.writeframes(samples.tobytes())
        return buf.getvalue()
    except (wave.Error, EOFError):
        return audio_bytes                             # 파싱 실패 시 원본 재생


def load_saved_volume():
    """시작 시 저장된 볼륨 복원 (저장값이 없으면 60%)"""
    try:
        with open(VOLUME_FILE) as f:
            apply_volume(f.read().strip())
    except (OSError, ValueError):
        apply_volume(60)    # 기존에 쓰던 크기(믹서 40%)와 비슷한 체감 크기
    print(f"[RPi5] 🔈 볼륨 복원: {current_volume}%")


# ─────────────────────────────────────────────────────────────
# 녹음 레벨 LED (최종 하드웨어에서는 미장착 — 코드만 유지)
# ─────────────────────────────────────────────────────────────
LED_PINS = [13, 6, 26]
h = lgpio.gpiochip_open(0)
for pin in LED_PINS:
    lgpio.gpio_claim_output(h, pin)
    lgpio.gpio_write(h, pin, 0)


def set_leds(count):
    """마이크 입력 크기에 따라 LED를 count개 켠다."""
    for i, pin in enumerate(LED_PINS):
        lgpio.gpio_write(h, pin, 1 if i < count else 0)


# ─────────────────────────────────────────────────────────────
# 서버 주소 — 환경변수로 덮어쓸 수 있음 (코드 수정 없이 네트워크 전환)
# ─────────────────────────────────────────────────────────────
SERVER_HOST = os.getenv("SERVER_HOST", "192.168.0.102")    # 기본: 노트북 서버 주소 / 핫스팟 환경에서는 192.168.137.1
SERVER_PORT = os.getenv("SERVER_PORT", "8000")             # FastAPI(uvicorn) 포트
SERVER_URL = f"ws://{SERVER_HOST}:{SERVER_PORT}/ws/robot"  # 최종 WebSocket 엔드포인트
current_line_id: int | None = None
recording = False


async def connect_with_retry():
    """서버 접속을 시도하고, 끊기면 3초 후 자동 재접속"""
    while True:
        try:
            print(f"[RPi5] 서버 연결 시도 중... {SERVER_URL}")
            async with websockets.connect(SERVER_URL) as ws:
                print("[RPi5] ✅ 서버 연결 성공")
                # 서버가 재시작돼도 웹 표시가 실제 볼륨과 맞도록 현재 값을 알려줌
                await ws.send(json.dumps({"type": "volume_state", "volume": current_volume}))
                await handle_messages(ws)
        except Exception as e:
            print(f"[RPi5] ❌ 연결 실패: {e}")
            print("[RPi5] 3초 후 재시도...")
            await asyncio.sleep(3)


async def handle_messages(ws):
    """서버 메시지를 type별로 분기 처리"""
    global current_line_id
    async for raw in ws:
        msg = json.loads(raw)
        msg_type = msg.get("type")
        print(f"[RPi5] 📨 수신: type={msg_type}")
        if msg_type == "speak":
            current_line_id = msg["line_id"]
            audio_bytes = base64.b64decode(msg["audio_b64"])
            emotion = msg["emotion"]
            visemes = msg.get("visemes", [])   # 서버가 안 보내면 빈 리스트 → 뻐끔거림으로 폴백
            await on_speak(ws, audio_bytes, emotion, visemes)
        elif msg_type == "standby":
            await on_standby(ws)
        elif msg_type == "end_recording":
            stop_event.set()
            await asyncio.sleep(0.1)  # 스레드 멈출 시간
            for pin in LED_PINS:
                lgpio.gpio_write(h, pin, 0)
            print("[RPi5] 🔴 녹음 종료 — LED 꺼짐")
        elif msg_type == "set_volume":
            v = apply_volume(msg.get("volume", 100))
            print(f"[RPi5] 🔈 볼륨 변경: {v}%")
        elif msg_type == "end_session":
            await on_end_session()
        else:
            print(f"[RPi5] ⚠️  알 수 없는 타입: {msg_type}")


def wav_duration(audio_bytes: bytes) -> float:
    """WAV 헤더를 읽어 실제 재생 길이(초)를 계산한다. 포맷·헤더 크기가 바뀌어도 정확함."""
    try:
        with wave.open(io.BytesIO(audio_bytes)) as w:
            return w.getnframes() / w.getframerate()   # 총 프레임 수 ÷ 샘플레이트
    except (wave.Error, EOFError):
        # 헤더 파싱 실패 시 고정식으로 대체 (16kHz/16bit/모노 가정)
        return max(0.0, (len(audio_bytes) - 44) / (16000 * 2))


async def on_speak(ws, audio_bytes: bytes, emotion: str, visemes=None):
    """TTS 음성 재생 + 감정별 서보 동작 + LCD 립싱크를 동시에 수행"""
    print(f"[RPi5] 🔊 speak 처리 — emotion={emotion}, {len(audio_bytes):,} bytes, viseme {len(visemes or [])}개")
    set_leds(0)
    speak_stop.clear()   # 이전 중단 신호 초기화

    # WAV 헤더 기반 재생 시간 계산
    duration = wav_duration(audio_bytes)

    # 감정별 서보 1회 동작 시간(초) — servo_controller.perform()의 실제 1회 소요 시간 기준
    # 이 값이 실제보다 작으면 반복 횟수가 과하게 계산되어 말이 끝난 뒤에도 서보가 움직임
    action_duration = {
        "joy": 1.0,
        "surprise": 1.6,
        "anger": 1.0,
        "sadness": 2.0,
        "fear": 2.0,
        "disgust": 1.0,
        "neutral": 0.0,
    }
    one_action = action_duration.get(emotion, 0.6)
    repeat_times = max(1, int(duration / one_action)) if one_action > 0 else 1
    print(f"[RPi5] 재생 시간: {duration:.2f}초, 서보 반복: {repeat_times}회")

    audio_bytes = apply_gain(audio_bytes)   # 100% 초과 증폭 (또는 믹서 없는 스피커의 볼륨 조절)

    # WAV 임시 파일 저장
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        # aplay 실행 직후 시각을 립싱크 기준점(t0)으로 기록
        proc = subprocess.Popen(['aplay', '-q', '-D', 'plughw:0,0', tmp_path])
        t0 = time.monotonic()

        # 서보 동작 + viseme 립싱크 + aplay 종료 대기를 동시에 진행
        await asyncio.gather(
            asyncio.to_thread(perform, emotion, repeat_times),
            asyncio.to_thread(animate_visemes, visemes, duration, t0, speak_stop),
            asyncio.to_thread(proc.wait),   # 소리가 실제로 끝날 때까지 대기
        )
    finally:
        # 재생이 끝났거나 예외가 나도 임시 파일은 반드시 삭제
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    reset()


async def on_standby(ws):
    """대기 상태: 서보·입 모양 초기화 후 녹음 레벨 LED 모니터링 시작"""
    print("[RPi5] ⏳ standby — LED 모니터링 시작")
    reset()
    close_mouth()
    # blocking 없이 백그라운드 스레드로 실행
    threading.Thread(target=monitor_led, daemon=True).start()


def monitor_led():
    """마이크 입력 RMS를 읽어 LED로 녹음 레벨 표시 (stop_event가 set되면 종료)"""
    stop_event.clear()
    with sd.InputStream(samplerate=16000, channels=1, dtype='int16') as stream:
        while not stop_event.is_set():
            data, _ = stream.read(320)
            rms = float(np.sqrt(np.mean(data.astype(np.float32) ** 2))) / 32768.0
            if rms < 0.01:   set_leds(0)
            elif rms < 0.05: set_leds(1)
            elif rms < 0.15: set_leds(2)
            else:             set_leds(3)


async def on_end_session():
    """세션 종료: 진행 중인 입 애니메이션 중단, 서보·입 모양 초기화"""
    print("[RPi5] 🏁 세션 종료")
    speak_stop.set()   # 진행 중인 입 애니메이션 중단
    set_leds(0)
    reset()
    close_mouth()


if __name__ == "__main__":
    load_saved_volume()                    # 저장된 볼륨 복원 후 서버 접속
    asyncio.run(connect_with_retry())