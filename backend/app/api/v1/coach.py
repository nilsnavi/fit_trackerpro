from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.coach import require_coach, require_coach_feature
from app.application.coach_business_service import CoachBusinessService
from app.application.coach_entitlement_service import CoachEntitlementService
from app.application.coach_monitoring_service import CoachMonitoringService
from app.application.coach_program_service import CoachProgramService
from app.application.coach_service import (
    CoachIdentityService,
    CoachInvitationService,
    CoachRelationshipService,
)
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.coach import (
    CoachClientDetailResponse,
    CoachClientResponse,
    CoachClientUpdate,
    CoachInvitationAccept,
    CoachInvitationCreate,
    CoachInvitationCreatedResponse,
    CoachInvitationResolve,
    CoachInvitationResolveResponse,
    CoachInvitationResponse,
    CoachProfileCreate,
    CoachProfileResponse,
    CoachProfileUpdate,
)
from app.schemas.coach_business import (
    CoachClientPackageCreate,
    CoachClientPackageDetailResponse,
    CoachClientPackageResponse,
    CoachPackageConsumeRequest,
    CoachPackageCreate,
    CoachPackageResponse,
    CoachPackageReverseRequest,
    CoachPackageUpdate,
    CoachPaymentCreate,
    CoachPaymentResponse,
    CoachTaskCreate,
    CoachTaskResponse,
    CoachTaskUpdate,
)
from app.schemas.coach_entitlements import CoachPlanResponse, CoachSubscriptionResponse
from app.schemas.coach_monitoring import (
    AttentionSeverity,
    ClientMonitoringPage,
    ClientMonitoringSummary,
)
from app.schemas.coach_programs import (
    CoachProgramAssignmentCreate,
    CoachProgramAssignmentResponse,
    CoachProgramAssignmentStatusUpdate,
    CoachProgramCreate,
    CoachProgramDayCreate,
    CoachProgramDayUpdate,
    CoachProgramResponse,
    CoachProgramStatusUpdate,
    CoachProgramUpdate,
    CoachProgramWorkoutStartResponse,
)

router = APIRouter(dependencies=[Depends(require_coach_feature)])
client_program_router = APIRouter(dependencies=[Depends(require_coach_feature)])


@router.get("/plans", response_model=list[CoachPlanResponse])
async def list_coach_plans(current_user: User = Depends(get_current_user)):
    return CoachEntitlementService.catalog_payload()


