"""
servo_controller.py — 3축 서보 모션 엔진 (v2)

[v1 대비 구조 변경]
  v1: 감정마다 '같은 왕복 동작'을 N회 반복 → 매 구간 끝에서 속도 0으로 멈췄다 출발(뚝뚝 끊김),
      한 번에 한 축만 사용, 말소리와 무관한 박자, neutral은 완전 정지.
  v2: 50Hz 백그라운드 스레드가 매 틱마다 아래 레이어를 합성해서 3축에 동시에 출력한다.

      최종 각도 = 중립각 + DIR × [ 스프링(자세 + 드리프트)      ← 감정별 '기본 자세'로 부드럽게 수렴
                                   + 제스처(키프레임 스플라인)   ← 대사 시작 시 1회성 감정 동작
                                   + 비트(음성 강세 동기 끄덕임)  ← TTS 음량 피크에 맞춘 작은 고갯짓
                                   + 아이들(호흡·미세 흔들림)     ← 기본 비활성 (IDLE_GAIN = 0, 아래 참고)
                                   + 떨림(fear 전용, PAN만) ]
                  → 속도 제한(°/s) → 가동 범위 클램프 → PCA9685 쓰기

[하드웨어 제약 — 2026-11-03 실측, 되돌리지 말 것]
  DS3120 데드밴드(3us ≈ 0.27°) 때문에 약 15°/s 이하의 '느린 이동'은 서보 내부에서
  멈춤→툭이 반복되어 지지직 진동이 남 (유지 중에는 떨림 없음, 40°/s 일정속도는 깔끔).
  → 3축 모두 이동 시 최소 속도 보장(TERM_SPEED), 1~2° 크기의 느린 미세동작은 제거.
     표현은 '감정별 자세를 빠르게 바꾸고 유지' + 'PAN 비트 끄덕임' + '빠른 제스처·시선 이동'으로 한다.
  → 새 동작을 넣을 때도 1회 이동량 3° 이상·속도 25°/s 이상을 유지할 것.

[축 정의 — 기존 이름 유지]
  CH0 TILT : 고개 갸웃(좌우 기울기)   CH1 ROLL : 좌우 회전   CH2 PAN : 앞뒤 끄덕임
  코드 내부는 '의미 좌표'(중립 대비 편차 °)로 계산하고, 실제 서보 방향은 DIR_* 부호로 변환한다.

[외부 API — ws_client.py에서 사용]
  speak_motion(emotion, audio_bytes, duration, t0, stop_event, intensity)  # blocking, to_thread용
  listen()    # 사용자 발화 대기 자세 (non-blocking)
  release()   # 대사 끝난 뒤 중립으로 천천히 복귀 (non-blocking)
  reset(delay=0.0)  # 중립 복귀 (기본 non-blocking — v1은 1.5초 blocking이었음)
  perform(emotion, times)  # v1 호환용 (단독 데모·테스트에서만 사용)
  shutdown()  # 스레드 종료 + PCA 해제

[단독 실행]
  python servo_controller.py calib   # 축 방향(DIR_*) 확인용: 각 축을 + 방향으로 천천히 이동
  python servo_controller.py demo    # 감정별 모션 데모 (가상 비트 사용)
  python servo_controller.py still   # 떨림 진단: 중립 고정 명령 10초 (이때도 떨리면 전원·기구 문제)
  SERVO_SIM=1 python servo_controller.py demo   # 하드웨어 없이 로직만 실행
"""

import io            # WAV 바이트 → 파일 객체 변환
import os            # SERVO_SIM 환경변수 확인
import sys           # 단독 실행 인자 처리
import math          # 삼각함수 (아이들·비트 파형)
import time          # monotonic 시계 (재생 기준점과 동일 시계 사용)
import wave          # TTS WAV 헤더·샘플 파싱
import bisect        # 현재 시각 근처 비트만 빠르게 탐색
import random        # 비트·드리프트 변주 (매번 같은 동작이 나오지 않게)
import threading     # 50Hz 제어 루프 스레드

import numpy as np   # 음성 포락선(envelope) 계산

# =========================================================
# 하드웨어 초기화 — SERVO_SIM=1 이면 가짜 서보로 대체 (노트북 시뮬레이션용)
# =========================================================
SIM = os.getenv("SERVO_SIM") == "1"

# PWM 주파수: 높일수록 각도 분해능↑ (PCA9685 12bit = 주기/4096)
#   50Hz → 1 count 0.44°  |  100Hz → 0.22°  |  200Hz → 0.11°
#   50Hz에선 중간 속도(5~20°/s) 이동이 0/1 count 불규칙 계단으로 들어가 '지지직' 진동 발생.
#   DS3120 판매 페이지엔 주파수 사양 없음(같은 계열 DS3235는 50~330Hz 명시) → 실측 확인 후 기본값 변경
#   테스트: SERVO_PWM_HZ=100 python servo_controller.py demo joy
PWM_HZ = int(os.getenv("SERVO_PWM_HZ", "50"))

