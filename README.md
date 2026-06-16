# Triplelingo 🤖

영어 대본 연습용 로봇 시스템.  
사용자가 웹에 영어 대본을 업로드하면, Raspberry Pi 5 기반 로봇이 상대방 역할을 수행하며 발음 피드백을 제공한다.

---

## 시스템 구성

```
Triplelingo/
├── client/       ← React 프론트엔드 (Vite)
├── server/       ← FastAPI 백엔드
├── hardware/     ← Raspberry Pi 5 제어 코드
├── database/     ← MySQL 스키마
└── admin/        ← 관리자 페이지 (HTML/CSS/JS)
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React (Vite), JavaScript |
| 백엔드 | FastAPI (Python 3.11) |
| 하드웨어 | Raspberry Pi 5, PCA9685, MG996R 서보 × 3, MAX98357A I2S |
| AI/ML | Azure TTS/STT, Azure Pronunciation Assessment, BERT 감정 분류 |
| DB | MySQL |
| 통신 | WebSocket (RPi5 ↔ 서버), REST API (프론트 ↔ 서버) |

---

## 실행 방법

### 1. 백엔드 서버

```bash
cd server
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`.env` 파일 생성 (`.env.example` 참고):
```
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region
DB_URL=mysql+pymysql://user:password@localhost/emo
```

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 프론트엔드

```bash
cd client
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 3. RPi5 하드웨어 클라이언트

```bash
source ~/robot/.venv/bin/activate
cd ~/robot
python ws_client.py
```

> 서버가 먼저 실행된 상태여야 WebSocket 연결이 됩니다.  
> 기본 연결 주소: `ws://192.168.0.108:8000/ws/robot`

---

## API 엔드포인트

### 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/register` | 회원가입 |
| POST | `/login` | 로그인 |

### 대본
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/scripts` | 전체 대본 목록 |
| POST | `/scripts` | 대본 저장 |
| GET | `/api/scripts/{id}` | 대본 파싱 (등장인물/감정 포함) |
| POST | `/api/scripts/{id}/lines` | 대사 라인 저장 |
| GET | `/api/scripts/{id}/lines` | 대사 라인 조회 |
| PATCH | `/api/lines/{id}/emotion` | 감정 수정 |

### 로봇 제어
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/robot/speak` | TTS 생성 후 RPi5 전송 |
| POST | `/api/robot/standby` | 사용자 차례 전환 |
| POST | `/api/robot/end_recording` | 녹음 종료 신호 전송 |
| WS | `/ws/robot` | RPi5 WebSocket 연결 |

### 발음 평가
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/evaluate` | 음성 파일 업로드 → 발음 점수 반환 |
| POST | `/api/speak` | 로컬 TTS 재생 (테스트용) |

### 세션
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/sessions` | 연습 세션 저장 |
| GET | `/api/sessions/{user_id}` | 사용자 연습 기록 조회 |

---

## 하드웨어 구성

| 부품 | 인터페이스 | 역할 |
|------|-----------|------|
| Raspberry Pi 5 | — | 중앙 컨트롤러 |
| PCA9685 | I²C (0x40) | 서보 PWM 드라이버 |
| MG996R × 3 | PWM | TILT / ROLL / PAN 3축 |
| MAX98357A | I2S | TTS 음성 출력 |
| USB 마이크 | USB 3.0 | STT 음성 입력 |

---

## 팀

| 이름 | 담당 |
|------|------|
| 장혜미 (팀장) | 하드웨어 제어, WebSocket 통신, RPi5 클라이언트 |
| 윤설희 | 감정 분류, 대본 파싱, MySQL DB 설계 |
| 비다 | TTS/STT/발음 평가, React 프론트엔드 |
