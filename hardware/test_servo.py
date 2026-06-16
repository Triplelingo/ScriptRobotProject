import board
import busio
from adafruit_pca9685 import PCA9685
from adafruit_motor import servo
from time import sleep

# I²C 버스 + PCA9685 초기화
i2c = busio.I2C(board.SCL, board.SDA)
pca = PCA9685(i2c)
pca.frequency = 50  # 서보 표준 50Hz

# CH0에 서보 1개 연결 (TILT 축 테스트)
s = servo.Servo(pca.channels[0], actuation_range=180)

# 0° → 90° → 180° → 90° 순서로 동작 확인
for angle in [0, 90, 180, 90]:
    s.angle = angle
    print(f"각도 설정: {angle}°")
    sleep(1)

pca.deinit()  # 종료 시 PWM 신호 해제
