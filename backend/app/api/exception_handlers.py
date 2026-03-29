"""Central FastAPI exception handlers: unified JSON error envelope."""

from __future__ import annotations

import http
import logging
from typing import Any

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging.context import request_id_var
from app.domain.exceptions import DomainError
from app.schemas.errors import ErrorBody, ErrorEnvelope
from app.settings import settings

logger = logging.getLogger(__name__)


def _http_error_code(status_code: int) -> str:
    try:
        return f"http_{http.HTTPStatus(status_code).name.lower()}"
    except ValueError:
        return f"http_{status_code}"


def _normalize_http_detail(detail: Any) -> tuple[str, Any | None]:
    if detail is None:
        return "Request failed", None
    if isinstance(detail, str):
        return detail, None
    if isinstance(detail, dict):
        inner = detail.get("detail", detail)
        if isinstance(inner, str):
            extra = detail if len(detail) > 1 or "detail" not in detail else None
            return inner, jsonable_encoder(extra) if extra else None
        if isinstance(inner, list):
            return "Invalid request", jsonable_encoder(inner)
        return str(inner), jsonable_encoder(detail)
    if isinstance(detail, list):
        return "Invalid request", jsonable_encoder(detail)
    return str(detail), None


def _merge_correlation_headers(
    headers: dict[str, str] | None,
    request_id: str | None,
) -> dict[str, str] | None:
    if not request_id:
        return headers
    merged = dict(headers) if headers else {}
    merged.setdefault("X-Request-ID", request_id)
    merged.setdefault("X-Correlation-ID", request_id)
    return merged


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]] | dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    rid = request_id_var.get()
    body = ErrorEnvelope(
        error=ErrorBody(code=code, message=message, details=details),
        request_id=rid,
    ).model_dump(exclude_none=True)
    return JSONResponse(
        status_code=status_code,
        content=body,
        headers=_merge_correlation_headers(headers, rid),
    )


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return _error_response(
        status_code=exc.http_status,
        code=exc.code,
        message=exc.message,
    )


async def request_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    raw_errors = exc.errors()
    details = [
        {
            "loc": list(e.get("loc", ())),
            "msg": e.get("msg", ""),
            "type": e.get("type", ""),
        }
        for e in raw_errors
    ]
    return _error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        message="Request validation failed",
        details=details,
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    msg, details = _normalize_http_detail(exc.detail)
    code = _http_error_code(exc.status_code)
    hdrs = dict(exc.headers) if exc.headers else None
    return _error_response(
        status_code=exc.status_code,
        code=code,
        message=msg,
        details=details,
        headers=hdrs,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    sentry_sdk.capture_exception(exc)
    logger.exception("Unhandled exception: %s", exc)
    if settings.DEBUG:
        message = str(exc) or "Internal server error"
    else:
        message = "An unexpected error occurred"
    return _error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_error",
        message=message,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
