import board
import busio
from adafruit_pca9685 import PCA9685
from adafruit_motor import servo
from time import sleep

# I²C 버스 + PCA9685 초기화
i2c = busio.I2C(board.SCL, board.SDA)
pca = PCA9685(i2c)
pca.frequency = 50

# 3축 서보 초기화
servo_tilt = servo.Servo(pca.channels[0], actuation_range=180)  # CH0: 좌우 기울기
servo_roll = servo.Servo(pca.channels[1], actuation_range=180)  # CH1: 좌우 회전
servo_pan  = servo.Servo(pca.channels[2], actuation_range=180)  # CH2: 앞뒤 끄덕임

import math

def ease_to(servo_obj, target, current, steps=20, duration=0.3):
    """이징 효과로 서보 이동 (중간에서 느려짐)"""
    for i in range(steps + 1):
        t = i / steps
        # ease in-out: 시작/끝 빠르고 중간 느림
        eased = t * t * (3 - 2 * t)
        angle = current + (target - current) * eased
        servo_obj.angle = angle
        sleep(duration / steps)

def reset():
    servo_tilt.angle = 86
    servo_roll.angle = 90
    servo_pan.angle  = 103
    sleep(0.5)

def joy(times=2, speed=0.3):
    current = 103
    for _ in range(times):
        ease_to(servo_pan, 83, current, steps=20, duration=speed)
        current = 83
        ease_to(servo_pan, 123, current, steps=20, duration=speed)
        current = 123
    ease_to(servo_pan, 103, current, steps=20, duration=0.3)
    servo_pan.angle = 103
    sleep(0.3)

def anger(times=2, speed=0.3):
    current = 90
    for _ in range(times):
        ease_to(servo_roll, 60, current, steps=20, duration=speed)
        current = 60
        ease_to(servo_roll, 120, current, steps=20, duration=speed)
        current = 120
    ease_to(servo_roll, 90, current, steps=20, duration=0.3)
    servo_roll.angle = 90
    sleep(0.3)

def sadness(times=1, speed=0.8):
    current = 86
    for _ in range(times):
        ease_to(servo_tilt, 76, current, steps=20, duration=speed)
        current = 76
        ease_to(servo_tilt, 86, current, steps=20, duration=speed)
        current = 86
    servo_tilt.angle = 86
    sleep(0.3)

def surprise(times=2, speed=0.3):
    current_pan = 103
    current_tilt = 86
    for _ in range(times):
        ease_to(servo_pan, 123, current_pan, steps=20, duration=speed)
        current_pan = 123
        ease_to(servo_pan, 103, current_pan, steps=20, duration=speed)
        current_pan = 103
        ease_to(servo_tilt, 106, current_tilt, steps=20, duration=speed)
        current_tilt = 106
        ease_to(servo_tilt, 86, current_tilt, steps=20, duration=speed)
        current_tilt = 86
    reset()


EMOTION_ACTIONS = {
    "joy":      joy,
    "surprise": surprise,
    "neutral":  reset,
    "sadness":  sadness,
    "anger":    anger,
    "fear":     sadness,
    "disgust":  anger,
}

def perform(emotion: str, times: int = 2):
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
