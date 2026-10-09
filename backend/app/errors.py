import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger("rm_ai")


class AppError(Exception):
    """Raised anywhere in the app; returned to clients as {"error", "message"}."""

    def __init__(self, status_code: int, error: str, message: str):
        self.status_code = status_code
        self.error = error
        self.message = message


def _body(error: str, message: str, **extra) -> dict:
    return {"error": error, "message": message, **extra}


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=_body(exc.error, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()
        ]
        return JSONResponse(
            status_code=422, content=_body("validation_error", "Invalid request.", details=details)
        )

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        # Log where it failed but not the exception message: messages (e.g. from validation)
        # can contain document text. The client gets no details at all.
        frames = "".join(traceback.format_tb(exc.__traceback__))
        logger.error("Unhandled %s on %s %s\n%s", type(exc).__name__, request.method, request.url.path, frames)
        return JSONResponse(status_code=500, content=_body("internal_error", "Something went wrong."))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code, content=_body(code, str(exc.detail)))