if not SIM:
    import board                                  # Blinka 핀 추상화
    import busio                                  # I²C 버스
    from adafruit_pca9685 import PCA9685          # PWM 드라이버
    from adafruit_motor import servo              # 각도 → 듀티 변환 래퍼

    # 400kHz: 루프 100Hz × 3채널 쓰기를 여유 있게 처리 (기본 100kHz는 틱당 I²C 시간이 김)
    i2c = busio.I2C(board.SCL, board.SDA, frequency=400000)   # SDA=GPIO2, SCL=GPIO3
    pca = PCA9685(i2c)                            # 기본 주소 0x40
    pca.frequency = PWM_HZ                        # ⚠ Servo 객체 생성 전에 설정해야 펄스폭→듀티 환산이 이 주파수 기준으로 됨

    # DS3120 실측 펄스폭 500~2500us (기본값 750~2250us면 각도 매핑 어긋남 — CLAUDE.md 참고)
    _DS3120_PULSE = {"min_pulse": 500, "max_pulse": 2500}
    servo_tilt = servo.Servo(pca.channels[0], actuation_range=180, **_DS3120_PULSE)  # CH0 갸웃
    servo_roll = servo.Servo(pca.channels[1], actuation_range=180, **_DS3120_PULSE)  # CH1 회전
    servo_pan  = servo.Servo(pca.channels[2], actuation_range=180, **_DS3120_PULSE)  # CH2 끄덕임
else:
    pca = None

    class _FakeServo:                             # angle 속성만 흉내 내는 더미
        angle = None

    servo_tilt, servo_roll, servo_pan = _FakeServo(), _FakeServo(), _FakeServo()

# =========================================================
# 보정 상수 — 재조립 시 이 블록만 수정
# =========================================================
NEUTRAL_TILT = 80    # 2026-09 DS3120 교체 후 실측 중립각
NEUTRAL_ROLL = 99
NEUTRAL_PAN  = 70

# 의미 좌표 +방향 → 실제 서보 각도 증감 부호. `calib` 모드로 눈으로 확인 후 맞출 것
#   pan  + : 고개를 든다(턱이 위로)        - : 숙인다
#   roll + : 로봇 기준 왼쪽으로 돌린다
#   tilt + : 로봇 기준 왼쪽으로 갸웃한다
DIR = {"pan": +1, "roll": +1, "tilt": -1}   # 2026-11-03 calib 결과 tilt 반전

# 중립 대비 최대 편차(°) — 프레임 간섭·케이블 당김 방지용 소프트 리밋
LIMIT = {"pan": 22.0, "roll": 35.0, "tilt": 18.0}

MAX_SPEED  = 300.0   # 축당 최대 각속도(°/s). DS3120 무부하 약 400°/s@5V → 여유 두고 제한
UPDATE_HZ  = min(PWM_HZ, 100)   # 제어 루프 주기: PWM 주기보다 빠를 필요는 없고, Python 스레드로는 100Hz가 현실적 상한
DEG_PER_COUNT = (1e6 / PWM_HZ / 4096) / (2000 / 180)   # PCA9685 1 count가 몇 도인지 (DS3120 500~2500us/180° 기준)
WRITE_EPS  = DEG_PER_COUNT * 0.9   # 1 count 바뀔 만큼 변하면 바로 씀 — 고정값(0.15°)이면 200Hz에서 1 count(0.11°)를 막아 분해능 이득이 사라짐

# ── 정지 유지(히스테리시스) ──────────────────────────────────────
# PCA9685 해상도 한계: 50Hz에서 1 count = 4.88us ≈ 0.44° (DS3120 500~2500us 기준).
# 천천히 변하는 명령(아이들·드리프트 꼬리)은 0.44°씩 '툭툭' 끊겨 들어가고,
# 토크 큰 디지털 서보가 무거운 머리를 매번 급정지시키며 진동(덜덜)이 생김.
# → 명령이 느릴 때는 HOLD_BAND 안의 변화를 무시하고 현재 위치를 그대로 유지한다.
HOLD_BAND  = 1.0     # 느린 구간에서 무시할 변화 폭(°). 키우면 정지 해제 순간 한 번에 그만큼 점프하므로 1.0 이하 유지
HOLD_SPEED = 4.0     # 명령 각속도가 이보다 느리면(°/s) '정지 중'으로 간주
# ── 종단 접근 ──────────────────────────────────────────────────
# 스프링은 목표 근처에서 지수적으로 느려져 '기어가는' 꼬리가 생김 → 0.44° 계단이 띄엄띄엄 들어가
# 중력 부하가 걸린 축(특히 TILT)이 매 계단마다 버벅이며 진동. 목표 TERM_BAND 이내에서는
# 최소 TERM_SPEED로 직선 접근해 짧게 끝내고 정확히 멈춘다.
# 이 거리(°) 이내부터 최소 속도 보장. inf = 이동 전 구간 (중력 부하 축: tilt·pan — 2026-11-03 저속 떨림 실측)
TERM_BAND  = {"pan": float("inf"), "roll": float("inf"), "tilt": float("inf")}   # 3축 모두 저속 떨림 실측 (roll은 약하게)
# 최소 속도(°/s). pan: 일정속도 테스트에서 15°/s가 깔끔했다면 20까지 낮춰 sadness의 '숙임'을 더 느리게 할 수 있음
TERM_SPEED = {"pan": 35.0, "roll": 25.0, "tilt": 35.0}   # roll은 중력 부하가 없어 조금 낮게 — 떨리면 35까지

