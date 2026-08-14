# ProspectIQ – Autonomous AI Executive Assistant

## 🚀 Overview

ProspectIQ is an autonomous multi-agent AI assistant designed to execute complex real-world tasks from a single user request.

Instead of acting like a normal chatbot, AutoMateAI breaks a task into multiple subtasks, delegates them to specialized AI agents, coordinates execution, and provides the final result to the user.

Example:
- Plan an entire trip within a budget
- Book flights and hotels
- Manage calendars
- Research information
- Generate documents
- Send emails
- Organize tasks

All through one conversational interface.

---

## ✨ Features

- 🤖 Multi-Agent Architecture
- 🧠 Intelligent Task Planning
- 📌 Autonomous Task Execution
- 🔄 Real-Time Progress Updates
- 💬 Conversational Interface
- 🔐 Secure Authentication
- 📊 Execution Logs
- 🧩 Modular Agent Design
- ⚡ FastAPI Backend
- 🎨 Modern React Frontend

---

## 🏗 Architecture

```
User
   │
   ▼
Reception Agent
   │
   ▼
Master Planner
   │
   ├── Research Agent
   ├── Travel Agent
   ├── Calendar Agent
   ├── Email Agent
   ├── Document Agent
   └── Memory Agent
          │
          ▼
     Tool/API Layer
          │
          ▼
      Final Response
```

---

## 🛠 Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- FastAPI
- Python
- SQLAlchemy
- PostgreSQL
- Supabase

### AI

- OpenAI / Gemini / Groq
- Multi-Agent Prompting
- Tool Calling

### Authentication

- JWT
- OAuth (Planned)

---

## 📂 Project Structure

```
frontend/
backend/
docs/
assets/
```

---

## ⚙ Installation

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend

python -m venv venv

source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

## 📌 Current Progress (Round 2)

- Project architecture finalized
- Repository initialized
- Frontend setup completed
- Backend setup completed
- Authentication structure created
- API structure defined
- Agent workflow designed
- Initial UI implemented

---

## 🚧 Upcoming

- Master Agent
- Planner Agent
- Memory Module
- Tool Integrations
- Email Automation
- Calendar Integration
- Flight & Hotel APIs
- Deployment

---

## 👥 Team

- Nikita
- Ranjit
- Gaurav

---

## 📄 License

Developed for Hackathon Round 2.

All Rights Reserved © 2026
