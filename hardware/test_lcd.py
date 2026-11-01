from luma.lcd.device import ili9486
from luma.core.interface.serial import spi
from PIL import Image, ImageDraw

# SPI 디바이스 초기화
# bgr=True: 이 패널(ILI9486 클론, tft35a 계열)이 RGB 대신 BGR 순서를 쓰는 경우가 많아서 추가
serial = spi(port=0, device=0, gpio_DC=24, gpio_RST=25, bgr=True, bus_speed_hz=16000000)

# rotate: 0~3 값 (90도 단위). 원이 왼쪽 하단에 작게 나왔던 건 물리적 장착 방향(90도 회전)이랑
# 소프트웨어 회전값이 안 맞아서였음 — 1, 2, 3 순서로 바꿔가며 원이 중앙에 제대로 나오는 값을 찾을 것
device = ili9486(serial, width=320, height=480, rotate=1)
device.command(0x20)   # 패널 기본값이 색 반전 상태라 반전 해제 (lcd_mouth.py와 동일)

# 검은 배경에 흰 원 그리기
image = Image.new("RGB", device.size, "black")
draw = ImageDraw.Draw(image)

# 좌표를 device.size 기준으로 계산 — rotate 값이 바뀌어 가로/세로가 뒤집혀도
# 항상 화면 정중앙에 적절한 크기로 그려지게 함
w, h = device.size
cx, cy = w // 2, h // 2
r = min(w, h) // 4
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="white")

device.display(image)
print(f"LCD 출력 완료 (device.size={device.size})")

# 프로세스가 바로 종료되면 luma가 GPIO를 release하면서 화면이 같이 지워지는 현상이 있었음
# Enter 누르기 전까지 화면 유지
input("Enter를 눌러야 종료됩니다...")
