# RPi5 WebSocket 클라이언트
# ─────────────────────────────────────────────────────────────
# 서버(FastAPI)와 WebSocket으로 연결해 로봇 동작을 수행한다.
#   speak        : TTS 음성 재생 + 서보 고갯짓 + LCD viseme 립싱크
#   standby      : 사용자 차례 시작 (LCD 발화 파형 표시)
#   end_recording: 녹음 종료 (파형 끄고 다문 입 복귀)
#   set_volume   : 스피커 볼륨 변경 (웹 슬라이더)
#   end_session  : 세션 종료 (서보·입 모양 초기화)
# 실행: python -u ws_client.py   (핫스팟 환경: SERVER_HOST=192.168.137.1 python -u ws_client.py)
# ─────────────────────────────────────────────────────────────
from servo_controller import speak_motion, listen, release, reset   # v2 모션 엔진 (50Hz 백그라운드 스레드)
from lcd_mouth import animate_visemes, close_mouth, show_wave, WAVE_BARS   # 파형 표시 추가
import math                          # dB 변환용
from collections import deque        # 파형 기록용
import asyncio
import json
import base64
import websockets
import subprocess
import tempfile
import io
import sounddevice as sd
import numpy as np
import threading
import os
import re
import time      # aplay 시작 시각(t0) 기록용 — 립싱크 기준점
import wave      # WAV 헤더에서 재생 길이 계산, 볼륨 증폭

stop_event = threading.Event()    # 발화 파형(monitor_mic) 스레드 중단용
speak_stop = threading.Event()    # 입 애니메이션 중단용 (stop_event와 분리)

# ─────────────────────────────────────────────────────────────
# 볼륨 제어: 0~100%는 ALSA 믹서(PCM), 100% 초과는 소프트웨어 증폭
# ─────────────────────────────────────────────────────────────
VOLUME_FILE = os.path.expanduser("~/.robot_volume")   # 마지막 볼륨 저장 위치 (재부팅 후 유지)
ALSA_CARD = os.getenv("SPEAKER_CARD", "UACDemoV10")   # 카드 번호 대신 이름으로 지정 — USB 재연결·재부팅 시 번호가 바뀜 (2026-11-03 0→1)
ALSA_DEVICE = f"plughw:CARD={ALSA_CARD},DEV=0"      # aplay 재생 장치
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
            intensity = float(msg.get("intensity", 1.0))   # 감정 세기 (서버가 confidence 기반으로 보내면 반영, 없으면 1.0)
            await on_speak(ws, audio_bytes, emotion, visemes, intensity)
        elif msg_type == "standby":
            await on_standby(ws)
        elif msg_type == "end_recording":
            await asyncio.to_thread(stop_wave)    # 파형 종료 → 다문 입으로 복귀
            print("[RPi5] 🔴 녹음 종료 — 파형 종료")
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


async def on_speak(ws, audio_bytes: bytes, emotion: str, visemes=None, intensity: float = 1.0):
    """TTS 음성 재생 + 감정별 서보 동작 + LCD 립싱크를 동시에 수행"""
    print(f"[RPi5] 🔊 speak 처리 — emotion={emotion}, {len(audio_bytes):,} bytes, viseme {len(visemes or [])}개")
    await asyncio.to_thread(stop_wave)    # 파형이 켜져 있으면 끄고 LCD를 입 모양에 넘김
    speak_stop.clear()   # 이전 중단 신호 초기화

    # WAV 헤더 기반 재생 시간 계산
    duration = wav_duration(audio_bytes)

    # v2: 서보는 재생 시간 동안 엔진이 연속 제어 → 반복 횟수 계산(action_duration) 불필요
    print(f"[RPi5] 재생 시간: {duration:.2f}초")

    motion_src = audio_bytes                # 비트 추출용 원본 (증폭 전 — 클리핑 없는 포락선)
    audio_bytes = apply_gain(audio_bytes)   # 100% 초과 증폭 (또는 믹서 없는 스피커의 볼륨 조절)

    # WAV 임시 파일 저장
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        # aplay 실행 직후 시각을 립싱크 기준점(t0)으로 기록
        proc = subprocess.Popen(['aplay', '-q', '-D', ALSA_DEVICE, tmp_path])
        t0 = time.monotonic()

        # 서보 동작 + viseme 립싱크 + aplay 종료 대기를 동시에 진행
        # 서보 동작 + viseme 립싱크 + aplay 종료 대기를 동시에 진행
        n_beats, _, _ = await asyncio.gather(   # 첫 번째 반환값 = speak_motion이 잡은 비트 개수
            asyncio.to_thread(speak_motion, emotion, motion_src, duration, t0, speak_stop, intensity),  # 같은 t0 → 립싱크와 비트 동기
            asyncio.to_thread(animate_visemes, visemes, duration, t0, speak_stop),
            asyncio.to_thread(proc.wait),   # 소리가 실제로 끝날 때까지 대기
        )
        print(f"[RPi5] 🎵 비트 {n_beats}개 / {duration:.2f}초")   # 강세 추출 확인용 로그
    finally:
        # 재생이 끝났거나 예외가 나도 임시 파일은 반드시 삭제
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    release()   # 대사 끝 → 감정 자세에서 중립으로 천천히 복귀 (non-blocking)


