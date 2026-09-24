# AI Usage Documentation — SupportNova

SRS §19 requires **one entry per AI-assisted contribution**, and every entry must carry
**all seven fields**: Tool name · Purpose · Assistance requested · Files affected ·
Changes made · Tests performed · Verifying team members.

Entries are appended newest-first as work happens. Do not collapse entries into a phase summary —
a phase-level file list with no per-entry tests/verifier is non-compliant.

**Rule for this repo:** AI-generated source code must be independently reviewed, modified where
required, tested, debugged, and understood. Anyone listed as a verifier must be able to explain
the code they signed off on.

---

## Entry log

### Entry 004 — SRS conformance audit of project documentation

- **Tool name:** Claude (opencode CLI session)
- **Purpose:** Re-read the official SRS (52 pp.) and reconcile it with `doc/task.md`, `doc/spec.md`, `doc/design.md`, `doc/instruction.md`.
- **Assistance requested:** Diff SRS requirements against the current plan/spec/design/instructions; produce the gap table.
- **Files affected:** `doc/task.md`, `doc/spec.md`, `doc/design.md`, `doc/instruction.md`, `project/AI_USAGE.md` (this file).
- **Changes made:** Corrected the policy-document minimum from "8-10" to the SRS value **20+**; added the ten-status lifecycle (`In Progress`/`Awaiting Customer`/`Reopened` were missing); added the exact SRS Step 61-63 dashboard field lists and Step 67's eight report types; added duplicate/repeat detection, SLA tracking and trend detection as tracked items; added a "SRS submission deliverables" block covering `LICENSE`, the required repo folders, the source-code path mapping, the seven-field per-entry `AI_USAGE.md` format and the five-day commit requirement; added design-vs-implementation deviation table (`design.md` §9); rewrote this file into per-entry form.
- **Tests performed:** None — documentation-only change. `git diff --stat` reviewed; markdown re-read for broken references (`task.md` cross-refs to `spec.md` §13 and `instruction.md` §8 still resolve).
- **Verifying team members:** ⚠ **fill in before submission** — every team member must be able to state the SRS values that changed (20+ docs, 10 statuses, 8 reports, 5 commit days).

---

### Entry 003 — Frontend data wiring + error-handling pass

- **Tool name:** Claude (opencode CLI session)
- **Purpose:** The complaint form returned 422 on every UI submit and errors rendered as `[object Object]`; dashboards were static HTML.
- **Assistance requested:** Root-cause the 422, fix frontend/backend contract mismatches, make every loader/form show readable errors, replace static dashboards with live data.
- **Files affected:**
  - `backend/app/schemas/complaint.py` — `ComplaintIn` normalizes `"" → null`, accepts attachments as dict/array/JSON-string, readable messages for empty title/description; `ComplaintOut` exposes `date` + pipeline summaries.
  - `backend/app/routers/complaints.py` — batch-loads Pipeline 1/2 summaries for list/get/create; create wrapped in commit/rollback.
  - `backend/app/routers/analyze.py`, `backend/app/routers/validate.py` — added `GET /api/complaints/{id}/analysis` and `GET /api/complaints/{id}/validation`; POST and GET now share one serializer.
  - `backend/app/main.py` — global JSON handlers for HTTP and unhandled errors.
  - `frontend/src/lib/api.ts` — token injection, login/register excluded from the 401 hard-redirect, timeout, no `/api/api` doubling.
  - `frontend/src/lib/errors.ts` *(new)* — `getErrorMessage()` for FastAPI `detail` as string/array/object plus network/timeout/5xx.
  - `frontend/src/routes/complaints/New.tsx`, `routes/complaints/Detail.tsx`, `routes/{customer,agent,admin}/Dashboard.tsx`, `routes/reviewer/Queue.tsx`, `context/AuthContext.tsx`, `components/ErrorBoundary.tsx` *(new)*.
