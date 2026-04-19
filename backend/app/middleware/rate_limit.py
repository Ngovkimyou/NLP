from collections import defaultdict, deque
from time import monotonic
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        max_requests: int,
        window_seconds: int,
        protected_paths: set[str],
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.protected_paths = protected_paths
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        if request.method != "POST" or request.url.path not in self.protected_paths:
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"
        now = monotonic()
        timestamps = self.requests[client_host]

        while timestamps and now - timestamps[0] >= self.window_seconds:
            timestamps.popleft()

        if len(timestamps) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - timestamps[0])))
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many translation requests. Please wait a moment and try again."
                },
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        return await call_next(request)
