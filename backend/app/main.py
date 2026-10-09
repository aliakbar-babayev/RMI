from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.client import model_name
from app.config import settings
from app.db import init_db
from app.errors import install_handlers
from app.routers import analyze, audit, dashboard, escalations, incidents, risks, systems
from app.samples import INCIDENT_SAMPLES, SAMPLES


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="RM AI – Phase 1", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_handlers(app)

for r in (analyze.router, risks.router, dashboard.router, audit.router, incidents.router, escalations.router, systems.router):
    app.include_router(r)


@app.get("/samples", tags=["samples"])
def list_samples():
    return SAMPLES


@app.get("/samples/incidents", tags=["samples"])
def list_incident_samples():
    return INCIDENT_SAMPLES


@app.get("/health", tags=["meta"])
def health():
    return {"ok": True, "model": model_name()}
