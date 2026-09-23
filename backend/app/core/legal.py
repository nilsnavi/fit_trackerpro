"""Versions of the legal documents the app asks the user to accept.

Every consent record stores the version of the text the user actually saw, so
that agreed terms can be proven later. Bump the constant when the wording
changes — the app then asks for consent again and keeps the previous record in
the audit trail.
"""

from __future__ import annotations

#: Current privacy policy wording shown in the Mini App (`/legal/privacy`).
PRIVACY_POLICY_VERSION = "2026-09-23"

#: Current health-data consent wording shown in the Mini App (`/legal/consent`).
HEALTH_DATA_CONSENT_VERSION = "2026-09-23"
