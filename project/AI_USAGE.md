# AI Usage Documentation

This document tracks AI-assisted code generation for the SupportNova project.

## Tools Used
- **Primary**: GitHub Copilot / Cursor / Claude (for scaffolding, boilerplate, and repetitive patterns)
- **Reference**: Gemini API (for dataset generation prompts, not production code)

## Files Affected

### Backend Scaffolding (Phase 1)
- `backend/app/main.py` — FastAPI app setup, CORS, router registration
- `backend/app/config.py` — Pydantic Settings from .env
- `backend/app/db/session.py` — SQLAlchemy engine, session, Base
- `backend/app/db/models.py` — SQLAlchemy models for all core entities
- `backend/app/schemas/*.py` — Pydantic schemas (complaint, intelligence, rule_matrix, document, review, dashboard)
- `backend/app/routers/*.py` — Router stubs with TODO comments
- `backend/app/document_processing/*.py` — Validators, parsers, chunker, version_control
- `backend/app/knowledge_base/*.py` — Embeddings, retriever stubs
- `backend/app/rules/*.py` — Rule matrix loader, routing, escalation rules
- `backend/app/genai_pipeline/*.py` — Gemini client, prompt builder, retry, logger
- `backend/app/python_validation/*.py` — Schema validator, rule checker, resolution checker
- `backend/app/hallucination_checks/*.py` — Fact checker, promise detector stubs
- `backend/app/comparison_engine/*.py` — Diff, verification score, router
- `backend/app/security/*.py` — Prompt injection guard, JWT auth with RBAC

### Frontend Scaffolding (Phase 1)
- `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- `frontend/src/main.tsx` — React root with BrowserRouter + AuthProvider
- `frontend/src/App.tsx` — Route definitions with ProtectedRoute
- `frontend/src/context/AuthContext.tsx` — Auth state, login/register/logout
- `frontend/src/lib/api.ts` — Axios instance with interceptors
- `frontend/src/components/ProtectedRoute.tsx` — Role-based route guard
- `frontend/src/components/Navbar.tsx` — Navigation with role-aware links
- `frontend/src/routes/Login.tsx` — Login/Register form
- `frontend/src/routes/customer/Dashboard.tsx` — Customer complaint list
- `frontend/src/routes/agent/Dashboard.tsx` — Agent assigned complaints
- `frontend/src/routes/admin/Dashboard.tsx` — Admin stats overview
- `frontend/src/routes/reviewer/Queue.tsx` — Manual review queue
- `frontend/src/routes/complaints/New.tsx` — Complaint submission form
- `frontend/src/routes/complaints/Detail.tsx` — Complaint detail with pipeline actions

## Human Verification
All AI-generated code was reviewed for:
- Correctness of FastAPI/React patterns
- Alignment with `design.md` architecture
- Security considerations (no hardcoded secrets, proper RBAC stubs)
- Separation of Pipeline 1 and Pipeline 2 concerns
- Proper use of Pydantic models as shared JSON contracts

## Dataset Generation (Planned for Day 1-3)
- Complaint dataset (500+): Will use Gemini to draft batches, then hand-review/edit
- Policy documents (20+): Will use Gemini to draft, then hand-review/edit
- Rule Matrix (100+): Hand-authored, not AI-generated
- All AI-assisted dataset generation will be logged here with dates and verification steps

## Verification
- Code compiles without errors (`tsc` for frontend, `python -m py_compile` for backend)
- No secrets committed (`.env` in `.gitignore`)
- Structure matches `design.md` exactly