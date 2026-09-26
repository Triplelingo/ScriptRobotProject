import board
import busio
from adafruit_pca9685 import PCA9685
from adafruit_motor import servo
from time import sleep
import math

# I²C 버스 + PCA9685 초기화
i2c = busio.I2C(board.SCL, board.SDA)
pca = PCA9685(i2c)
pca.frequency = 50

# 3축 서보 초기화 (2026-09: 3축 전부 DS3120으로 교체 완료)
# DS3120 실측 펄스폭 500~2500us 반영 — adafruit_motor 기본값(750~2250us)으로 두면
# DS3120 실제 가동범위를 다 못 쓰고 각도-펄스 매핑이 어긋남
_DS3120_PULSE = {"min_pulse": 500, "max_pulse": 2500}
servo_tilt = servo.Servo(pca.channels[0], actuation_range=180, **_DS3120_PULSE)  # CH0: 좌우 기울기
servo_roll = servo.Servo(pca.channels[1], actuation_range=180, **_DS3120_PULSE)  # CH1: 좌우 회전
servo_pan  = servo.Servo(pca.channels[2], actuation_range=180, **_DS3120_PULSE)  # CH2: 앞뒤 끄덕임

# =========================================================
# 중립 각도 상수 — 여기만 수정하면 전체 반영됨
# 2026-09 DS3120 교체 후 재보정된 실측값
# =========================================================
NEUTRAL_TILT = 70
NEUTRAL_ROLL = 99
NEUTRAL_PAN  = 70

# =========================================================
# 동작 폭 상수 — PAN/TILT만 좁게 조정 (기존 대비 약 40% 축소)
# ROLL(anger)은 기존 폭 유지
# =========================================================
PAN_SWING = 12          # 기존 20 → 12
TILT_SURPRISE_SWING = 12  # 기존 20 → 12 (surprise에서 위로 젖히는 폭)
TILT_SADNESS_SWING = 6     # 기존 10 → 6  (sadness에서 아래로 숙이는 폭)
ROLL_SWING = 30          # 변경 없음


def ease_to(servo_obj, target, current, steps=60, duration=0.3):
    """이징 효과로 서보 이동 (시작/끝 빠르고 중간 느림)"""
    for i in range(steps + 1):
        t = i / steps
        eased = t * t * (3 - 2 * t)  # ease in-out 공식
        angle = current + (target - current) * eased
        servo_obj.angle = angle
        sleep(duration / steps)


def reset(delay=1.5):
    """모든 서보를 중립 각도로 복귀"""
    servo_tilt.angle = NEUTRAL_TILT
    servo_roll.angle = NEUTRAL_ROLL
    servo_pan.angle  = NEUTRAL_PAN
    sleep(delay)


def joy(times=2, speed=0.5):
    """PAN 축 끄덕임 — 기쁨 표현"""
    current = NEUTRAL_PAN
    for _ in range(times):
        ease_to(servo_pan, NEUTRAL_PAN - PAN_SWING, current, steps=20, duration=speed)
        current = NEUTRAL_PAN - PAN_SWING
        ease_to(servo_pan, NEUTRAL_PAN + PAN_SWING, current, steps=20, duration=speed)
        current = NEUTRAL_PAN + PAN_SWING
    ease_to(servo_pan, NEUTRAL_PAN, current, steps=20, duration=0.3)
    servo_pan.angle = NEUTRAL_PAN
    sleep(0.3)


def anger(times=2, speed=0.5):
    """ROLL 축 좌우 흔들기 — 분노 표현"""
    current = NEUTRAL_ROLL
    for _ in range(times):
        ease_to(servo_roll, NEUTRAL_ROLL - ROLL_SWING, current, steps=20, duration=speed)
        current = NEUTRAL_ROLL - ROLL_SWING
        ease_to(servo_roll, NEUTRAL_ROLL + ROLL_SWING, current, steps=20, duration=speed)
        current = NEUTRAL_ROLL + ROLL_SWING
    ease_to(servo_roll, NEUTRAL_ROLL, current, steps=20, duration=0.3)
    servo_roll.angle = NEUTRAL_ROLL
    sleep(0.3)


def sadness(times=1, speed=1.0):
    """TILT 축 아래로 기울기 — 슬픔 표현"""
    current = NEUTRAL_TILT
    for _ in range(times):
        ease_to(servo_tilt, NEUTRAL_TILT - TILT_SADNESS_SWING, current, steps=20, duration=speed)
        current = NEUTRAL_TILT - TILT_SADNESS_SWING
        ease_to(servo_tilt, NEUTRAL_TILT, current, steps=20, duration=speed)
        current = NEUTRAL_TILT
    servo_tilt.angle = NEUTRAL_TILT
    sleep(0.3)


def surprise(times=2, speed=0.4):
    """PAN + TILT 복합 동작 — 놀람 표현"""
    current_pan  = NEUTRAL_PAN
    current_tilt = NEUTRAL_TILT
    for _ in range(times):
        ease_to(servo_pan, NEUTRAL_PAN + PAN_SWING, current_pan, steps=20, duration=speed)
        current_pan = NEUTRAL_PAN + PAN_SWING
        ease_to(servo_pan, NEUTRAL_PAN, current_pan, steps=20, duration=speed)
        current_pan = NEUTRAL_PAN
        ease_to(servo_tilt, NEUTRAL_TILT + TILT_SURPRISE_SWING, current_tilt, steps=20, duration=speed)
        current_tilt = NEUTRAL_TILT + TILT_SURPRISE_SWING
        ease_to(servo_tilt, NEUTRAL_TILT, current_tilt, steps=20, duration=speed)
        current_tilt = NEUTRAL_TILT
    # reset() 대신 sleep(0.3)으로 통일 — 1.5초 지연 제거
    servo_pan.angle  = NEUTRAL_PAN
    servo_tilt.angle = NEUTRAL_TILT
    sleep(0.3)


# 감정 → 동작 매핑
EMOTION_ACTIONS = {
    "joy":      joy,
    "surprise": surprise,
    "neutral":  reset,
    "sadness":  sadness,
    "anger":    anger,
    "fear":     sadness,   # fear → sadness 패턴 사용
    "disgust":  anger,     # disgust → anger 패턴 사용
}


def perform(emotion: str, times: int = 2):
    """감정에 맞는 서보 동작 실행"""
    action = EMOTION_ACTIONS.get(emotion, reset)
    if action == reset:
        reset()
    else:
        action(times=times)


if __name__ == "__main__":
    reset()
    for emotion in ["joy", "anger", "sadness", "surprise", "neutral"]:
        print(f"감정: {emotion}")
        perform(emotion)
        sleep(1)
    pca.deinit()