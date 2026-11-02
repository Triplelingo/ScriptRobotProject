# hardware/ — Raspberry Pi 5 로봇 제어 모듈

루트 규칙 상속: @../CLAUDE.md

> 이 폴더의 코드는 **RPi5에서만 수정**한다 (VS Code 원격 창 `SSH: rpi5`).
> 노트북 쪽 `hardware/`는 `git pull`로만 받는다. 양쪽에서 따로 고치면 덮어써진다 (2026-11 실제로 `ws_client.py`가 예전 버전으로 돌아간 사고 있었음).

---

## 파일 구성

### 실행에 필요한 파일 (3개)

| 파일 | 역할 |
|---|---|
| `ws_client.py` | **로봇 본체.** 서버(FastAPI)와 WebSocket 연결, 메시지별 동작 수행. 이것만 실행하면 됨 |
| `lcd_mouth.py` | LCD 입 모양 렌더링 + viseme 립싱크 + 사용자 발화 파형 표시 |
| `servo_controller.py` | PCA9685 기반 서보 3축 감정별 고갯짓 (`perform`, `reset`) |

### 점검용 파일 (단독 실행)

| 파일 | 용도 | 비고 |
|---|---|---|
| `test_lcd.py` | LCD 출력 확인 (흰 원) | `lcd_mouth.py`와 같은 설정으로 맞춰 둠 |
| `test_servo.py` | CH0 서보 0→90→180→90 | ⚠️ DS3120 펄스폭(`min_pulse=500, max_pulse=2500`) 미적용 → 실제 각도와 어긋남. 쓸 거면 수정 필요 |

### 삭제된 파일·기능 (참고)

- **녹음 레벨 LED**: 최종 하드웨어에서 제외. `led_mic.py` 삭제, `ws_client.py`의 LED 코드(`LED_PINS`, `set_leds`, `import lgpio`) 제거 완료 (2026-11). 녹음 중 피드백은 LCD 발화 파형으로 대체
- 백업·임시 점검 파일(`*_old.py`, `*_backup.py`, `bench_lcd.py`, `test_color.py`)은 만들어도 커밋하지 않음 — 예전 버전은 Git 기록으로 확인

---

## 실행 방법

```bash
source ~/ScriptRobotProject/.venv/bin/activate   # venv 필수 (안 하면 luma 등 ModuleNotFoundError)
cd ~/ScriptRobotProject/hardware
tmux new -A -s robot                             # SSH가 끊겨도 계속 실행되게
python -u ws_client.py                           # 시작 직후 0.6초 동안 주변 소음 측정 → 조용히
```