async def on_standby(ws):
    print("[RPi5] ⏳ standby — 사용자 발화 파형 표시 시작")
    listen()              # 경청 자세 (v1 reset()은 1.5초 blocking → 파형 시작이 늦었음)
    start_wave()          # LCD에 사용자 발화 파형 표시 시작


# ─────────────────────────────────────────────────────────────
# 사용자 발화 파형: standby~end_recording 동안 마이크 소리 크기를 LCD에 막대로 표시
# ─────────────────────────────────────────────────────────────
MIC_SAMPLERATE = 16000     # USB 마이크 입력 샘플레이트 (Invalid sample rate 에러가 나면 22050으로 변경)
WAVE_FPS = 15              # 화면 갱신 목표 (LCD 한계가 약 13fps라 그 이상은 의미 없음)
NOISE_MARGIN_DB = 3.0      # 주변 소음보다 이만큼 커지면 막대가 올라가기 시작 (조용할 때 흔들리면 키우기)
WAVE_RANGE_DB = 24.0       # 무음 기준 + 이 값(dB)에서 막대 최대 (크게 말해도 낮으면 줄이기)
WAVE_CURVE = 0.4           # 1보다 작을수록 작은 소리를 크게 보여줌 (작은 목소리 반응 강화)
NOISE_WINDOW = 45          # 최근 몇 프레임(약 3초)을 보고 주변 소음을 다시 추정할지
WAVE_DEBUG = False         # True: 매 프레임 dB·기준·막대 높이 출력 (조정용)
_noise_db = -60.0          # 주변 소음(dB) — 시작 시 calibrate_noise()로 측정, 세션마다 갱신되어 유지
_wave_thread = None


def _block_db(x) -> float:
    """오디오 블록 하나의 크기(dB). DC 오프셋(평균값)을 빼서 무음일 때 값이 떠 있지 않게 함."""
    x = x.astype(np.float32)
    x -= x.mean()
    rms = float(np.sqrt(np.mean(x * x))) / 32768.0
    return max(-90.0, 20 * math.log10(rms + 1e-9))   # 순간적인 0 신호로 기준이 바닥까지 떨어지는 것 방지


def calibrate_noise(seconds: float = 0.6) -> None:
    """프로그램 시작 시 한 번 주변 소음을 측정 → 첫 세션부터 학습 대기 없이 바로 정확한 기준 사용"""
    global _noise_db
    try:
        rec = sd.rec(int(MIC_SAMPLERATE * seconds), samplerate=MIC_SAMPLERATE, channels=1, dtype='int16')
        sd.wait()
        block = MIC_SAMPLERATE // 50                                    # 20ms 단위로 나눠 측정
        dbs = [_block_db(rec[i:i + block, 0]) for i in range(0, len(rec) - block + 1, block)]
        _noise_db = float(np.percentile(dbs, 20))                       # 하위 20%: 순간 잡음에 덜 흔들림
        print(f"[RPi5] 🎙️ 주변 소음 측정: {_noise_db:.1f} dB")
    except Exception as e:
        print(f"[RPi5] ⚠️ 주변 소음 측정 실패 (기본값 {_noise_db:.0f} dB 사용): {e}")