# ── TILT 전용 제약 (2026-11-03 실측) ─────────────────────────────
# TILT는 머리 무게를 옆으로 받치는 축 → 저속(약 15°/s 이하) 이동 시 DS3120 데드밴드(3us ≈ 0.27°) 때문에
# '멈춤→툭' 반복이 생겨 지지직 진동. 일정속도 테스트: 5°/s 떨림, 40°/s 깔끔. 유지 중엔 떨림 없음.
# → TILT는 '느리게 움직이지 않는다': 이동은 항상 TERM_SPEED["tilt"] 이상, 작은 변동(비트 변주·드리프트·제스처)은 제거.
#   감정별 기울기(자세)만 빠르게 바꾸고 유지하는 방식으로 표현한다.
ROLL_BEAT_SIDE = 0.0  # 비트에 섞이는 회전 변주 배율 — 1~2° bump는 전 구간이 저속이라 떨림 → 제거 (2026-11-03)
TILT_DETAIL = 0.0    # 비트·제스처의 tilt 성분 배율 (0 = 제거). 1.0으로 되돌리면 이전 동작
RELAX_W    = 6.0     # 대사 종료 후 중립 복귀 스프링 w (기존 3.0은 너무 느려 꼬리가 길었음)
IDLE_GAIN  = 0.0     # 아이들 미세 흔들림 배율. 0.44° 분해능에선 1° 이하 흔들림이 떨림으로 보여 기본 비활성
                     # (떨림 해결 확인 후 0.5부터 올려 보며 판단)
BEAT_LEAD  = 0.08    # 비트 정점을 음량 피크보다 이만큼(초) 먼저 — 사람 고갯짓은 강세보다 약간 앞섬 + 기계 지연 보상
BEAT_WIDTH = 0.28    # 비트 1회 길이(초)

AXES = ("pan", "roll", "tilt")
NEUTRAL = {"pan": NEUTRAL_PAN, "roll": NEUTRAL_ROLL, "tilt": NEUTRAL_TILT}
SERVOS  = {"pan": servo_pan, "roll": servo_roll, "tilt": servo_tilt}