- 서버 주소 기본값: `192.168.0.102` (노트북). 핫스팟 환경에서는 `SERVER_HOST=192.168.137.1 python -u ws_client.py`
- 노트북 서버 실행: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload --ws-ping-interval 5 --ws-ping-timeout 10`
- 정상 시작 로그: `🔈 볼륨 믹서: PCM` → `🔈 볼륨 복원: N%` → `🎙️ 주변 소음 측정` → `✅ 서버 연결 성공`

---

## ws_client.py

### 메시지 처리

| type | 동작 |
|---|---|
| `speak` | TTS 재생(aplay) + 서보 고갯짓 + LCD viseme 립싱크를 동시에 (`asyncio.gather`) |
| `standby` | 서보 중립 + **LCD 발화 파형 시작** (웹에서 녹음 시작 시 전송) |
| `end_recording` | 파형 종료 → 다문 입 복귀 (웹에서 녹음 종료 시 전송) |
| `set_volume` | 볼륨 변경 (웹 슬라이더) |
| `end_session` | 입 애니메이션 중단, 서보·입 초기화 |

접속 직후 RPi → 서버로 `{"type": "volume_state", "volume": N}` 전송 (웹 슬라이더 표시 동기화).

### 유의점
- **`action_duration`** (감정별 서보 1회 동작 시간): 반복 횟수 = 재생 시간 ÷ 이 값. 실제 동작 시간보다 작으면 **말이 끝난 뒤에도 서보가 계속 움직임.** 현재값 joy 1.0 / surprise 1.6 / anger 1.0 / sadness 2.0 / fear 2.0 / disgust 1.0. 서보 동작을 바꾸면 실측 후 갱신
- 볼륨: 0~100%는 ALSA `PCM` 믹서(`amixer -M`, 귀 기준 비율), 100% 초과(최대 150%)는 WAV 샘플 직접 증폭. 마지막 값은 `~/.robot_volume`에 저장, 없으면 60%
- 재생 시간은 WAV 헤더로 계산(`wav_duration`). 고정식(`(len-44)/32000`) 쓰지 말 것
- 임시 WAV는 재생 후 `finally`에서 삭제됨
- `stop_event`(파형 스레드)와 `speak_stop`(입 애니메이션)은 **용도가 다름. 합치지 말 것**
- `on_speak`/`on_end_session` 시작 시 `stop_wave()` 호출 → 파형과 입 모양이 LCD를 동시에 쓰지 않게 함

### 발화 파형 (monitor_mic)
- 시작 시 `calibrate_noise()`로 주변 소음 측정, 이후 세션마다 소음 기준 자동 갱신
- 블록마다 DC 오프셋(평균값) 제거 후 dB 계산 (USB 마이크가 무음에도 값이 떠 있는 문제 대응)
- 조정 상수: `NOISE_MARGIN_DB`(조용한데 흔들리면 ↑), `WAVE_RANGE_DB`(크게 말해도 낮으면 ↓), `WAVE_CURVE`(현재 0.4, 작을수록 작은 소리 강조). `WAVE_DEBUG = True`로 dB 출력
- 입 복귀는 `stop_wave()`가 스레드 종료 확인 후 직접 수행 (스레드의 finally에서 하면 순서가 꼬임)

---

## lcd_mouth.py

### 구성
- 입 모양 11종: `rest, closed, open_wide, open_mid, round_open, round_small, smile, teeth, fv, th, tongue_up`
- Azure viseme ID(0~21) → `VISEME_TO_SHAPE`로 매핑
- 모든 프레임은 임포트 시 미리 렌더링(`_FRAMES`), 표시할 때는 교체만
- 단독 실행: `python lcd_mouth.py shapes` (모양 확인) / `demo` (립싱크, 13프레임 근처면 정상) / `wave` (파형 fps)

### 유의점 (실측으로 확인된 값 — 함부로 바꾸지 말 것)
- **`bus_speed_hz=16000000`**: 32MHz는 점퍼선 배선이 못 버텨 화면이 안 나옴
- **`rotate=1`**: 패널 물리 장착 방향 보정
- **`bgr=True` + `_device.command(0x20)`**: 패널 기본값이 색 반전 상태. 0x20(INVOFF) 빠지면 색이 전부 반전됨 (빨강→청록, 흰색→검정)
- **`diff_to_previous(num_segments=1)`**: 기본값(16블록)이면 입이 바뀔 때 블록 단위로 섞여 보임
- **배경은 항상 검정**: 배경이 바뀌면 전체 화면 전송(약 276ms/프레임)이 일어나 립싱크 불가. 입 영역만 바뀌어야 13~25fps
- `MOUTH_SCALE = 1.4`: 입 크기 배율. 키우면 fps 감소 (1.0≈25fps, 1.4≈13fps). 10fps 아래면 립싱크가 끊겨 보임
- 입 모양 조정은 `_SHAPE_SPECS` 숫자, 색은 상단 팔레트만 수정
- `AUDIO_LATENCY_MS = 0`: 현재 싱크 맞음. 입이 소리보다 빠르면 ↑
- SPI 쓰기는 `_lock`으로 보호됨. 새 표시 함수를 만들면 반드시 `_lock` 안에서 `_device.display()` 호출하고, 입 모양이 아닌 화면이면 `_current_shape = None`으로 둘 것

---

## servo_controller.py

- 3축 전부 **DS3120** (2026-09 MG996R에서 교체). 채널: CH0 TILT(고개 갸웃) / CH1 ROLL(좌우 회전) / CH2 PAN(끄덕임)
- 서보 생성 시 **`min_pulse=500, max_pulse=2500` 필수** (adafruit_motor 기본 750~2250us면 각도 매핑 어긋남)
- 중립각: `NEUTRAL_TILT = 80`, `NEUTRAL_ROLL = 99`, `NEUTRAL_PAN = 70` — 이 세 값만 바꾸면 모든 동작에 반영
- 감정 매핑: joy→끄덕임, anger→좌우 흔들기, sadness→숙이기, surprise→끄덕임+젖히기, fear→sadness, disgust→anger, neutral→중립
- `reset()`은 기본 1.5초 대기 포함

### 재조립 시 필수 절차
서보 혼을 다시 끼우거나 프레임을 재조립하면 중립각이 틀어짐.
1. 서보 신호를 끊고(`duty_cycle = 0`) 손으로 정면 자세를 맞춘 뒤, 각도를 바꿔 가며 그 자세가 나오는 값 탐색
2. `NEUTRAL_TILT/ROLL/PAN` 갱신 → `python -c "from servo_controller import reset; reset()"`로 확인

---

## 인터페이스 / 핀

| 장치 | 인터페이스 | 핀·설정 |
|---|---|---|
| PCA9685 (서보 3축) | I²C | GPIO2 SDA, GPIO3 SCL, 주소 0x40, 50Hz |
| 3.5인치 TFT LCD (ILI9486) | SPI0 CE0 | DC=GPIO24, RST=GPIO25, 16MHz, 점퍼선 배선 |
| 스피커 | USB | ALSA 카드 0 (`plughw:0,0`), 믹서 `PCM` |
| 마이크 | USB | sounddevice 기본 입력, 16kHz |

- 서보 전원: 5V 5A 어댑터 → PCA9685 배럴잭 (RPi와 분리, **GND 공유**. 공유 안 하면 스피커 잡음)
- **`/boot/firmware/config.txt`의 `dtoverlay=tft35a`는 주석 상태여야 함.** 켜면 커널 fbtft 드라이버가 SPI0/GPIO24·25를 먼저 점유해서 `lcd_mouth.py`가 동작 안 함 (luma로 직접 제어하는 구조)

---

## 주요 의존성
luma.lcd, luma.core, Pillow, adafruit-circuitpython-pca9685, adafruit-circuitpython-motor, sounddevice, numpy, websockets (venv: `~/ScriptRobotProject/.venv`)

> `ws_client.py`는 `lgpio`를 직접 쓰지 않지만, luma가 GPIO(DC·RST 핀) 제어에 내부적으로 사용하므로 패키지는 삭제하지 말 것

---

## 트러블슈팅 이력

| 증상 | 원인 | 해결 |
|---|---|---|
| `GPIO not allocated` (실행 시) | SSH 끊김 후 이전 `ws_client.py`가 남아 GPIO 점유 | `pkill -f ws_client.py` 후 재실행, tmux 사용 |
| `ModuleNotFoundError: luma` | venv 미활성화 | `source ~/ScriptRobotProject/.venv/bin/activate` |
| `/dev/fb*` 없음 / LCD 안 나옴 | 오버레이·luma 충돌 또는 배선 | 위 config.txt 항목 확인, 점퍼선 확인 |
| 색이 반전돼 보임 | 패널 기본 반전 | `command(0x20)` 확인 |
| `keepalive ping timeout`으로 말하다 끊김 | 서버가 TTS 합성 중 이벤트 루프 블로킹 + ping 타임아웃 5초 | 서버에서 `asyncio.to_thread`로 합성, `--ws-ping-timeout 10` |
| `SERVER_HOST`를 줘도 엉뚱한 주소로 접속 | 주소가 하드코딩된 예전 파일로 덮어써짐 | `SERVER_HOST = os.getenv(...)` 줄 확인 |
| 웹에서 파형 안 나옴 | 프론트가 `standby` 미전송 | `PracticePage.jsx` 녹음 시작/종료에서 `/api/robot/standby`, `/api/robot/end_recording` 호출 |
| RPi에서 `git push` 시 `vscode-git-*.sock ECONNREFUSED` | 끊긴 VS Code 세션의 인증 통로를 tmux 터미널이 물고 있음 | tmux 밖 새 터미널에서 push |
| SSH 접속이 자주 끊김 / ping 50~140ms | Wi-Fi 절전 모드 | `nmcli ... 802-11-wireless.powersave 2` (적용 완료) |
| TILT·PAN 축 떨림 (2026-09) | MG996R 토크(약 11kg·cm) < 필요 토크(약 12kg·cm) | DS3120 교체로 해결, 카운터웨이트 불필요 |

---

## TODO
- [ ] 부팅 시 `ws_client.py` 자동 실행 (systemd)
- [ ] 대회장 네트워크 리허설 (휴대폰 테더링 + 노트북 핫스팟 `192.168.137.x`)
- [ ] `test_servo.py`에 DS3120 펄스폭 반영
- [ ] 서보 전원 5V 고정 → 토크 부족 재발 시 6~7V 어댑터 검토 (DS3120: 21.5kg·cm@5V / 25kg·cm@6.8V)
