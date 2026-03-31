import os
from pathlib import Path
from dotenv import load_dotenv

# BASE_DIR = D:\browser_agent\pathfinder-ai\  (parent of backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from project root or backend folder
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "backend" / ".env")


class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    SERPAPI_KEY = os.getenv("SERPAPI_API_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")

    @staticmethod
    def validate():
        if not Config.GROQ_API_KEY:
            print("⚠️  WARNING: GROQ_API_KEY not found in environment or .env")
        if not Config.SERPAPI_KEY:
            print("⚠️  WARNING: SERPAPI_API_KEY not found in environment or .env")


Config.validate()
