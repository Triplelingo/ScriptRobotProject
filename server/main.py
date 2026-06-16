import os
import requests
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv
from pydub import AudioSegment
from sqlalchemy import text

import json

# Import the existing SQLAlchemy connection engine asset
from database import engine

# Load system environment keys from backend/.env file
load_dotenv()

app = FastAPI()

app.mount("/recordings", StaticFiles(directory="recordings"), name="recordings")

# Enable CORS so your React frontend (Vite/localhost:5173) can securely call port 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====================================================================
# 1. LOCAL ADMINISTRATIVE SYSTEM LOGISTICS OLLAMA PIPELINE
# ====================================================================
def get_feedback_from_ollama(expected, user_text):
    """
    Sends the target script sentence and decoded user transcription to a local 
    Ollama instance to produce detailed linguistic feedback suggestions.
    """
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
        return response.json()["response"]
    except Exception as e:
        print(f"Ollama Connection Error: {e}")
        return "AI detailed linguistic breakdown is temporarily unavailable. Check if Ollama is running."


# ====================================================================
# 2. HOMEPAGE & USER MANAGEMENT ENDPOINTS
# ====================================================================
@app.get("/")
def home():
    return {"message": "Server Running"}


@app.get("/users")
def get_users():
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                user_id,
                name,
                nickname,
                email,
                status,
                created_at
            FROM users
        """))

        users = []
        for row in result:
            users.append({
                "user_id": row.user_id,
                "name": row.name,
                "nickname": row.nickname,
                "email": row.email,
                "status": row.status,
                "created_at": str(row.created_at)
            })
        return users


@app.patch("/users/{user_id}/status")
def update_status(user_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE users
                SET status = :status
                WHERE user_id = :user_id
            """),
            {
                "status": data["status"],
                "user_id": user_id
            }
        )
        conn.commit()
    return {"message": "success"}


@app.patch("/users/{user_id}")
def update_user(user_id: int, data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE users
                SET name = :name,
                    nickname = :nickname,
                    email = :email
                WHERE user_id = :user_id
            """),
            {
                "name": data["name"],
                "nickname": data["nickname"],
                "email": data["email"],
                "user_id": user_id
            }
        )
        conn.commit()
    return {"message": "success"}


@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    with engine.connect() as conn:
        conn.execute(
            text("""
                DELETE FROM users
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        )
        conn.commit()
    return {"message": "success"}


# ====================================================================
# 3. AUTHENTICATION INFRASTRUCTURE (LOGIN & REGISTRATION)
# ====================================================================
@app.post("/register")
def register_user(data: dict = Body(...)):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT email
                FROM users
                WHERE email = :email
            """),
            {"email": data["email"]}
        ).fetchone()

        if result:
            return {"success": False, "message": "이미 가입된 이메일입니다."}

        conn.execute(
            text("""
                INSERT INTO users
                (name, nickname, email, password, login_type, status)
                VALUES
                (:name, :nickname, :email, :password, 'LOCAL', 'ACTIVE')
            """),
            {
                "name": data["name"],
                "nickname": data["nickname"],
                "email": data["email"],
                "password": data["password"]
            }
        )
        conn.commit()
    return {"success": True, "message": "회원가입 성공"}


@app.post("/login")
def login_user(data: dict = Body(...)):
    with engine.connect() as conn:
        user = conn.execute(
            text("""
                SELECT
                    user_id,
                    name,
                    nickname,
                    email,
                    password,
                    login_type,
                    status
                FROM users
                WHERE email = :email
            """),
            {"email": data["email"]}
        ).fetchone()

        if not user:
            return {"success": False, "message": "존재하지 않는 이메일입니다."}

        if user.password != data["password"]:
            return {"success": False, "message": "비밀번호가 일치하지 않습니다."}

        if user.status == "BLOCKED":
            return {"success": False, "message": "차단된 계정입니다."}

        return {
            "success": True,
            "message": "로그인 성공",
            "user": {
                "user_id": user.user_id,
                "name": user.name,
                "nickname": user.nickname,
                "email": user.email,
                "login_type": user.login_type,
                "status": user.status
            }
        }


# ====================================================================
# 4. CUSTOM SCENARIO PARSING & SELECTION DATA-LOGS
# ====================================================================
@app.post("/scripts")
def create_script(data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO scripts
                (user_id, title, content)
                VALUES
                (:user_id, :title, :content)
            """),
            {
                "user_id": data.get("user_id"),
                "title": data["title"],
                "content": data["content"]
            }
        )
        conn.commit()
    return {"success": True, "message": "대본 저장 성공"}


