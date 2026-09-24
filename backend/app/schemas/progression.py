"""Progression Schemas (SPEC-006 §6/§8/§41)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.domain.progression.types import (
    Confidence,
    RecommendationLifecycle,
    RecommendationStatus,
    TimePriority,
)
from app.schemas.enums import ProgressionBulkSkipReason, ProgressionPolicy


class ProgressionPolicyResponse(BaseModel):
    """Effective policy for one progression scope (SPEC §6/§7)."""

    id: Optional[int] = Field(None, description="Null when the scope still uses defaults.")
    user_id: int
    exercise_id: int
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None
    scope_key: str = Field(
        ...,
        description="Progression scope: user + template + exercise + program slot.",
    )
    policy_scope_key: Optional[str] = Field(
        None,
        description=(
            "Scope the stored policy row actually lives in; differs from scope_key when "
            "a template-level or user-level policy is inherited. Null for defaults."
        ),
    )
    type: ProgressionPolicy = ProgressionPolicy.MANUAL
    policy_version: str = "MANUAL_V1"
    increment: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    sets_target: Optional[int] = None
    target_rpe: Optional[float] = None
    target_rir: Optional[float] = None
    percent_1rm: Optional[float] = None
    time_increment_seconds: Optional[int] = None
    time_target_seconds: Optional[int] = None
    time_priority: Optional[TimePriority] = None
    failure_threshold: Optional[int] = None
    deload_percent: Optional[float] = None
    equipment_increment: Optional[float] = None
    enabled: bool = True


class ProgressionPolicyUpdate(BaseModel):
    """PUT body: configure progression for one exercise scope."""

    type: ProgressionPolicy = Field(
        default=ProgressionPolicy.MANUAL,
        description="MANUAL never computes a target; the engine only proposes for other types.",
    )
    increment: Optional[float] = Field(None, gt=0, le=200)
    min_value: Optional[float] = Field(None, ge=0, le=2000)
    max_value: Optional[float] = Field(None, ge=0, le=2000)
    reps_min: Optional[int] = Field(None, ge=0, le=1000)
    reps_max: Optional[int] = Field(None, ge=0, le=1000)
    sets_target: Optional[int] = Field(None, ge=1, le=50)
    target_rpe: Optional[float] = Field(None, ge=1, le=10)
    target_rir: Optional[float] = Field(None, ge=0, le=10)
    percent_1rm: Optional[float] = Field(None, gt=0, le=200)
    time_increment_seconds: Optional[int] = Field(None, ge=1, le=3600)
    time_target_seconds: Optional[int] = Field(None, ge=1, le=86400)
    time_priority: Optional[TimePriority] = Field(
        None, description="Weight+time exercises: TIME_FIRST or WEIGHT_FIRST (SPEC §24)."
    )
    failure_threshold: Optional[int] = Field(None, ge=1, le=20)
    deload_percent: Optional[float] = Field(None, gt=0, le=90)
    equipment_increment: Optional[float] = Field(None, gt=0, le=50)
    enabled: bool = True


class ProgressionRecommendationResponse(BaseModel):
    """Explainable recommendation (SPEC §8/§27/§28/§29/§46)."""

    id: Optional[int] = Field(None, description="Null for a non-persisted preview.")
    exercise_id: int
    exercise_name: Optional[str] = None
    scope_key: str
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None
    policy: ProgressionPolicy = ProgressionPolicy.MANUAL
    policy_version: str = "MANUAL_V1"
    effective_policy: Optional[ProgressionPolicy] = Field(
        None,
        description=(
            "Policy that governs the scope right now. Differs from ``policy`` (the "
            "policy this target was produced by) once the target's policy is edited "
            "on the settings screen (SPEC §58)."
        ),
    )
    effective_increment: Optional[float] = Field(
        None, description="Step the scope progresses by now (equipment-aware)."
    )
    effective_time_increment_seconds: Optional[int] = Field(
        None, description="Time step in seconds for time-based policies (SPEC §24)."
    )
    status: RecommendationStatus = RecommendationStatus.INSUFFICIENT_DATA
    lifecycle_status: RecommendationLifecycle = RecommendationLifecycle.GENERATED
    previous_value: Optional[float] = None
    recommended_value: Optional[float] = None
    actual_selected_value: Optional[float] = None
    difference: Optional[float] = None
    previous_reps: Optional[int] = None
    recommended_reps: Optional[int] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    previous_duration: Optional[int] = None
    recommended_duration: Optional[int] = None
    reason_code: str = ""
    reason_text: str = ""
    confidence: Confidence = Confidence.LOW
    failure_streak: int = 0
    source_session_id: Optional[int] = None
    created_at: Optional[datetime] = None
    persisted: bool = False
    idempotent_replay: bool = False
    prefill_declined: bool = Field(
        False,
        description=(
            "True when the user undid this target's automatic prefill: it stays "
            "accepted, but a new session no longer starts on it (SPEC §58)."
        ),
    )
    recovery_warning: Optional[str] = Field(
        None, description="Advisory only — recovery never changes the recommendation (SPEC §34)."
    )


class ProgressionBulkSkipped(BaseModel):
    """One selected target a bulk action did not change, explained (SPEC §58).

    Reporting the id alone leaves the user guessing which goal was left behind;
    the name, the value it still carries and the scope come along so the screen
    can name the row exactly like the list does. A target that is not a current
    accepted target can only be identified by its id — and a record that a newer
    target replaced says which id to address instead, so the caller never has to
    guess which row the slot belongs to now.
    """

    recommendation_id: int
    reason: ProgressionBulkSkipReason
    superseded_by: Optional[int] = Field(
        None,
        description=(
            "The target that owns this scope now, when the skipped record was "
            "replaced by a newer one (`superseded`); null for every other reason."
        ),
    )
    exercise_id: Optional[int] = None
    exercise_name: Optional[str] = Field(
        None, description="Catalog name; null when the target no longer exists."
    )
    value: Optional[float] = Field(
        None, description="The target's current value (kg, or seconds when timed)."
    )
    unit: Optional[str] = Field(None, description="'kg' or 'seconds'.")
    scope_key: Optional[str] = Field(
        None, description="Progression scope the skipped target belongs to."
    )


class ProgressionBulkResult(BaseModel):
    """Outcome of a bulk change across accepted targets (SPEC §58)."""

    updated: int = Field(0, description="Targets the change actually applied to.")
    changed_ids: list[int] = Field(
        default_factory=list,
        description=(
            "Exactly the targets the change applied to — not the ids that were "
            "requested. A caller can hand them straight back to undo the action "
            "without re-deriving what changed from the response."
        ),
    )
    skipped: list[ProgressionBulkSkipped] = Field(
        default_factory=list,
        description=(
            "Targets the change did not apply to, each with the reason: unknown, "
            "someone else's, no longer an accepted target, or — for switching the "
            "prefill off — already switched off."
        ),
    )
    released_ids: list[int] = Field(
        default_factory=list,
        description=(
            "Sweep members an undo released: targets a newer one replaced, which "
            "no undo can switch back on. Their prefill stays off and only the "
            "sweep stamp is cleared, so the entry stops holding a goal nobody can "
            "restore. Empty for every other bulk action."
        ),
    )
    applied_to_all: bool = Field(
        False,
        description="True when the request addressed every current target of the user.",
    )


class ProgressionPrefillBulkDisable(BaseModel):
    """POST body: switch the automatic prefill off for many targets at once."""

    recommendation_ids: Optional[list[int]] = Field(
        None,
        max_length=200,
        description=(
            "Targets to switch off. Omit (or send null) to switch off every "
            "accepted target the settings screen lists."
        ),
    )


class ProgressionPrefillBulkEnable(BaseModel):
    """POST body: switch the automatic prefill back on — the undo of a sweep.

    Two addresses, never both: the exact targets an action reported as changed,
    or whole sweeps. A sweep id is the honest way to undo one link of the chain
    (and to undo several at once): the caller does not have to re-state a set of
    ids it merely read, and a chain longer than the id cap is still one call.
    """

    recommendation_ids: Optional[list[int]] = Field(
        None,
        min_length=1,
        max_length=200,
        description="The targets to switch back on (the changed set of one action).",
    )
    sweep_ids: Optional[list[str]] = Field(
        None,
        min_length=1,
        max_length=20,
        description=(
            "Sweeps whose still-switched-off targets come back, resolved "
            "server-side. This is what «вернуть всё» in the undo journal sends."
        ),
    )

    @model_validator(mode="after")
    def _exactly_one_address(self) -> "ProgressionPrefillBulkEnable":
        if (self.recommendation_ids is None) == (self.sweep_ids is None):
            raise ValueError("Give either recommendation_ids or sweep_ids, not both")
        return self


class ProgressionPrefillSweepSuperseded(BaseModel):
    """A sweep member a newer target replaced, so no undo can bring it back (§58)."""

    recommendation_id: int
    superseded_by: Optional[int] = Field(
        None,
        description="The target that owns the scope now, when it is still known.",
    )


class ProgressionPrefillSweep(BaseModel):
    """One bulk switch-off the server still holds (SPEC §58).

    Read-only view of a sweep that has targets switched off: the ids to hand to
    ``POST /prefill/bulk-enable``, plus when it happened so a chain of sweeps can
    be told apart. It carries no report — how many targets a sweep skipped and
    why is not reconstructed after the fact — so an undo promises the targets and
    nothing else. A sweep left with no targets at all (undone in full, or its last
    one switched back on by hand) is not listed. A sweep whose members were all
    replaced by newer targets is listed with ``restorable`` false and them named in
    ``superseded``: the action stays visible and says there is nothing to switch
    back on, instead of disappearing and leaving its stamp unreachable.
    """

    sweep_id: str = Field(
        description="Identifier shared by the targets one bulk action switched off."
    )
    declined_at: Optional[datetime] = Field(
        None, description="When that action switched its last target off."
    )
    restorable: bool = Field(
        True,
        description=(
            "False when every member it still holds was replaced by a newer "
            "target, so its undo has nothing to switch back on."
        ),
    )
    updated: int = Field(
        0,
        description=(
            "Members it switched off that are still switched off *and* still the "
            "target of their scope — what its undo really brings back."
        ),
    )
    changed_ids: list[int] = Field(
        default_factory=list,
        description="Exactly the set its undo brings back.",
    )
    superseded: list[ProgressionPrefillSweepSuperseded] = Field(
        default_factory=list,
        description=(
            "Members it still holds that a newer target replaced; nothing can be "
            "switched back on through them."
        ),
    )


class ProgressionPrefillSweepListResponse(BaseModel):
    """SPEC §58: the chain of bulk switch-offs that can still be undone."""

    sweeps: list[ProgressionPrefillSweep] = Field(
        default_factory=list, description="Newest sweep first."
    )
    total: int = 0


class ProgressionTargetBulkUpdate(BaseModel):
    """POST body: apply one policy / rep-range edit to several targets (§58).

    ``value`` is deliberately absent: a bulk action configures how the scopes
    progress, while the next number stays a per-target decision.
    """

    recommendation_ids: list[int] = Field(..., min_length=1, max_length=200)
    type: Optional[ProgressionPolicy] = Field(
        None, description="Policy type applied to each selected target's own scope."
    )
    reps_min: Optional[int] = Field(None, ge=0, le=1000)
    reps_max: Optional[int] = Field(None, ge=0, le=1000)


class ProgressionPrefillListResponse(BaseModel):
    """SPEC §58: accepted targets and whether they prefill new sessions."""

    items: list[ProgressionRecommendationResponse] = Field(default_factory=list)
    total: int = 0


class ProgressionTargetUpdate(BaseModel):
    """PATCH body: edit an accepted target in place (SPEC §58).

    Omitted fields keep their current value — the endpoint never resets a policy
    parameter the user did not touch. The remaining policy parameters (step,
    RPE target, sets, percent of 1RM…) belong to the per-exercise policy screen
    (``PUT /progression/exercises/{id}``), so they are deliberately not here.
    """

    value: Optional[float] = Field(
        None,
        gt=0,
        le=2000,
        description=(
            "New target value: kilograms, or seconds when the policy is "
            "TIME_PROGRESSION. New sessions start on it."
        ),
    )
    type: Optional[ProgressionPolicy] = Field(
        None, description="Policy type for the target's own progression scope."
    )
    reps_min: Optional[int] = Field(None, ge=0, le=1000)
    reps_max: Optional[int] = Field(None, ge=0, le=1000)


class ProgressionRecommendationDecision(BaseModel):
    """POST body for accept/reject (SPEC §42–§44)."""

    selected_value: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
        description=(
            "Omit to accept the recommended value; send a different own value to "
            "record the recommendation as ``modified``."
        ),
    )