# =========================================================
# 감정 프로파일
#   posture  : 기본 자세 (pan, roll, tilt) — 대사 동안 유지되는 '태도'
#   w, zeta  : 자세 스프링 고유진동수(rad/s)·감쇠비. w↑ 기민, zeta<1 약간 튕김(활기), zeta=1 묵직
#   beat_amp : 강세 1회당 끄덕임 깊이(°),  beat_side : 끄덕일 때 섞이는 회전·갸웃 변주(°)
#   beat_rate: 초당 최대 비트 수 (sadness는 드물게, joy는 자주)
#   drift    : 자세 주변을 천천히 떠도는 시선 이동 폭(°),  drift_iv : 재목표 간격(초) 범위
#   idle_amp : 호흡·미세 흔들림 폭(°),  idle_speed : 그 속도 배율
#   tremor   : 떨림 폭(°) — 스프링 뒤에 더해져서 감쇠되지 않음
#   onset    : 대사 시작 제스처 키프레임 [(t초, pan, roll, tilt), ...] — 0에서 시작해 0으로 끝남
# =========================================================
PROFILES = {
    "neutral": dict(
        posture=(0, 0, 0), w=6.0, zeta=0.95,
        beat_amp=4.0, beat_side=1.2, beat_rate=1.8,      # 2026-11-03: 3→4 (밋밋함 보완, 정점 약 45°/s)
        drift=3.0, drift_iv=(1.2, 3.0), idle_amp=1.0, idle_speed=1.0, tremor=0.0,   # 2026-11-03: drift_iv (1.8,4.0)→(1.2,3.0) 시선 이동 더 자주
        onset=None,
    ),
    "joy": dict(  # 턱 살짝 들고 갸웃, 탄력 있는 잦은 끄덕임
        posture=(4, 0, 5), w=9.0, zeta=0.65,
        beat_amp=5.0, beat_side=2.0, beat_rate=2.5,
        drift=4.0, drift_iv=(1.2, 3.0), idle_amp=1.2, idle_speed=1.3, tremor=0.0,
        onset=[(0.0, 0, 0, 0), (0.13, -7, 0, 2), (0.28, 2, 0, 3), (0.43, -5, 0, 3), (0.65, 0, 0, 0)],
    ),
    "sadness": dict(  # 고개를 떨구고(기울이고) 그대로 머묾 — 비트·도리질 없이 정적
        posture=(-11, 0, -6), w=2.5, zeta=1.0,
        beat_amp=0.0, beat_side=0.6, beat_rate=1.0,   # 2026-11-03: 1.5° 비트는 PAN 저속 이동이 되어 떨림 → 비트 제거
        drift=1.5, drift_iv=(3.0, 6.0), idle_amp=0.6, idle_speed=0.5, tremor=0.0,
        onset=None,   # 2026-11-03: 느린 도리질(약 8°/s, 1초) 제거 — 이 하드웨어에선 저속 떨림. 고개 떨굼(posture)으로 표현
    ),
    "anger": dict(  # 턱 당기고(노려봄) 정지에 가까운 긴장, 강세마다 짧고 날카롭게 찍음
        posture=(-5, 0, 0), w=13.0, zeta=0.85,
        beat_amp=6.0, beat_side=2.5, beat_rate=2.0,
        drift=1.0, drift_iv=(2.5, 5.0), idle_amp=0.3, idle_speed=0.8, tremor=0.0,
        onset=[(0.0, 0, 0, 0), (0.08, -7, 0, 0), (0.26, 0, 0, 0)],   # 2026-11-03: 느린 꼬리(-2°→0) 제거 — PAN 저속 떨림
    ),
    "surprise": dict(  # 순간적으로 젖혀지고 들린 채 유지
        posture=(7, 0, 3), w=11.0, zeta=0.7,
        beat_amp=3.5, beat_side=1.5, beat_rate=2.0,
        drift=3.0, drift_iv=(1.5, 3.0), idle_amp=0.8, idle_speed=1.2, tremor=0.0,   # 2026-11-03: drift 2→3 (작은 drift는 '툭' 경련처럼 보임)
        onset=[(0.0, 0, 0, 0), (0.09, 9, 0, 0), (0.35, 0, 0, 0)],   # 2026-11-03: 9→6→0 느린 하강 제거, 유지는 posture
    ),
    "fear": dict(  # 뒤로 움츠리며 고개를 돌림 + PAN 떨림 + 잦은 시선 이동
        posture=(5, -8, -3), w=10.0, zeta=0.8,
        beat_amp=3.0, beat_side=1.0, beat_rate=1.5,      # 2026-11-03: 2→3 (2는 정점 약 22°/s로 떨림 경계)
        drift=3.0, drift_iv=(0.6, 1.6), idle_amp=0.8, idle_speed=1.5, tremor=0.7,
        onset=[(0.0, 0, 0, 0), (0.1, 6, -6, 0), (0.35, 0, 0, 0)],   # 움찔 후 빠르게 복귀, 돌린 고개 유지는 posture
    ),
    "disgust": dict(  # 고개를 뒤로 빼며 외면
        posture=(4, 10, 5), w=4.0, zeta=1.0,
        beat_amp=3.0, beat_side=1.0, beat_rate=1.2,      # 2026-11-03: 2→3 (떨림 경계 회피)
        drift=1.0, drift_iv=(2.5, 5.0), idle_amp=0.6, idle_speed=0.8, tremor=0.0,
        onset=[(0.0, 0, 0, 0), (0.2, 0, 6, 0), (0.5, 0, 0, 0)],   # 고개 홱 돌리기 → 외면 유지는 posture (느린 꼬리 제거)
    ),
    # 사용자 발화 대기(녹음 중): 중립에서 가만히 — 움직임 없음
    # 2026-11-03: 기존 경청 자세(PAN -2°, TILT +6°)는 최소 속도 때문에 녹음 버튼 누르는 순간 '휙' 이동 → 제거.
    #   천천히 가면 저속 떨림, 빠르게 가면 휙 → 이 하드웨어에선 '움직이지 않는 것'이 가장 자연스러움.
    #   드리프트도 0: 녹음 중 서보 기어 소음이 마이크에 들어가는 것도 막음
    "listen": dict(
        posture=(0, 0, 0), w=4.0, zeta=1.0,
        beat_amp=0.0, beat_side=0.0, beat_rate=1.0,
        drift=0.0, drift_iv=(3.0, 6.0), idle_amp=0.0, idle_speed=0.7, tremor=0.0,
        onset=None,
    ),
}
# 분류기 출력 중 정의 안 된 라벨 대비
for _k in ("fear", "disgust"):
    PROFILES.setdefault(_k, PROFILES["neutral"])


# =========================================================
# 음성 비트 추출 — TTS WAV의 음량 포락선에서 강세(음절 피크) 시각을 뽑는다
# =========================================================
def extract_beats(audio_bytes: bytes, max_rate: float = 2.0, thresh: float = 0.55):
    """
    Returns: [(t초, 세기 0~1), ...]  — 오디오 시작 기준, 시간순 정렬
    max_rate : 초당 최대 비트 수 (강한 피크부터 채택, 간격 1/max_rate 미만은 버림)
    thresh   : 정규화 음량 기준 이 값 이상인 피크만 후보
    """
    try:
        with wave.open(io.BytesIO(audio_bytes)) as w:
            sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
            raw = w.readframes(w.getnframes())
    except (wave.Error, EOFError):
        return []                                         # 헤더 파싱 실패 → 비트 없이 자세·아이들만
    if sw != 2:
        return []                                         # 서버는 16bit PCM만 보냄 (Riff16Khz16BitMonoPcm)

    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)                # 다채널이면 모노로
    hop = sr // 100                                       # 10ms 단위 프레임
    n = len(x) // hop
    if n < 10:
        return []
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-9)
    rms = np.convolve(rms, np.ones(5) / 5, mode="same")   # 50ms 이동평균 → 음절 단위 포락선
    db = 20 * np.log10(rms + 1e-6)
    lo, hi = np.percentile(db, 15), np.percentile(db, 97) # 무음·최대 기준 (TTS 볼륨 차이와 무관하게 정규화)
    env = np.clip((db - lo) / max(hi - lo, 1e-3), 0, 1)

    # 지역 최대값(±80ms 창) 중 기준 이상만 후보
    win = 8
    cand = []
    for i in range(win, n - win):
        seg = env[i - win: i + win + 1]
        if env[i] >= thresh and env[i] == seg.max():
            rise = env[i] - env[max(0, i - 25): i].min()  # 직전 250ms 최저점 대비 상승폭 = 강세 정도
            if rise > 0.2:
                cand.append((i / 100.0, float(min(1.0, 0.4 + rise))))

    # 강한 순서로 채택하되 최소 간격 유지
    gap = 1.0 / max_rate
    picked = []
    for t, s in sorted(cand, key=lambda c: -c[1]):
        if all(abs(t - pt) >= gap for pt, _ in picked):
            picked.append((t, s))
    picked.sort()
    if picked:                                            # 첫 강세(문장 시작)는 조금 더 크게
        picked[0] = (picked[0][0], min(1.0, picked[0][1] * 1.2))
    return picked