@app.get("/scripts")
def get_scripts():
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT script_id, user_id, title, content, created_at
                FROM scripts
                ORDER BY script_id DESC
            """)
        )

        scripts = []
        for row in result:
            scripts.append({
                "script_id": row.script_id,
                "user_id": row.user_id,
                "title": row.title,
                "content": row.content,
                "created_at": str(row.created_at)
            })
        return scripts


@app.get("/api/scripts")
async def get_all_scripts_api():
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT script_id, user_id, title, content, status, created_at
                FROM scripts
                ORDER BY script_id DESC
            """)
        )
        scripts = []
        for row in result:
            scripts.append({
                "script_id": row.script_id,
                "user_id": row.user_id,
                "title": row.title,
                "content": row.content,
                "status": row.status,
                "created_at": str(row.created_at)
            })
        return scripts

@app.get("/api/scripts/{script_id}")
async def get_parsed_script(script_id: int):
    """
    Fetches raw multiline database scripts and automatically chunks them into 
    individual timeline conversation blocks for the Practice Engine.
    """
    with engine.connect() as conn:
        script = conn.execute(
            text("""
                SELECT script_id, title, content, created_at
                FROM scripts
                WHERE script_id = :script_id
            """),
            {"script_id": script_id}
        ).fetchone()

        if not script:
            raise HTTPException(status_code=404, detail="대본이 없습니다.")

        raw_content = script.content
        parsed_lines = []
        raw_lines = [line.strip() for line in raw_content.split('\n') if line.strip()]

        # Emotion assignment tracking fallback ledger index map
        emotion_map = ["joy", "joy", "fear", "fear", "surprise", "surprise", "anger", "anger", "sadness", "sadness", "disgust", "disgust", "neutral", "neutral"]

        for idx, line in enumerate(raw_lines):
            if ":" in line:
                character, text_content = line.split(":", 1)
                character = character.strip()
                text_content = text_content.strip()
                
                inferred_emotion = emotion_map[idx] if idx < len(emotion_map) else "neutral"
                
                parsed_lines.append({
                    "id": idx + 1,
                    "character": character,
                    "text": text_content,
                    "scores": None,
                    "emotion": inferred_emotion,
                    "avatar": "🤖" if character in ["Alex", "Romeo", "Jack"] else "나"
                })

        return {
            "title": script.title,
            "lines": parsed_lines
        }


# ====================================================================
# 5. NATURAL EMOTIONAL TEXT-TO-SPEECH VOICEACTING ENGINE
# ====================================================================
@app.post("/api/speak")
async def robot_speak(
    text: str = Form(...),
    emotion: str = Form(...),
    character: str = Form(...) 
):
    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=os.getenv("AZURE_SPEECH_KEY"),
            region=os.getenv("AZURE_SPEECH_REGION")
        )
        
        # Select voice based on current conversational character mapping parameters
        if character == "Sara":
            voice_name = 'en-US-AvaNeural'     # 👩 Female Actor profile
        else:
            voice_name = 'en-US-AndrewNeural'  # 🤖 Male Actor profile

        style = "neutral"
        rate = "+0.0%"   
        pitch = "+0.0%"  

        if emotion == "joy":
            style, rate, pitch = "cheerful", "+8.0%", "+12.0%"
        elif emotion == "sadness":
            style, rate, pitch = "sad", "-15.0%", "-10.0%"
        elif emotion == "anger":
            style, rate, pitch = "angry", "+5.0%", "-5.0%"
        elif emotion == "fear":
            style, rate, pitch = "terrified", "+18.0%", "+15.0%"
        elif emotion == "disgust":
            style, rate, pitch = "unfriendly", "-10.0%", "-6.0%"
        elif emotion == "surprise":
            style, rate, pitch = "excited", "+12.0%", "+20.0%"

        # Dynamic structural SSML markup synthesis constructor block
        ssml_string = f"""
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
            <voice name='{voice_name}'>
                <mstts:express-as style='{style}' styledegree='2.0'>
                    <prosody rate='{rate}' pitch='{pitch}'>
                        {text}
                    </prosody>
                </mstts:express-as>
            </voice>
        </speak>
        """

        audio_config = speechsdk.audio.AudioOutputConfig(use_default_speaker=True)
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
        
        result = synthesizer.speak_ssml_async(ssml_string).get()
        del synthesizer

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return {"status": "success", "message": f"Successfully spoke naturally as {voice_name}"}
        else:
            return {"status": "error", "message": f"TTS synthesis canceled: {result.reason}"}
            
    except Exception as err:
        return {"status": "error", "message": f"Hardware playback execution failure: {str(err)}"}


