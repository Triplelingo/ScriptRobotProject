# WebSocket 통신 전담 라우터
# RPi5와의 모든 실시간 메시지 송수신을 처리합니다

import json
import base64
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# APIRouter: FastAPI 앱에 등록할 수 있는 라우터 단위
router = APIRouter()

# 현재 연결된 RPi5의 WebSocket 객체를 전역으로 보관
# None이면 RPi5 미연결 상태
robot_ws: WebSocket | None = None


@router.websocket("/ws/robot")
async def robot_endpoint(websocket: WebSocket):
    """
    RPi5가 접속하는 WebSocket 엔드포인트.
    RPi5 부팅 시 이 경로로 연결을 맺고 세션 내내 유지합니다.
    """
    global robot_ws

    await websocket.accept()   # 연결 수락
    robot_ws = websocket
    print("[서버] ✅ RPi5 연결됨")

    try:
        while True:
            # RPi5로부터 메시지를 기다림 (블로킹 대기)
            raw = await websocket.receive()

            if "bytes" in raw:
                # 바이너리 프레임: 오디오 데이터 수신
                await handle_audio(raw["bytes"])

            elif "text" in raw:
                # 텍스트 프레임: JSON 명령 수신
                msg = json.loads(raw["text"])
                await handle_text(msg)

    except WebSocketDisconnect:
        # RPi5가 연결을 끊었을 때 (전원 차단, 네트워크 끊김 등)
        print("[서버] ❌ RPi5 연결 끊김")
        robot_ws = None


async def handle_audio(data: bytes):
    """
    RPi5 → 서버: 사용자 발화 WAV 수신 처리.
    현재는 수신 확인 로그만 출력.
    비다의 Whisper·발음 평가 모듈 완성 후 여기에 연결합니다.
    """
    print(f"[서버] 🎤 오디오 수신: {len(data):,} bytes")
    # TODO: Whisper STT 호출 (비다 담당)
    # TODO: Azure 발음 평가 호출 (비다 담당)


async def handle_text(msg: dict):
    """
    RPi5 → 서버: JSON 텍스트 메시지 처리.
    현재는 수신 내용 로그만 출력.
    """
    msg_type = msg.get("type")
    print(f"[서버] 📨 텍스트 수신: type={msg_type}, 내용={msg}")
    # TODO: user_audio 타입 → STT 파이프라인 연결


async def send_to_robot(payload: dict):
    """
    서버 → RPi5: JSON 명령 전송.
    다른 모듈(설희, 비다)에서 이 함수를 import해서 호출합니다.

    사용 예:
        from ws_router import send_to_robot
        await send_to_robot({"type": "speak", "emotion": "joy", ...})
    """
    if robot_ws is None:
        print("[서버] ⚠️  RPi5 미연결 — 명령 전송 실패")
        return

    await robot_ws.send_text(json.dumps(payload))
    print(f"[서버] 📤 명령 전송: type={payload.get('type')}")