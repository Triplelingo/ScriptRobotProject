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
stop_event = threading.Event()


# LED 핀 설정
LED_PINS = [13, 6, 26]
h = lgpio.gpiochip_open(0)
for pin in LED_PINS:
    lgpio.gpio_claim_output(h, pin)
    lgpio.gpio_write(h, pin, 0)

def set_leds(count):
    for i, pin in enumerate(LED_PINS):
        lgpio.gpio_write(h, pin, 1 if i < count else 0)

# 서버 주소
SERVER_URL = "ws://192.168.0.108:8000/ws/robot"
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
            await on_speak(ws, audio_bytes, emotion)
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

async def on_speak(ws, audio_bytes: bytes, emotion: str):
    print(f"[RPi5] 🔊 speak 처리 — emotion={emotion}, {len(audio_bytes):,} bytes")
    set_leds(0)

    # WAV 재생 시간 계산
    duration = (len(audio_bytes) - 44) / (16000 * 2)

    #감정 별 동작 시간 
    action_duration = {
        "joy": 0.6,
        "surprise": 1.6,  # 올림
        "anger": 0.6,
        "sadness": 1.8,   # 올림
        "fear": 1.8,      # 올림
        "disgust": 0.6,
        "neutral": 0.0,
    }
    one_action = action_duration.get(emotion, 0.6)
    repeat_times = max(1, int(duration / one_action)) if one_action > 0 else 1
    print(f"[RPi5] 재생 시간: {duration:.2f}초, 서보 반복: {repeat_times}회")

    # WAV 임시 파일 저장 후 aplay로 재생
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    subprocess.Popen(['aplay', '-D', 'plughw:0,0', tmp_path])
    await asyncio.to_thread(perform, emotion, repeat_times)
    reset()

async def on_standby(ws):
    print("[RPi5] ⏳ standby — LED 모니터링 시작")
    reset()
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
    set_leds(0)
    reset()

if __name__ == "__main__":
    asyncio.run(connect_with_retry())
