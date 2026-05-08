import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.routes.api import router

app = FastAPI(
    title="Pathfinder AI — Career Intelligence Platform",
    description="AI-powered career guidance for the Indian job market, powered by Groq LLM & LangChain.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

_default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
origins = os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_SECRET = os.getenv("APP_SECRET")

@app.middleware("http")
async def check_secret(request: Request, call_next):
    if APP_SECRET and request.url.path.startswith("/api"):
        if request.headers.get("X-App-Secret") != APP_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    return await call_next(request)

app.include_router(router, prefix="/api")


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "Pathfinder AI",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health():
    # Cheap endpoint with no AI init — used by the frontend on app mount to
    # wake the Render dyno before the user navigates anywhere.
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