def monitor_mic():
    """마이크 입력을 읽어 LCD에 파형을 그린다. stop_event가 set되면 종료 (입 복귀는 stop_wave가 담당)."""
    global _noise_db
    peak = [-90.0]                                   # 콜백과 공유: 직전 프레임 이후 최대 dB

    def on_audio(indata, frames, t, status):
        peak[0] = max(peak[0], _block_db(indata[:, 0]))

    history = deque([0.0] * WAVE_BARS, maxlen=WAVE_BARS)   # 오른쪽 끝이 최신, 왼쪽으로 흘러감
    # 이전에 측정한 소음 값으로 미리 채워 둠 → 세션 시작 직후 바로 말해도 기준이 흔들리지 않음
    recent_db = deque([_noise_db] * NOISE_WINDOW, maxlen=NOISE_WINDOW)
    smooth = 0.0
    stream = None
    try:
        stream = sd.InputStream(samplerate=MIC_SAMPLERATE, channels=1, dtype='int16',
                                blocksize=MIC_SAMPLERATE // 50, callback=on_audio)   # 20ms 블록
        stream.start()
        while not stop_event.is_set():
            t_frame = time.monotonic()
            db = peak[0]
            peak[0] = -90.0
            recent_db.append(db)

            # 최근 약 3초 중 조용한 쪽(하위 10%) = 현재 주변 소음 → 장소가 바뀌어도 서서히 적응
            noise = float(np.percentile(recent_db, 10))
            raw = max(0.0, min(1.0, (db - noise - NOISE_MARGIN_DB) / WAVE_RANGE_DB))
            level = raw ** WAVE_CURVE                # 작은 소리도 눈에 띄게 키움
            if WAVE_DEBUG:
                print(f"[wave] {db:6.1f} dB  noise {noise:6.1f}  level {level:.2f}")

            # 올라갈 땐 즉시, 내려갈 땐 천천히 → 막대가 깜빡이지 않고 자연스럽게 줄어듦
            smooth = level if level > smooth else smooth * 0.55 + level * 0.45
            history.append(smooth)
            if stop_event.is_set():                  # 그리기 직전에 종료 요청이 왔으면 그리지 않음
                break
            show_wave(list(history))
            stop_event.wait(max(0.0, 1 / WAVE_FPS - (time.monotonic() - t_frame)))
        _noise_db = float(np.percentile(recent_db, 10))   # 이번 세션에서 추정한 소음을 다음 세션 기준으로 저장
    except Exception as e:
        print(f"[RPi5] ⚠️ 마이크 파형 오류: {e}")     # 마이크가 없어도 로봇 전체가 멈추지 않게
    finally:
        if stream is not None:
            try:
                stream.abort()                       # stop()과 달리 남은 버퍼를 기다리지 않고 즉시 끊음
                stream.close()
            except Exception:
                pass


def start_wave():
    """파형 표시 시작 (이미 돌고 있으면 정리 후 새로 시작)"""
    global _wave_thread
    stop_wave(restore_mouth=False)                   # 바로 다시 파형을 그릴 거라 입 복귀는 생략
    stop_event.clear()
    _wave_thread = threading.Thread(target=monitor_mic, daemon=True)
    _wave_thread.start()


def stop_wave(restore_mouth: bool = True):
    """파형 표시 종료 → 스레드가 완전히 끝난 뒤 다문 입으로 복귀 (순서 보장)"""
    global _wave_thread
    stop_event.set()
    if _wave_thread is not None:
        _wave_thread.join(timeout=3.0)               # 스트림 정리까지 충분히 기다림
        if _wave_thread.is_alive():
            print("[RPi5] ⚠️ 파형 스레드가 3초 안에 종료되지 않음")
        _wave_thread = None
        if restore_mouth:
            close_mouth()                            # 파형 화면을 지우고 다문 입 표시


async def on_end_session():
    """세션 종료: 진행 중인 입 애니메이션 중단, 서보·입 모양 초기화"""
    print("[RPi5] 🏁 세션 종료")
    await asyncio.to_thread(stop_wave)    # 파형이 켜져 있으면 끄고 LCD를 입 모양에 넘김
    speak_stop.set()   # 진행 중인 입 애니메이션 중단
    reset()
    close_mouth()


if __name__ == "__main__":
    load_saved_volume()                    # 저장된 볼륨 복원
    calibrate_noise()                      # 주변 소음 측정 (0.6초, 이때는 조용히)
    asyncio.run(connect_with_retry())