# =========================================================
# 보간 유틸
# =========================================================
def _hermite_keyframes(kf, t):
    """
    키프레임 [(t, pan, roll, tilt), ...]를 C1 연속 3차 에르미트 스플라인으로 보간.
    v1의 '구간마다 smoothstep'은 각 키프레임에서 속도가 0이 돼 뚝뚝 끊겼다 → 접선을 이웃 점에서 계산해 통과하며 이어지게 함.
    """
    if t >= kf[-1][0]:
        return None                                       # 마지막 키프레임 이후 = 제스처 종료
    if t <= kf[0][0]:
        return [0.0, 0.0, 0.0]                            # 시작 직후(t=0) 틱 — 종료로 오인하면 제스처가 통째로 사라짐
    i = max(j for j in range(len(kf) - 1) if kf[j][0] <= t)
    t0, t1 = kf[i][0], kf[i + 1][0]
    h = t1 - t0
    u = (t - t0) / h
    h00, h10 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u     # 에르미트 기저 함수
    h01, h11 = -2*u**3 + 3*u**2, u**3 - u**2
    out = []
    for a in range(1, 4):                                 # pan, roll, tilt 각각
        p0, p1 = kf[i][a], kf[i + 1][a]
        # 접선: 양 끝은 0(정지에서 출발·정지로 끝), 내부는 시간 가중 중앙차분
        m0 = 0.0 if i == 0 else (kf[i+1][a] - kf[i-1][a]) / (kf[i+1][0] - kf[i-1][0])
        m1 = 0.0 if i + 1 == len(kf) - 1 else (kf[i+2][a] - kf[i][a]) / (kf[i+2][0] - kf[i][0])
        out.append(h00*p0 + h10*h*m0 + h01*p1 + h11*h*m1)
    return out


def _bump(u):
    """비트 1회 파형: 0→1→0, 양 끝 기울기 0 (sin²) — 겹쳐도 매끄럽게 더해짐"""
    return math.sin(math.pi * u) ** 2 if 0.0 <= u <= 1.0 else 0.0