@router.get("/subscription", response_model=CoachSubscriptionResponse)
async def get_coach_subscription(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachEntitlementService(db).current_payload(coach.id)


@router.post("/profile", response_model=CoachProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: CoachProfileCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachIdentityService(db).create_profile(current_user.id, data, get_client_ip(request))


@router.get("/profile", response_model=CoachProfileResponse)
async def get_profile(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachIdentityService(db).get_profile(coach.id)


@router.patch("/profile", response_model=CoachProfileResponse)
async def patch_profile(
    data: CoachProfileUpdate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachIdentityService(db).update_profile(coach.id, data, get_client_ip(request))


@router.post("/invitations", response_model=CoachInvitationCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    data: CoachInvitationCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachInvitationService(db).create(coach.id, data, get_client_ip(request))


@router.get("/invitations", response_model=list[CoachInvitationResponse])
async def list_invitations(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachInvitationService(db).list(coach.id)


@router.post("/invitations/resolve", response_model=CoachInvitationResolveResponse)
async def resolve_invitation(
    data: CoachInvitationResolve,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachInvitationService(db).resolve(data.token)


@router.post("/invitations/accept", response_model=CoachClientResponse)
async def accept_invitation(
    data: CoachInvitationAccept,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachInvitationService(db).accept(current_user.id, data.token, get_client_ip(request))


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: str,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    await CoachInvitationService(db).revoke(coach.id, invitation_id, get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/clients", response_model=list[CoachClientResponse])
async def list_clients(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachRelationshipService(db).list_clients(coach.id)


@router.get("/monitoring", response_model=ClientMonitoringPage)
async def list_monitoring(
    status_filter: str = Query("all", alias="status", pattern="^(all|attention|ok)$"),
    severity: AttentionSeverity | None = None,
    search: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    if severity is not None:
        await CoachEntitlementService(db).require_feature(coach.id, "advanced_monitoring_filters")
    return await CoachMonitoringService(db).list_clients(
        coach.id, status=status_filter, severity=severity.value if severity else None,
        search=search, limit=limit, offset=offset,
    )


@router.get("/monitoring/{client_id}", response_model=ClientMonitoringSummary)
async def get_monitoring_detail(
    client_id: int,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachMonitoringService(db).get_client(coach.id, client_id)


@router.get("/clients/{client_id}", response_model=CoachClientDetailResponse)
async def get_client(client_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachRelationshipService(db).get_client(coach.id, client_id)


@router.patch("/clients/{client_id}", response_model=CoachClientResponse)
async def patch_client(
    client_id: int, data: CoachClientUpdate, request: Request, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    return await CoachRelationshipService(db).update_client(coach.id, client_id, data, get_client_ip(request))


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int, request: Request, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    await CoachRelationshipService(db).revoke_client(coach.id, client_id, get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/programs", response_model=list[CoachProgramResponse])
async def list_programs(coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).list_programs(coach.id)


@router.post("/programs", response_model=CoachProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(data: CoachProgramCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).create_program(coach.id, data)


@router.patch("/programs/{program_id}", response_model=CoachProgramResponse)
async def update_program(program_id: int, data: CoachProgramUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).update_program(coach.id, program_id, data)


@router.get("/programs/{program_id}", response_model=CoachProgramResponse)
async def get_program(program_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).get_program(coach.id, program_id)


@router.post("/programs/{program_id}/days", response_model=CoachProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program_day(program_id: int, data: CoachProgramDayCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).create_day(coach.id, program_id, data)


@router.patch("/programs/{program_id}/days/{day_id}", response_model=CoachProgramResponse)
async def update_program_day(program_id: int, day_id: int, data: CoachProgramDayUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).update_day(coach.id, program_id, day_id, data)


@router.delete("/programs/{program_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program_day(program_id: int, day_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    await CoachProgramService(db).delete_day(coach.id, program_id, day_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/programs/{program_id}/activate", response_model=CoachProgramResponse)
async def activate_program(program_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    from app.domain.coach_program import CoachProgramStatus
    return await CoachProgramService(db).set_program_status(coach.id, program_id, CoachProgramStatusUpdate(status=CoachProgramStatus.ACTIVE))


@router.delete("/programs/{program_id}", response_model=CoachProgramResponse)
async def archive_program(program_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    from app.domain.coach_program import CoachProgramStatus
    return await CoachProgramService(db).set_program_status(coach.id, program_id, CoachProgramStatusUpdate(status=CoachProgramStatus.ARCHIVED))


@router.post("/programs/{program_id}/assignments", response_model=CoachProgramAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_program_nested(program_id: int, data: CoachProgramAssignmentCreate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).assign(coach.id, data.model_copy(update={"program_id": program_id}))


@router.get("/programs/{program_id}/assignments", response_model=list[CoachProgramAssignmentResponse])
async def list_program_assignments(program_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    program = await CoachProgramService(db).get_program(coach.id, program_id)
    assignments = await CoachProgramService(db).list_assignments(coach_id=coach.id)
    return [assignment for assignment in assignments if assignment.program_id == program.id]


@router.get("/clients/{client_id}/programs", response_model=list[CoachProgramAssignmentResponse])
async def list_client_programs(client_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).list_client_programs_for_coach(coach.id, client_id)


# --- Sprint 10.4: packages, payments, tasks ---


@router.get("/packages", response_model=list[CoachPackageResponse])
async def list_coach_packages(
    include_archived: bool = Query(False),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).list_packages(coach.id, include_archived=include_archived)


@router.post("/packages", response_model=CoachPackageResponse, status_code=status.HTTP_201_CREATED)
async def create_coach_package(
    data: CoachPackageCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).create_package(coach.id, data, get_client_ip(request))


@router.patch("/packages/{package_id}", response_model=CoachPackageResponse)
async def update_coach_package(
    package_id: int,
    data: CoachPackageUpdate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).update_package(coach.id, package_id, data, get_client_ip(request))


@router.delete("/packages/{package_id}", response_model=CoachPackageResponse)
async def archive_coach_package(
    package_id: int,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).archive_package(coach.id, package_id, get_client_ip(request))


@router.get("/clients/{client_id}/packages", response_model=list[CoachClientPackageResponse])
async def list_client_packages(
    client_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    return await CoachBusinessService(db).list_client_packages(coach.id, client_id)


@router.get("/clients/{client_id}/packages/{client_package_id}", response_model=CoachClientPackageDetailResponse)
async def get_client_package(
    client_id: int, client_package_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    return await CoachBusinessService(db).get_client_package(coach.id, client_id, client_package_id)


@router.post(
    "/clients/{client_id}/packages",
    response_model=CoachClientPackageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_client_package(
    client_id: int,
    data: CoachClientPackageCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).assign_package(coach.id, client_id, data, get_client_ip(request))


@router.post(
    "/clients/{client_id}/packages/{client_package_id}/consume",
    response_model=CoachClientPackageResponse,
)
async def consume_client_package_session(
    client_id: int,
    client_package_id: int,
    data: CoachPackageConsumeRequest,
    request: Request,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key", max_length=128),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).consume_session(
        coach.id, client_id, client_package_id, data, idempotency_key=idempotency_key, client_ip=get_client_ip(request)
    )


@router.post(
    "/clients/{client_id}/packages/{client_package_id}/reverse",
    response_model=CoachClientPackageResponse,
)
async def reverse_client_package_session(
    client_id: int,
    client_package_id: int,
    request: Request,
    data: CoachPackageReverseRequest | None = None,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).reverse_last_session(
        coach.id, client_id, client_package_id, data, get_client_ip(request)
    )


@router.delete(
    "/clients/{client_id}/packages/{client_package_id}",
    response_model=CoachClientPackageResponse,
)
async def cancel_client_package(
    client_id: int,
    client_package_id: int,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).cancel_client_package(
        coach.id, client_id, client_package_id, get_client_ip(request)
    )


@router.get("/clients/{client_id}/payments", response_model=list[CoachPaymentResponse])
async def list_client_payments(
    client_id: int, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)
):
    return await CoachBusinessService(db).list_payments(coach.id, client_id)


@router.post(
    "/clients/{client_id}/payments",
    response_model=CoachPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_client_payment(
    client_id: int,
    data: CoachPaymentCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).record_payment(coach.id, client_id, data, get_client_ip(request))


@router.post(
    "/clients/{client_id}/payments/{payment_id}/reverse",
    response_model=CoachPaymentResponse,
)
async def reverse_client_payment(
    client_id: int,
    payment_id: int,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).reverse_payment(coach.id, client_id, payment_id, get_client_ip(request))


@router.get("/tasks", response_model=list[CoachTaskResponse])
async def list_coach_tasks(
    client_id: int | None = Query(None),
    completed: bool | None = Query(None),
    due_today: bool = Query(False),
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).list_tasks(
        coach.id, client_id=client_id, completed=completed, due_today=due_today
    )


@router.post("/tasks", response_model=CoachTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_coach_task(
    data: CoachTaskCreate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).create_task(coach.id, data, get_client_ip(request))


@router.patch("/tasks/{task_id}", response_model=CoachTaskResponse)
async def update_coach_task(
    task_id: int,
    data: CoachTaskUpdate,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).update_task(coach.id, task_id, data, get_client_ip(request))


@router.post("/tasks/{task_id}/complete", response_model=CoachTaskResponse)
async def complete_coach_task(
    task_id: int,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachBusinessService(db).complete_task(coach.id, task_id, get_client_ip(request))


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coach_task(
    task_id: int,
    request: Request,
    coach: User = Depends(require_coach),
    db: AsyncSession = Depends(get_async_db),
):
    await CoachBusinessService(db).delete_task(coach.id, task_id, get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/assignments/{assignment_id}", response_model=CoachProgramAssignmentResponse)
async def patch_assignment(assignment_id: int, data: CoachProgramAssignmentStatusUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).update_assignment(coach.id, assignment_id, data)


@client_program_router.get("", response_model=list[CoachProgramAssignmentResponse])
async def client_programs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).list_assignments(client_id=current_user.id)


@client_program_router.get("/{assignment_id}", response_model=CoachProgramAssignmentResponse)
async def client_program(assignment_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_async_db)):
    return await CoachProgramService(db).get_assignment(assignment_id=assignment_id, client_id=current_user.id)


@client_program_router.post("/{assignment_id}/days/{day_id}/start", response_model=CoachProgramWorkoutStartResponse)
async def start_client_program_day(
    assignment_id: int,
    day_id: int,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=256),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    return await CoachProgramService(db).start_day(current_user.id, assignment_id, day_id, idempotency_key)
