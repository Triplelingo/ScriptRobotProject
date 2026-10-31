# RPi5 WebSocket 클라이언트
from servo_controller import perform, reset

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

import time      # aplay 시작 시각(t0) 기록용
import wave      # WAV 헤더에서 실제 재생 길이 계산
import os        # 재생 끝난 임시 파일 삭제, 환경변수(SERVER_HOST, SERVER_PORT) 읽기용
from lcd_mouth import animate_visemes, close_mouth   # 기존 animate_speaking import 줄을 이것으로 교체

# 입 애니메이션 중단용 이벤트 (LED 모니터링용 stop_event와 분리)
speak_stop = threading.Event()


# LED 핀 설정
LED_PINS = [13, 6, 26]
h = lgpio.gpiochip_open(0)
for pin in LED_PINS:
    lgpio.gpio_claim_output(h, pin)
    lgpio.gpio_write(h, pin, 0)

def set_leds(count):
    for i, pin in enumerate(LED_PINS):
        lgpio.gpio_write(h, pin, 1 if i < count else 0)

# 서버 주소: 환경변수로 호스트·포트를 바꿀 수 있게 구성 (미지정 시 집 노트북 IP 사용)
SERVER_HOST = os.getenv("SERVER_HOST", "192.168.0.108")  # 핫스팟 환경에서는 192.168.137.1로 지정
SERVER_PORT = os.getenv("SERVER_PORT", "8000")           # FastAPI(uvicorn) 포트
SERVER_URL = f"ws://{SERVER_HOST}:{SERVER_PORT}/ws/robot"  # 최종 WebSocket 엔드포인트
current_line_id: int | None = None
recording = False

async def connect_with_retry():
    while True:
        try:
            print(f"[RPi5] 서버 연결 시도 중... {SERVER_URL}")
            async with websockets.connect(SERVER_URL) as ws:
                print("[RPi5] ✅ 서버 연결 성공")
                await handle_messages(ws)
        except Exception as e:
            print(f"[RPi5] ❌ 연결 실패: {e}")
            print("[RPi5] 3초 후 재시도...")
            await asyncio.sleep(3)

async def handle_messages(ws):
    global current_line_id
    async for raw in ws:
        msg = json.loads(raw)
        msg_type = msg.get("type")
        print(f"[RPi5] 📨 수신: type={msg_type}")
        if msg_type == "speak":
            current_line_id = msg["line_id"]
            audio_bytes = base64.b64decode(msg["audio_b64"])
            emotion = msg["emotion"]
            visemes = msg.get("visemes", [])   # 서버가 아직 안 보내면 빈 리스트 → 기존 뻐끔거림으로 폴백
            await on_speak(ws, audio_bytes, emotion, visemes)
        elif msg_type == "standby":
            await on_standby(ws)
        elif msg_type == "end_recording":
            stop_event.set()
            await asyncio.sleep(0.1)  # 스레드 멈출 시간
            for pin in LED_PINS:
                lgpio.gpio_write(h, pin, 0)
            print("[RPi5] 🔴 녹음 종료 — LED 꺼짐")
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
        # 헤더 파싱 실패 시 기존 고정식으로 대체 (16kHz/16bit/모노 가정)
        return max(0.0, (len(audio_bytes) - 44) / (16000 * 2))

async def on_speak(ws, audio_bytes: bytes, emotion: str, visemes=None):
    print(f"[RPi5] 🔊 speak 처리 — emotion={emotion}, {len(audio_bytes):,} bytes, viseme {len(visemes or [])}개")
    set_leds(0)
    speak_stop.clear()   # 이전 중단 신호 초기화

    # WAV 헤더 기반 재생 시간 계산
    duration = wav_duration(audio_bytes)

    # 감정별 서보 1회 동작 시간 (기존 값 유지)
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
    print("[RPi5] ⏳ standby — LED 모니터링 시작")
    reset()
    close_mouth()
    # blocking 없이 백그라운드 스레드로 실행
    threading.Thread(target=monitor_led, daemon=True).start()

def monitor_led():
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
    print("[RPi5] 🏁 세션 종료")
    speak_stop.set()   # 진행 중인 입 애니메이션 중단
    set_leds(0)
    reset()
    close_mouth()
    

if __name__ == "__main__":
    asyncio.run(connect_with_retry())   # 서버 접속 + 메시지 수신 루프 시작