# =========================================================
# 모션 엔진
# =========================================================
class MotionEngine:
    def __init__(self, seed=None):
        self._lock = threading.Lock()                     # API 호출 스레드 ↔ 제어 루프 공유 상태 보호
        self._rng = random.Random(seed)
        # 스프링 상태 (의미 좌표, 중립 대비 °)
        self.x = {a: 0.0 for a in AXES}
        self.v = {a: 0.0 for a in AXES}
        self.out = {a: 0.0 for a in AXES}                 # 속도 제한 이후 최종 출력 (직전 값)
        # 아이들 노이즈: 축마다 서로 다른 위상 — 비정수배 주파수 3개 합 → 반복 패턴이 안 보임
        self._phase = {a: [self._rng.uniform(0, 2*math.pi) for _ in range(3)] for a in AXES}
        self._set_profile_locked("neutral", 1.0, onset=False, now=time.monotonic())
        self.beats, self._beat_t = [], []                 # 비트 목록·시각 배열(bisect용)
        self.speech_t0 = None
        self._w_override = None                           # release 시 일시적으로 느린 스프링
        self._running = False
        self._thread = None
        self._last_written = {a: None for a in AXES}
        self._prev_cmd = {a: None for a in AXES}          # 직전 틱 명령값 (명령 속도 추정용)

    # ---------- 상태 변경 (외부 스레드에서 호출) ----------
    def _set_profile_locked(self, emotion, intensity, onset, now):
        p = PROFILES.get(emotion, PROFILES["neutral"])
        self.emotion = emotion if emotion in PROFILES else "neutral"
        self.p = p
        self.k = max(0.3, min(1.3, intensity))            # 감정 세기 배율 (분류 confidence 연동 가능)
        self.posture = {a: p["posture"][i] * self.k for i, a in enumerate(AXES)}
        self.gesture = p["onset"] if onset else None
        self.gesture_t0 = now
        self.drift = {a: 0.0 for a in AXES}
        self.next_drift = now + self._rng.uniform(*p["drift_iv"])

    def set_mood(self, emotion, intensity=1.0, onset=True):
        with self._lock:
            self._w_override = None
            self._set_profile_locked(emotion, intensity, onset, time.monotonic())

    def start_speech(self, beats, t0):
        with self._lock:
            # 파형 시작점이 오디오 0초보다 앞서는 비트는 버림 → 시작 순간 비트가 '중간부터' 튀어나와 급점프하는 것 방지
            #   (문장 첫머리 강조는 시작 제스처가 담당)
            min_t = BEAT_WIDTH / 2 + BEAT_LEAD
            sd = self.p["beat_side"]
            # 비트마다 회전·갸웃 변주를 미리 뽑아 둠 → 매 비트 모양이 조금씩 다름
            self.beats = [(t, s, self._rng.uniform(-1, 1)*sd*s, self._rng.uniform(-1, 1)*sd*s)
                          for t, s in beats if t >= min_t]
            self._beat_t = [b[0] for b in self.beats]
            self.speech_t0 = t0

    def _drop_future_beats_locked(self, now):
        """이미 시작된 비트는 끝까지 재생, 아직 안 시작된 비트만 제거 → 대사 종료 시 비트가 중간에 끊겨 튀는 것 방지"""
        if self.speech_t0 is None:
            return
        ts = now - self.speech_t0 + BEAT_LEAD
        self.beats = [b for b in self.beats if b[0] - BEAT_WIDTH / 2 <= ts]
        self._beat_t = [b[0] for b in self.beats]

    def stop_speech(self, now=None):
        with self._lock:
            self._drop_future_beats_locked(now if now is not None else time.monotonic())

    def relax(self, seconds=1.2, now=None):
        """현재 자세에서 중립으로 '천천히' 복귀. v1은 각도를 즉시 대입해서 툭 튀었음"""
        with self._lock:
            now = now if now is not None else time.monotonic()
            self._drop_future_beats_locked(now)
            self._set_profile_locked("neutral", 1.0, onset=False, now=now)
            self._w_override = (RELAX_W, now + seconds)       # (스프링 w, 유효 종료 시각)

    # ---------- 1틱 계산 ----------
    def step(self, now, dt):
        with self._lock:
            p, k = self.p, self.k

            # 1) 드리프트: 일정 간격마다 자세 주변의 새 목표를 뽑음 (시선 이동 느낌)
            if now >= self.next_drift:
                amp = p["drift"]
                self.drift = {"pan": self._rng.uniform(-0.5, 0.5)*amp,
                              "roll": self._rng.uniform(-1, 1)*amp,
                              "tilt": self._rng.uniform(-0.6, 0.6)*amp*TILT_DETAIL}   # tilt 드리프트 제거 (저속 이동 방지)
                self.next_drift = now + self._rng.uniform(*p["drift_iv"])

            # 2) 스프링: (자세 + 드리프트)로 2차 감쇠계 수렴 — 속도가 연속이라 출발·정지가 자연스러움
            w = p["w"]
            if self._w_override and now < self._w_override[1]:
                w = self._w_override[0]
            z = p["zeta"]
            sub = 4                                       # 서브스텝 (w=13, dt=20ms에서도 안정)
            h = dt / sub
            for a in AXES:
                target = self.posture[a] + self.drift[a]
                for _ in range(sub):                      # 반암시적 오일러
                    acc = w*w*(target - self.x[a]) - 2*z*w*self.v[a]
                    self.v[a] += acc * h
                    self.x[a] += self.v[a] * h
                # 종단 접근: 목표 근처인데 느리게 기어가고 있으면 최소 속도로 직선 접근 후 정확히 정지
                err = target - self.x[a]
                if abs(err) < TERM_BAND[a] and abs(self.v[a]) < TERM_SPEED[a]:
                    stepv = TERM_SPEED[a] * dt
                    if abs(err) <= stepv:
                        self.x[a], self.v[a] = target, 0.0                # 도착 → 고정 (이후 쓰기 없음)
                    else:
                        self.x[a] += stepv if err > 0 else -stepv
                        self.v[a] = 0.0

            off = dict(self.x)

            # 3) 제스처 레이어 (스프링 뒤에 더함 → 필터 지연·감쇠 없이 원래 타이밍 유지)
            if self.gesture:
                g = _hermite_keyframes(self.gesture, now - self.gesture_t0)
                if g is None:
                    self.gesture = None
                else:
                    for i, a in enumerate(AXES):
                        off[a] += g[i] * k * (TILT_DETAIL if a == "tilt" else 1.0)

            # 4) 비트 레이어: 현재 시각 ±창 안의 비트만 계산
            if self.speech_t0 is not None and self.beats:
                ts = now - self.speech_t0 + BEAT_LEAD     # 리드 보정된 오디오 시각
                if ts > self._beat_t[-1] + BEAT_WIDTH:    # 남은 비트 없음 → 정리
                    self.beats, self._beat_t = [], []
                lo = bisect.bisect_left(self._beat_t, ts - BEAT_WIDTH)
                hi = bisect.bisect_right(self._beat_t, ts + BEAT_WIDTH)
                for tb, s, side_r, side_t in self.beats[lo:hi]:
                    b = _bump((ts - (tb - BEAT_WIDTH/2)) / BEAT_WIDTH)   # 정점이 tb에 오도록
                    off["pan"]  -= p["beat_amp"] * k * s * b             # 강세 = 아래로 끄덕
                    off["roll"] += side_r * b * ROLL_BEAT_SIDE
                    off["tilt"] += side_t * b * TILT_DETAIL

            # 5) 아이들: 호흡(pan 0.22Hz) + 비정수배 사인 합 미세 흔들림
            ia, isp = p["idle_amp"] * IDLE_GAIN, p["idle_speed"]
            for a in AXES:
                ph = self._phase[a]
                n = (0.55*math.sin(2*math.pi*0.13*isp*now + ph[0])
                     + 0.30*math.sin(2*math.pi*0.29*isp*now + ph[1])
                     + 0.15*math.sin(2*math.pi*0.47*isp*now + ph[2]))
                off[a] += ia * n
            off["pan"] += 0.6 * ia * math.sin(2*math.pi*0.22*now)

            # 6) 떨림 (fear) — 7Hz 근방, 축별 다른 주파수
            if p["tremor"]:
                off["pan"]  += p["tremor"] * k * math.sin(2*math.pi*7.3*now)
                # roll 떨림(약 0.5°)은 데드밴드(0.27°)와 비슷한 크기라 표현이 아니라 버벅임이 됨 → 제거 (2026-11-03)

            # 7) 속도 제한 + 가동 범위 클램프 → 기어 보호, 급격한 점프 방지
            dmax = MAX_SPEED * dt
            for a in AXES:
                d = max(-dmax, min(dmax, off[a] - self.out[a]))
                self.out[a] = max(-LIMIT[a], min(LIMIT[a], self.out[a] + d))

            # 의미 좌표 → 실제 서보 각도
            return {a: NEUTRAL[a] + DIR[a] * self.out[a] for a in AXES}

    # ---------- 하드웨어 출력 ----------
    def _write(self, angles, dt=1.0 / UPDATE_HZ):
        for a in AXES:
            ang = max(0.0, min(180.0, angles[a]))
            prev = self._prev_cmd[a]
            speed = abs(ang - prev) / dt if prev is not None else 0.0   # 명령 각속도(°/s)
            self._prev_cmd[a] = ang
            band = WRITE_EPS if speed >= HOLD_SPEED else HOLD_BAND      # 느리면 넓은 띠로 정지 유지
            last = self._last_written[a]
            if last is None or abs(ang - last) >= band:
                SERVOS[a].angle = ang
                self._last_written[a] = ang

    def _loop(self):
        dt = 1.0 / UPDATE_HZ
        nxt = time.monotonic()
        prev = nxt
        while self._running:
            now = time.monotonic()
            step_dt = min(now - prev, 0.05) or dt             # 실제 경과시간으로 적분 (지터 보정)
            self._write(self.step(now, step_dt), step_dt)
            prev = now
            nxt += dt
            slack = nxt - time.monotonic()
            if slack > 0:
                time.sleep(slack)
            else:
                nxt = time.monotonic()                    # 밀렸으면 따라잡지 말고 재기준 (몰아서 움직이는 것 방지)

    def start(self):
        if self._running:
            return
        self._write({a: NEUTRAL[a] for a in AXES})        # 시작 시 중립 고정
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="servo-engine")
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)