# ====================================================================
# 6. AUDIO TRANSCODING & PRONUNCIATION COGNITIVE CORE
# ====================================================================
@app.post("/api/evaluate")
async def evaluate_audio(
    reference_text: str = Form(...), 
    file: UploadFile = File(...)
):
    temp_upload = "upload_raw.webm"
    temp_filename = "temp_user_voice.wav"
    
    audio_bytes = await file.read()
    with open(temp_upload, "wb") as buffer:
        buffer.write(audio_bytes)

    try:
        # Transcode compressed WebM browser input streams to raw 16kHz Mono PCM format 
        audio = AudioSegment.from_file(temp_upload)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(temp_filename, format="wav")
        
        if os.path.exists(temp_upload): 
            os.remove(temp_upload)

        speech_config = speechsdk.SpeechConfig(
            subscription=os.getenv("AZURE_SPEECH_KEY"),
            region=os.getenv("AZURE_SPEECH_REGION")
        )
        audio_config = speechsdk.AudioConfig(filename=temp_filename)
        
        pron_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme
        )

        recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        pron_config.apply_to(recognizer)
        result = recognizer.recognize_once()

        # Release background audio streams to prevent file-lock crashes on Windows machines
        del recognizer

        # 오디오 파일 저장 (삭제 전에)
        import uuid, shutil
        audio_filename = f"recordings/{uuid.uuid4()}.wav"
        shutil.copy(temp_filename, audio_filename)

        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            pron_result = speechsdk.PronunciationAssessmentResult(result)
            feedback = get_feedback_from_ollama(reference_text, result.text)

            word_details = []
            for word in pron_result.words:
                word_details.append({
                    "word": word.word,
                    "accuracy": word.accuracy_score,
                    "error_type": word.error_type if word.error_type else "None"
                })

            return {
                "status": "success",
                "audio_url": f"http://localhost:8000/{audio_filename}",
                "user_text": result.text,
                "accuracy": pron_result.accuracy_score,
                "fluency": pron_result.fluency_score,
                "completeness": pron_result.completeness_score,
                "pronunciation": pron_result.pronunciation_score,
                "words": word_details,
                "feedback": feedback
            }

        return {
            "status": "error", 
            "message": f"Speech not recognized or matched. Status code: {result.reason}"
        }

    except Exception as err:
        if os.path.exists(temp_upload): os.remove(temp_upload)
        if os.path.exists(temp_filename): os.remove(temp_filename)
        return {"status": "error", "message": f"Internal Server Error: {str(err)}"}


if __name__ == "__main__":
    import uvicorn
    # Initialized on local port 8000 with watch hot-reloading active
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ====================================================================
# 7. WEBSOCKET & RPi5 ROBOT HARDWARE CONTROL
# ====================================================================
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

# 현재 연결된 RPi5 WebSocket
robot_ws: WebSocket | None = None

@app.websocket("/ws/robot")
async def robot_endpoint(websocket: WebSocket):
    global robot_ws
    await websocket.accept()
    robot_ws = websocket
    print("[서버] ✅ RPi5 연결됨")
    try:
        while True:
            raw = await websocket.receive()
            if "text" in raw:
                msg = json.loads(raw["text"])
                print(f"[서버] 📨 수신: type={msg.get('type')}, 내용={msg}")
    except WebSocketDisconnect:
        print("[서버] ❌ RPi5 연결 끊김")
        robot_ws = None

async def send_to_robot(payload: dict):
    if robot_ws is None:
        print("[서버] ⚠️ RPi5 미연결")
        return
    await robot_ws.send_text(json.dumps(payload))

class RobotSpeakRequest(BaseModel):
    text: str
    emotion: str = "neutral"
    character: str = "Alex"
    voice: str = "Jenny"
    speed: float = 1.0

@app.post("/api/robot/speak")
async def robot_speak_to_rpi5(req: RobotSpeakRequest):
    """웹에서 로봇 대사 → TTS 생성 → RPi5로 전송"""
    import base64

    EMOTION_STYLE = {
        "joy":      ("cheerful",    "+8.0%",  "+12.0%"),
        "surprise": ("excited",     "+12.0%", "+20.0%"),
        "anger":    ("angry",       "+5.0%",  "-5.0%"),
        "sadness":  ("sad",         "-15.0%", "-10.0%"),
        "fear":     ("terrified",   "+18.0%", "+15.0%"),
        "disgust":  ("unfriendly",  "-10.0%", "-6.0%"),
        "neutral":  ("general",     "+0.0%",  "+0.0%"),
    }
    
    voice_name = 'en-US-AvaNeural' if req.voice == 'Jenny' else 'en-US-AndrewNeural'
    style, rate, pitch = EMOTION_STYLE.get(req.emotion, ("general", "+0.0%", "+0.0%"))

    # speed 적용
    base_rate = float(rate.replace('%', '').replace('+', ''))
    adjusted = base_rate + (req.speed - 1.0) * 100
    rate = f"{'+' if adjusted >= 0 else ''}{adjusted:.1f}%"
    
    ssml = f"""
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
        <voice name='{voice_name}'>
            <mstts:express-as style='{style}' styledegree='2.0'>
                <prosody rate='{rate}' pitch='{pitch}'>
                    {req.text}
                </prosody>
            </mstts:express-as>
        </voice>
    </speak>
    """

    speech_config = speechsdk.SpeechConfig(
        subscription=os.getenv("AZURE_SPEECH_KEY"),
        region=os.getenv("AZURE_SPEECH_REGION")
    )
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
    )

    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_ssml_async(ssml).get()
    del synthesizer

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio_b64 = base64.b64encode(result.audio_data).decode()
        await send_to_robot({
            "type": "speak",
            "line_id": 0,
            "audio_b64": audio_b64,
            "emotion": req.emotion
        })
        return {"status": "sent"}
    else:
        return {"status": "error", "message": str(result.reason)}
    
