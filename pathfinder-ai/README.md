# Pathfinder AI — Career Intelligence Platform

An AI-powered career guidance platform tailored for the Indian job market. Combines a React + Vite frontend with a FastAPI backend powered by Groq LLM and LangChain to deliver real-time career insights, market analysis, college recommendations, resume coaching, and job search.

---

## Features

| Feature | Description |
|---|---|
| **Career Insights** | AI-generated roadmaps, skill gaps, salary ranges, and career ladders with interactive charts |
| **Market Analysis** | Live job market trends with bento-grid data visualizations |
| **College Advisor** | Top Indian college recommendations filtered by career, location, and district |
| **Resume Coach** | ATS feedback and suggestions for uploaded PDF/DOCX resumes |
| **Jobs & Internships** | Live job listings via SerpAPI for any role and location |
| **Chat Advisor** | Conversational AI career advisor with session history |

---

## Tech Stack

**Frontend**
- React 19 + Vite 6
- Tailwind CSS v4
- React Router v7
- Chart.js + react-chartjs-2
- React Markdown

**Backend**
- FastAPI + Uvicorn
- LangChain + langchain-groq
- Groq LLM (via API)
- SerpAPI (live search)
- PyPDF2 + python-docx (resume parsing)

---

## Project Structure

```
pathfinder-ai/
├── src/                        # React frontend
│   ├── api/client.js           # Axios API client
│   ├── components/             # Navbar, Sidebar, Layout, BottomNav
│   ├── pages/                  # CareerInsights, MarketAnalysis, CollegeAdvisor,
│   │                           #   ResumeCoach, JobsInternships, ChatAdvisor
│   └── utils/chartUtils.js
├── backend/                    # FastAPI backend
│   ├── main.py                 # App entry point
│   ├── config.py               # Env config (Groq + SerpAPI keys)
│   ├── routes/api.py           # All API endpoints
│   ├── ai/
│   │   ├── services/ai_service.py   # LLM & agent logic
│   │   ├── data/career_data.py      # Career categories dataset
│   │   └── utils/                   # file_utils, text_utils
│   ├── requirements.txt
│   └── start.bat               # Windows one-click backend start
├── vite.config.js              # Vite config (proxy → :8000)
├── package.json
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A [Groq API key](https://console.groq.com/)
- A [SerpAPI key](https://serpapi.com/)

---

### 1. Clone & install

```bash
git clone <repo-url>
cd pathfinder-ai
```

**Frontend**
```bash
npm install
```

**Backend**
```bash
pip install -r backend/requirements.txt
```

---

### 2. Configure environment variables

Create a `.env` file in the project root (or in `backend/`):

```env
GROQ_API_KEY=your_groq_api_key_here
SERPAPI_API_KEY=your_serpapi_key_here
SECRET_KEY=your_secret_key_here
```

---

### 3. Run the backend

**Windows (one-click):**
```
backend\start.bat
```

**Or manually from the project root:**
```bash
python -m backend.main
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

---

### 4. Run the frontend

```bash
npm run dev
```

Frontend runs at: `http://localhost:5174`

Vite automatically proxies all `/api/*` requests to the backend at port 8000.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/careers` | All career categories and roles |
| `POST` | `/api/career-insights` | Career roadmap and skill analysis |
| `POST` | `/api/market-analysis` | Live job market analysis |
| `POST` | `/api/college-recommendations` | Top Indian colleges for a career |
| `POST` | `/api/resume-analysis` | AI resume feedback (text or file upload) |
| `POST` | `/api/chat` | Conversational career advisor |
| `POST` | `/api/jobs` | Live job & internship listings |

Full interactive docs: `http://localhost:8000/docs`

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `python -m backend.main` | Start FastAPI server |