_engine = MotionEngine()


def _ensure_started():
    _engine.start()


# =========================================================
# 외부 API
# =========================================================
def speak_motion(emotion: str, audio_bytes: bytes, duration: float,
                 t0: float = None, stop_event: threading.Event = None,
                 intensity: float = 1.0) -> int:
    """
    대사 1줄 동안의 모션 (blocking — asyncio.to_thread로 호출).
    t0는 aplay 시작 시각(time.monotonic) — animate_visemes와 같은 기준점을 넘겨야 립싱크와 맞음.
    Returns: 사용된 비트 수 (로그용)
    """
    _ensure_started()
    p = PROFILES.get(emotion, PROFILES["neutral"])
    beats = extract_beats(audio_bytes, max_rate=p["beat_rate"])
    t0 = t0 if t0 is not None else time.monotonic()
    _engine.set_mood(emotion, intensity)                  # 자세 전환 + 시작 제스처
    _engine.start_speech(beats, t0)
    end = t0 + duration
    while time.monotonic() < end:                         # 재생 끝까지 대기 (제어는 엔진 스레드가 함)
        if stop_event is not None and stop_event.is_set():
            break
        time.sleep(0.02)
    _engine.stop_speech()                                 # 비트만 끄고 자세는 유지 → release()에서 복귀
    return len(beats)


def listen():
    """사용자 발화 대기 자세 (non-blocking)"""
    _ensure_started()
    _engine.set_mood("listen", onset=False)


def release(seconds: float = 1.2):
    """대사 종료 후 중립으로 천천히 복귀 (non-blocking)"""
    _ensure_started()
    _engine.relax(seconds)


