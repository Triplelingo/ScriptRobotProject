# WebSocket 통신 전담 라우터
# RPi5와의 모든 실시간 메시지 송수신 및 발음 평가 파이프라인을 처리합니다.

import os
import json
import base64
import uuid
import shutil
import requests
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import azure.cognitiveservices.speech as speechsdk
from pydub import AudioSegment

router = APIRouter()

# 현재 연결된 RPi5의 WebSocket 객체 전역 관리
robot_ws: WebSocket | None = None

# RPi5 평가 시 비교할 현재 목표 대사 (PracticePage 또는 RPi5 text 메시지로 갱신)
current_reference_text: str = ""


# ====================================================================
# 1. LOCAL OLLAMA FEEDBACK PIPELINE
# ====================================================================
def get_feedback_from_ollama(expected: str, user_text: str) -> str:
    prompt = f"""
Expected Script Line: "{expected}"
User Utterance Captured: "{user_text}"

Analyze the phrase. Find mistakes and provide clear feedback on pronunciation anomalies, missing or skipped words, and natural flow/fluency. Keep it concise.
"""
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "mistral",
                "prompt": prompt,
                "stream": False
            },
            timeout=60
        )
        return response.json().get("response", "")
    except Exception as e:
        print(f"[ws_router Ollama Error]: {e}")
        return "AI detailed linguistic breakdown is temporarily unavailable."


# ====================================================================
# 2. AUDIO EVALUATION (AZURE PRONUNCIATION ASSESSMENT)
# ====================================================================
async def process_pronunciation_assessment(audio_bytes: bytes, reference_text: str = "") -> dict:
    """
    수신된 오디오 바이트(WAV/WebM)를 16kHz PCM으로 변환 후 Azure 발음 평가 및 Ollama 피드백 수행
    """
    ref_text = reference_text or current_reference_text or "Hello"

    temp_raw = f"temp_rpi_{uuid.uuid4().hex}.raw"
    temp_wav = f"temp_rpi_{uuid.uuid4().hex}.wav"

    with open(temp_raw, "wb") as buffer:
        buffer.write(audio_bytes)

    try:
        # 16kHz 16-bit Mono PCM 포맷으로 변환
        audio = AudioSegment.from_file(temp_raw)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(temp_wav, format="wav")

        if os.path.exists(temp_raw):
            os.remove(temp_raw)

        speech_key = os.getenv("AZURE_SPEECH_KEY")
        speech_region = os.getenv("AZURE_SPEECH_REGION")

        if not speech_key or not speech_region:
            print("[ws_router] ⚠️ Azure Speech Key 또는 Region 환경변수가 누락되었습니다.")
            return {"status": "error", "message": "Azure Speech credentials missing"}

        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            region=speech_region
        )
        audio_config = speechsdk.AudioConfig(filename=temp_wav)

        pron_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=ref_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme
        )

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, 
            audio_config=audio_config
        )
        pron_config.apply_to(recognizer)
        result = recognizer.recognize_once()

        del recognizer

        # 녹음 파일 영구 보관 (선택)
        os.makedirs("recordings", exist_ok=True)
        saved_filename = f"recordings/{uuid.uuid4()}.wav"
        shutil.copy(temp_wav, saved_filename)

        if os.path.exists(temp_wav):
            os.remove(temp_wav)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            pron_result = speechsdk.PronunciationAssessmentResult(result)
            feedback = get_feedback_from_ollama(ref_text, result.text)

            word_details = [
                {
                    "word": w.word,
                    "accuracy": w.accuracy_score,
                    "error_type": w.error_type if w.error_type else "None"
                }
                for w in pron_result.words
            ]

            evaluation_data = {
                "status": "success",
                "reference_text": ref_text,
                "user_text": result.text,
                "accuracy": round(pron_result.accuracy_score),
                "fluency": round(pron_result.fluency_score),
                "completeness": round(pron_result.completeness_score),
                "pronunciation": round(pron_result.pronunciation_score),
                "words": word_details,
                "feedback": feedback
            }

            print(f"[서버] 🎯 발음 평가 완료: 종합 점수={evaluation_data['pronunciation']}점 | 인식문장='{result.text}'")
            return evaluation_data

        return {
            "status": "error",
            "message": f"Speech not recognized. Reason: {result.reason}"
        }

    except Exception as err:
        if os.path.exists(temp_raw): os.remove(temp_raw)
        if os.path.exists(temp_wav): os.remove(temp_wav)
        print(f"[ws_router Evaluation Error]: {err}")
        return {"status": "error", "message": str(err)}