@app.post("/api/robot/standby")
async def robot_standby():
    """웹에서 내 차례 → RPi5로 standby 전송"""
    await send_to_robot({"type": "standby"})
    return {"status": "sent"}
    
# ====================================================================
# 8. SCRIPT LINES MANAGEMENT
# ====================================================================
@app.post("/api/scripts/{script_id}/lines")
async def save_script_lines(script_id: int, data: dict = Body(...)):
    """대본 파싱 결과를 script_lines 테이블에 저장"""
    with engine.connect() as conn:
        # 기존 라인 삭제 후 재저장
        conn.execute(
            text("DELETE FROM script_lines WHERE script_id = :script_id"),
            {"script_id": script_id}
        )
        for line in data["lines"]:
            conn.execute(
                text("""
                    INSERT INTO script_lines 
                    (script_id, line_order, character_name, text, emotion)
                    VALUES (:script_id, :line_order, :character_name, :text, :emotion)
                """),
                {
                    "script_id": script_id,
                    "line_order": line["id"],
                    "character_name": line["character"],
                    "text": line["text"],
                    "emotion": line["emotion"]
                }
            )
        conn.commit()
    return {"success": True}

@app.patch("/api/lines/{line_id}/emotion")
async def update_line_emotion(line_id: int, data: dict = Body(...)):
    """감정 변경 시 DB 업데이트"""
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE script_lines 
                SET emotion = :emotion 
                WHERE line_id = :line_id
            """),
            {"emotion": data["emotion"], "line_id": line_id}
        )
        conn.commit()
    return {"success": True}

@app.get("/api/scripts/{script_id}/lines")
async def get_script_lines(script_id: int):
    """script_lines 테이블에서 대사 목록 불러오기"""
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT line_id, line_order, character_name, text, emotion
                FROM script_lines
                WHERE script_id = :script_id
                ORDER BY line_order
            """),
            {"script_id": script_id}
        )
        lines = []
        for row in result:
            lines.append({
                "line_id": row.line_id,
                "id": row.line_order,
                "character": row.character_name,
                "text": row.text,
                "emotion": row.emotion
            })
        return lines
    
@app.post("/api/robot/end_recording")
async def robot_end_recording():
    await send_to_robot({"type": "end_recording"})
    return {"status": "sent"}

# ====================================================================
# 9. PRACTICE SESSION HISTORY
# ====================================================================
@app.post("/api/sessions")
async def save_session(data: dict = Body(...)):
    """연습 세션 저장"""
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO practice_sessions
                (user_id, script_id, chosen_role, total_lines, average_score)
                VALUES (:user_id, :script_id, :chosen_role, :total_lines, :average_score)
            """),
            {
                "user_id": data["user_id"],
                "script_id": data["script_id"],
                "chosen_role": data["chosen_role"],
                "total_lines": data["total_lines"],
                "average_score": data["average_score"]
            }
        )
        conn.commit()
    return {"success": True}

@app.get("/api/sessions/{user_id}")
async def get_sessions(user_id: int):
    """유저 연습 기록 불러오기"""
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT ps.session_id, ps.chosen_role, ps.total_lines, 
                       ps.average_score, ps.created_at, s.title
                FROM practice_sessions ps
                JOIN scripts s ON ps.script_id = s.script_id
                WHERE ps.user_id = :user_id
                ORDER BY ps.created_at DESC
            """),
            {"user_id": user_id}
        )
        sessions = []
        for row in result:
            sessions.append({
                "session_id": row.session_id,
                "title": row.title,
                "chosen_role": row.chosen_role,
                "total_lines": row.total_lines,
                "average_score": round(row.average_score),
                "created_at": str(row.created_at)
            })
        return sessions