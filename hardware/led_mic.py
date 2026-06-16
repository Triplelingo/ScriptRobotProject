import lgpio
import sounddevice as sd
import numpy as np
import time

# LED 핀 설정
LED_PINS = [16, 6, 26]
h = lgpio.gpiochip_open(0)
for pin in LED_PINS:
    lgpio.gpio_claim_output(h, pin)
    lgpio.gpio_write(h, pin, 0)  # 초기 OFF

def set_leds(count):
    """count 개수만큼 LED 켜기 (0~3)"""
    for i, pin in enumerate(LED_PINS):
        lgpio.gpio_write(h, pin, 1 if i < count else 0)

def get_rms(data):
    return float(np.sqrt(np.mean(data.astype(np.float32) ** 2))) / 32768.0

print("마이크 테스트 시작 — 말해보세요! (Ctrl+C로 종료)")

try:
    with sd.InputStream(samplerate=16000, channels=1, dtype='int16', device='default') as stream:
        while True:
            data, _ = stream.read(441)  # 20ms
            rms = get_rms(data)
            if rms < 0.01:
                set_leds(0)
            elif rms < 0.05:
                set_leds(1)
            elif rms < 0.15:
                set_leds(2)
            else:
                set_leds(3)
except KeyboardInterrupt:
    set_leds(0)
    lgpio.gpiochip_close(h)
    print("종료")
