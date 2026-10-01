import pytest

from app.middleware.rate_limit import POLICY_COACH_INVITATIONS, RateLimitMiddleware
from app.settings import settings


@pytest.mark.parametrize(
    ("method", "path", "expected"),
    [
        ("POST", "/api/v1/coach/invitations", POLICY_COACH_INVITATIONS),
        ("GET", "/api/v1/coach/invitations", None),
        ("POST", "/api/v1/coach/invitations/resolve", None),
        ("POST", "/api/v1/coach/invitations/accept", None),
        ("DELETE", "/api/v1/coach/invitations/abc", None),
    ],
)
def test_coach_invitation_policy_is_only_for_create(method, path, expected):
    middleware = object.__new__(RateLimitMiddleware)
    policy, limit, window = middleware._resolve_policy(path, method)
    if expected:
        assert (policy, limit, window) == (
            expected,
            settings.RATE_LIMIT_COACH_INVITATIONS_REQUESTS,
            settings.RATE_LIMIT_COACH_INVITATIONS_WINDOW_SECONDS,
        )
    else:
        assert policy != POLICY_COACH_INVITATIONS