- **Changes made:** Fixed invalid-Date rendering (`complaint.date` → `created_at`), hard-redirect loop on failed login, static dashboards replaced with fetch + loading/empty/error/retry, role-aware `/` redirect, access-denied page instead of a silent loop.
- **Tests performed:** `pytest -q` → **20 passed** · `npm run build` (tsc + vite) → **clean** (was 5 TS errors) · UI payload → `POST /complaints` **201** · 422/401/404 bodies verified readable · CORS preflight from `:5173` → **200**.
- **Verifying team members:** ⚠ **fill in before submission.**

---

### Entry 002 — Frontend scaffolding (React + Vite)

- **Tool name:** GitHub Copilot / Cursor (scaffolding), reviewed manually
- **Purpose:** Stand up the React SPA shell, routing and auth guard on Day 1.
- **Assistance requested:** Boilerplate for router setup, axios wrapper, auth context and route guard.
- **Files affected:** `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/context/AuthContext.tsx`, `src/lib/api.ts`, `src/components/ProtectedRoute.tsx`, `src/components/Navbar.tsx`, `src/routes/Login.tsx`, `src/routes/customer/Dashboard.tsx`, `src/routes/agent/Dashboard.tsx`, `src/routes/admin/Dashboard.tsx`, `src/routes/reviewer/Queue.tsx`, `src/routes/complaints/New.tsx`, `src/routes/complaints/Detail.tsx`.
- **Changes made:** React root with `BrowserRouter` + auth provider, role-based `ProtectedRoute` wrapper, axios instance with interceptors, dashboard/route skeletons.
- **Tests performed:** `npm run build` (tsc) clean at scaffold time; login route reachable in dev server. *(Later superseded by Entry 003.)*
- **Verifying team members:** ⚠ **fill in before submission.**

---

### Entry 001 — Backend scaffolding (FastAPI)

- **Tool name:** GitHub Copilot / Cursor (scaffolding), reviewed manually
- **Purpose:** Establish the two-pipeline skeleton, data model, RBAC and validation/review modules on Day 1.
- **Assistance requested:** Boilerplate for FastAPI app factory, SQLAlchemy models, Pydantic schemas, router stubs, JWT/RBAC dependencies, module stubs for document processing, knowledge base, rules, GenAI pipeline, Python validation, hallucination checks, comparison engine, security.
- **Files affected:**
  - `backend/app/main.py`, `config.py`
  - `backend/app/db/session.py`, `db/models.py`
  - `backend/app/schemas/*.py`, `backend/app/routers/*.py`
  - `backend/app/document_processing/*.py`, `backend/app/knowledge_base/*.py`, `backend/app/rules/*.py`
  - `backend/app/genai_pipeline/*.py`, `backend/app/python_validation/*.py`
  - `backend/app/hallucination_checks/*.py`, `backend/app/comparison_engine/*.py`, `backend/app/security/*.py`
- **Changes made:** App wiring, CORS, models for Complaint / ComplaintIntelligence / ValidationResult / KnowledgeDocument / Chunk / RuleMatrixEntry / ReviewCase / User, JWT auth with bcrypt and 5 roles, prompt-injection sanitizer, diff + verification-score + status routing, stub routers with TODOs.
- **Tests performed:** `python -m py_compile` over all new modules; app boots on `uvicorn app.main:app`; `pytest` green at scaffold time (20 tests by the end of Entry 003).
- **Verifying team members:** ⚠ **fill in before submission.**

---

## Planned AI-assisted work (must become entries when done)

Log each as a full 7-field entry the day it happens — not in a batch at the end.

- **Complaint dataset drafts (500+):** Gemini to draft batches, then **hand-review/edit** before seeding.
  Declare the tool, the prompt approach, the exact files, and who reviewed which batches.
- **Policy/SOP documents (20+):** Gemini may draft; a human must edit and sign off on versioning and the conflict cases.
- **Rule Matrix (100+ rules / 30+ escalation rules):** **hand-authored, not AI-generated** — if AI is ever used to propose a rule, log it and say who rewrote/accepted it.
- **Reports** (comparison, security, intelligence): AI may format/summarize; the numbers must come from real runs, and the verifier must have re-run them.

**Never ship unedited AI output as ground truth** — that is explicitly called out by the SRS as a reason for reduced or zero marks.