def reset(delay: float = 0.0):
    """중립 복귀. v1과 달리 기본 non-blocking (async 핸들러에서 직접 호출해도 이벤트 루프를 막지 않음)"""
    _ensure_started()
    _engine.relax(0.8)
    if delay:
        time.sleep(delay)


def perform(emotion: str, times: int = 1):
    """v1 호환: 감정 자세+시작 제스처만 재생 (음성 없음). 단독 테스트용"""
    _ensure_started()
    _engine.set_mood(emotion)
    kf = PROFILES.get(emotion, PROFILES["neutral"])["onset"]
    time.sleep((kf[-1][0] if kf else 0.0) + 1.5)


def shutdown():
    _engine.relax(0.8)
    time.sleep(1.0)
    _engine.stop()
    if pca is not None:
        pca.deinit()


# =========================================================
# 시뮬레이션 (하드웨어 없이 궤적 계산 — 튜닝·보고서 그래프용)
# =========================================================
def simulate(emotion, audio_bytes, duration, pre=0.5, post=1.5, seed=0):
    """가상 시계로 엔진을 돌려 (시간, {축: 서보각 배열}) 반환. time.monotonic을 쓰지 않음"""
    eng = MotionEngine(seed=seed)
    p = PROFILES.get(emotion, PROFILES["neutral"])
    beats = extract_beats(audio_bytes, max_rate=p["beat_rate"])
    dt = 1.0 / UPDATE_HZ
    ts, tr = [], {a: [] for a in AXES}
    t, T = 0.0, pre + duration + post
    started = released = False
    while t < T:
        if not started and t >= pre:                      # 대사 시작 (실제 API와 같은 경로)
            with eng._lock:
                eng._set_profile_locked(emotion, 1.0, True, t)
            eng.start_speech(beats, pre)
            started = True
        if not released and t >= pre + duration:          # 대사 종료 → release
            eng.relax(1.2, now=t)
            released = True
        ang = eng.step(t, dt)
        ts.append(t)
        for a in AXES:
            tr[a].append(ang[a])
        t += dt
    return np.array(ts), {a: np.array(v) for a, v in tr.items()}, beats


# =========================================================
# 단독 실행
# =========================================================
def _calib():
    """각 축을 의미 좌표 +10°로 천천히 보냈다 복귀 — 주석의 '+ 방향'과 실제가 다르면 DIR 부호 반전"""
    _ensure_started()
    desc = {"pan": "고개 들기(턱 위)", "roll": "로봇 기준 왼쪽 회전", "tilt": "로봇 기준 왼쪽 갸웃"}
    for i, a in enumerate(AXES):
        print(f"[calib] {a} + 방향 → 기대 동작: {desc[a]}")
        pose = [0, 0, 0]
        pose[i] = 10
        PROFILES["_calib"] = dict(PROFILES["listen"], posture=tuple(pose), idle_amp=0.0, drift=0.0)
        _engine.set_mood("_calib", onset=False)
        time.sleep(2.0)
        _engine.relax(1.0)
        time.sleep(1.5)


def _demo(args=()):
    """
    감정별 모션 데모 (가상 비트 0.45초 간격, 감정마다 3초)
      python servo_controller.py demo                 # 전체 감정
      python servo_controller.py demo joy             # 한 감정만
      python servo_controller.py demo joy --no-beat   # 레이어 끄기: --no-beat / --no-gesture / --no-drift / --no-tremor
    떨림 원인 찾기: 감정 → 레이어 순으로 하나씩 꺼 가며 어느 조합에서 사라지는지 확인
    """
    emos = [x for x in args if not x.startswith("--")] or \
           ["neutral", "joy", "anger", "sadness", "surprise", "fear", "disgust"]
    flags = {x for x in args if x.startswith("--")}
    _ensure_started()
    for emo in emos:
        base = PROFILES.get(emo, PROFILES["neutral"])
        prof = dict(base)                                 # 원본 프로파일은 건드리지 않고 복사본만 수정
        if "--no-gesture" in flags: prof["onset"] = None
        if "--no-drift" in flags:   prof["drift"] = 0.0
        if "--no-tremor" in flags:  prof["tremor"] = 0.0
        PROFILES["_demo"] = prof
        print(f"[demo] {emo}  (끈 레이어: {', '.join(sorted(flags)) or '없음'})")
        _engine.set_mood("_demo")
        if "--no-beat" not in flags:
            _engine.start_speech([(0.3 + 0.45*i, 0.8) for i in range(6)], time.monotonic())
        time.sleep(3.0)
        _engine.relax()
        time.sleep(1.5)


def _still(seconds=10):
    """진단용: 중립에서 완전 정지 (아이들·드리프트 0, 명령값 고정).
    이 상태에서도 떨리면 소프트웨어가 아니라 전원·기구 문제."""
    PROFILES["_still"] = dict(PROFILES["neutral"], drift=0.0, idle_amp=0.0)
    _ensure_started()
    _engine.set_mood("_still", onset=False)
    print(f"[still] {seconds}초간 고정 명령 — 이때도 떨리는지 관찰")
    time.sleep(seconds)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "demo"
    try:
        if mode == "calib":
            _calib()
        elif mode == "still":
            _still()
        else:
            _demo(sys.argv[2:])
    finally:
        shutdown()