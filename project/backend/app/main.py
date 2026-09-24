from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, complaints, documents, analyze, validate, review, dashboard, reports


app = FastAPI(title="SupportNova API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(complaints.router, prefix="/api/complaints", tags=["complaints"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(analyze.router, prefix="/api/complaints", tags=["analyze"])
app.include_router(validate.router, prefix="/api/complaints", tags=["validate"])
app.include_router(review.router, prefix="/api/review", tags=["review"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/health")
async def health():
    return {"status": "ok"}