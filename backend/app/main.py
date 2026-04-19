from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.middleware.rate_limit import RateLimitMiddleware
from app.routes.translate import router as translate_router

app = FastAPI(
    title="Smart Translator API",
    description="Backend API for the multilingual translator school project.",
    version="0.1.0",
)

app.add_middleware(
    RateLimitMiddleware,
    max_requests=10,
    window_seconds=60,
    protected_paths={"/translate"},
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translate_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Smart Translator API is running."}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
