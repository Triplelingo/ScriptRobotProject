from luma.lcd.device import ili9486
from luma.core.interface.serial import spi
from PIL import Image, ImageDraw

# SPI 디바이스 초기화
serial = spi(port=0, device=0, gpio_DC=24, gpio_RST=25)
device = ili9486(serial, width=480, height=320)

# 검은 배경에 흰 원 그리기
image = Image.new("RGB", (480, 320), "black")
draw = ImageDraw.Draw(image)
draw.ellipse([190, 110, 290, 210], fill="white")
device.display(image)
print("LCD 출력 완료")
