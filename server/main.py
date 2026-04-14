from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ws_router import router as ws_router                    # 기존 WebSocket 라우터
from routers.parse_router import router as parse_router, load_anchors  # 새 파싱 라우터

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_anchors()   # 서버 시작 시 DB 앵커 로드 + 벡터화 1회 실행
    yield

app = FastAPI(lifespan=lifespan)

# React 개발 서버(5173)에서 FastAPI(8000)로 요청 시 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(ws_router)      # /ws/robot
app.include_router(parse_router)   # /api/parse

@app.get("/")
async def root():
    """서버 동작 확인용 기본 엔드포인트"""
    return {"status": "server running"}