# ====================================================================
# 3. WEBSOCKET ENDPOINT & HANDLERS
# ====================================================================
@router.websocket("/ws/robot")
async def robot_endpoint(websocket: WebSocket):
    global robot_ws

    # 기존 활성 연결이 남아있다면 안전하게 닫고 새로 교체
    if robot_ws is not None:
        try:
            await robot_ws.close()
        except Exception:
            pass

    await websocket.accept()
    robot_ws = websocket
    print("[서버] ✅ RPi5 연결됨")

    try:
        while True:
            raw = await websocket.receive()

            # receive()는 끊김을 예외가 아니라 메시지로 알려주므로 직접 확인해서 루프 탈출
            if raw["type"] == "websocket.disconnect":
                break

            if "bytes" in raw and raw["bytes"]:
                # 바이너리 프레임: 오디오 데이터 수신 처리
                await handle_audio(raw["bytes"])

            elif "text" in raw and raw["text"]:
                # 텍스트 프레임: JSON 명령 수신 처리
                try:
                    msg = json.loads(raw["text"])
                    await handle_text(msg)
                except json.JSONDecodeError:
                    print(f"[서버] ⚠️ 유효하지 않은 JSON 수신: {raw['text']}")

    except WebSocketDisconnect:
        pass    # 혹시 예외로 끊김이 들어와도 아래 finally에서 동일하게 정리

    finally:
        # 정상 종료·예외·끊김 어떤 경우든 반드시 실행 → 죽은 연결이 남지 않음
        print("[서버] ❌ RPi5 연결 끊김")
        if robot_ws is websocket:    # 그 사이 RPi가 재접속해서 새 연결로 바뀐 경우엔 지우지 않음
            robot_ws = None


async def handle_audio(data: bytes):
    """
    RPi5 → 서버: 사용자 발화 바이너리 WAV 수신 처리.
    Azure 발음 평가 및 Ollama 분석 수행 후 결과를 RPi5로 회신.
    """
    print(f"[서버] 🎤 오디오 수신: {len(data):,} bytes")
    eval_result = await process_pronunciation_assessment(data)

    # 평가 결과를 RPi5로 다시 전송
    await send_to_robot({
        "type": "evaluation_result",
        "data": eval_result
    })


async def handle_text(msg: dict):
    """
    RPi5 → 서버: JSON 텍스트 메시지 처리.
    """
    global robot_volume
    if msg.get("type") == "volume_state":
        # RPi가 접속할 때 알려주는 실제 볼륨 → 웹 표시와 동기화
        robot_volume = int(msg.get("volume", robot_volume))
        print(f"[서버] 🔈 RPi5 볼륨 보고: {robot_volume}%")
        return
    global current_reference_text
    msg_type = msg.get("type")
    print(f"[서버] 📨 텍스트 수신: type={msg_type}, 내용={msg}")

    # 1. Base64 인코딩된 오디오 전송 처리
    if msg_type == "user_audio":
        audio_b64 = msg.get("audio_b64")
        reference_text = msg.get("reference_text", current_reference_text)
        if audio_b64:
            audio_bytes = base64.b64decode(audio_b64)
            eval_result = await process_pronunciation_assessment(audio_bytes, reference_text)
            await send_to_robot({
                "type": "evaluation_result",
                "data": eval_result
            })

    # 2. 현재 연습할 목표 대사 설정 메시지
    elif msg_type == "set_reference_text":
        current_reference_text = msg.get("text", "")
        print(f"[서버] 🎯 목표 대사 갱신: '{current_reference_text}'")

    # 3. RPi5 상태 ping / pong
    elif msg_type == "ping":
        await send_to_robot({"type": "pong"})


async def send_to_robot(payload: dict) -> bool:
    """RPi5로 명령 전송. 성공 시 True, 미연결·전송 오류 시 False 반환."""
    print(f"[디버그] send_to_robot 호출됨, robot_ws={robot_ws}")
    if robot_ws is None:
        print("[서버] ⚠️ RPi5 미연결 — 명령 전송 실패")
        return False                     # 미연결을 호출부에 알림

    try:
        await robot_ws.send_text(json.dumps(payload))
        print(f"[서버] 📤 명령 전송: type={payload.get('type')}")
        return True                      # 전송 성공
    except Exception as e:
        print(f"[서버] ❌ 명령 전송 중 오류 발생: {e}")
        return False                     # 전송 중 끊김 등

from pydantic import BaseModel

robot_volume = 100    # RPi 현재 볼륨 (RPi 접속 시 RPi가 보고한 값으로 갱신)


class VolumeRequest(BaseModel):
    volume: int


@router.get("/api/robot/volume")
async def get_robot_volume():
    """웹 화면 진입 시 현재 볼륨 표시용"""
    return {"volume": robot_volume}


@router.post("/api/robot/volume")
async def set_robot_volume(req: VolumeRequest):
    """웹에서 볼륨 변경 → 서버에 기억 + RPi로 전달"""
    global robot_volume
    robot_volume = max(0, min(150, req.volume))
    sent = await send_to_robot({"type": "set_volume", "volume": robot_volume})
    return {"volume": robot_volume, "sent": sent}

@router.get("/api/robot/status")
async def robot_status():
    """프론트에서 주기적으로 호출 → 현재 RPi5 WebSocket 연결 여부 반환"""
    return {"connected": robot_ws is not None}