import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.routers import auth, complaints, documents, analyze, validate, review, dashboard, reports


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("supportnova")

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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Every HTTP error leaves the API as JSON with a human-readable `detail`."""
    detail = exc.detail
    if not isinstance(detail, (str, dict, list)):
        detail = str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    """422s from Pydantic, flattened into a single readable message plus the raw errors."""
    from fastapi.encoders import jsonable_encoder

    messages = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
        message = error.get("msg", "Invalid value")
        messages.append(f"{location}: {message}" if location else message)

    return JSONResponse(
        status_code=422,
        content={
            "detail": "; ".join(messages) or "Request validation failed",
            "errors": jsonable_encoder(exc.errors()),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Unexpected failures return JSON (never an HTML stack trace) and are logged server-side."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again or contact support."},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
