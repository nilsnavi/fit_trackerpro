from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import jwt
import pytest
from sqlalchemy import select, text

from app.application.exercises_service import ExercisesService
from app.domain.exercise import Exercise
from app.domain.user import User
from app.domain.workout_log import WorkoutLog
from app.domain.workout_session_exercise import WorkoutSessionExercise
from app.infrastructure.repositories.auth_repository import AuthRepository
from app.schemas.exercises import ExerciseCreate
from app.settings import settings


@pytest.fixture(autouse=True)
async def enforce_foreign_keys(db_session):
    if db_session.bind.dialect.name == "sqlite":
        await db_session.execute(text("PRAGMA foreign_keys=ON"))
        assert await db_session.scalar(text("PRAGMA foreign_keys")) == 1


async def test_deleted_account_rejects_old_refresh(client, mock_telegram_auth_body, monkeypatch):
    login = await client.post('/api/v1/users/auth/telegram', json=mock_telegram_auth_body)
    assert login.status_code == 200
    tokens = login.json()
    deleted = await client.delete('/api/v1/users/me', headers={
        'Authorization': f"Bearer {tokens['access_token']}"})
    assert deleted.status_code == 204

    def must_not_issue(*args, **kwargs):
        pytest.fail('Deleted account must not issue tokens')

    monkeypatch.setattr('app.application.auth_service.create_access_token', must_not_issue)
    monkeypatch.setattr('app.application.auth_service.create_refresh_token', must_not_issue)
    response = await client.post('/api/v1/users/auth/refresh', json={
        'refresh_token': tokens['refresh_token']})
    assert response.status_code == 401
    assert 'access_token' not in response.json()
    assert 'refresh_token' not in response.json()


@pytest.mark.parametrize('kind', ['invalid', 'expired', 'access'])
async def test_refresh_rejects_invalid_credentials(client, mock_telegram_auth_body, kind):
    login = await client.post('/api/v1/users/auth/telegram', json=mock_telegram_auth_body)
    assert login.status_code == 200
    token = 'not-a-valid-jwt-with-sufficient-length'
    if kind == 'access':
        token = login.json()['access_token']
    elif kind == 'expired':
        token = jwt.encode({
            'sub': '123456789', 'type': 'refresh',
            'exp': datetime.now(timezone.utc) - timedelta(seconds=10),
        }, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    response = await client.post('/api/v1/users/auth/refresh', json={'refresh_token': token})
    assert response.status_code == 401
    assert 'access_token' not in response.json()
    assert 'refresh_token' not in response.json()


async def test_delete_removes_unused_pending_custom_exercise(authenticated_client, db_session):
    owner = (await db_session.execute(select(User))).scalar_one()
    exercise = Exercise(name='Private name', description='Private description',
                        category='strength', source='user', status='pending',
                        author_user_id=owner.id, aliases=['Private alias'],
                        media_url='https://example.com/private', slug='private-slug',
                        equipment=['Private equipment'], muscle_groups=['Private group'],
                        muscle_group='Private group', risk_flags={'private': True})
    db_session.add(exercise)
    await db_session.commit()
    response = await authenticated_client.delete('/api/v1/users/me')
    assert response.status_code == 204
    assert (await db_session.execute(select(Exercise).where(Exercise.id == exercise.id))).scalar_one_or_none() is None


async def test_delete_anonymizes_referenced_custom_exercise(authenticated_client, db_session):
    from app.domain.template_exercise import TemplateExercise
    from app.domain.workout_template import WorkoutTemplate

    owner = (await db_session.execute(select(User))).scalar_one()
    exercise = Exercise(name='Private name', description='Private description',
                        category='strength', source='user', status='pending',
                        author_user_id=owner.id, aliases=['Private alias'],
                        media_url='https://example.com/private', slug='private-slug',
                        equipment=['Barbell'], muscle_groups=['Chest'], muscle_group='Chest',
                        risk_flags={'joint_problems': True})
    db_session.add(exercise)
    await db_session.flush()
    other = User(telegram_id=987654329)
    db_session.add(other)
    await db_session.flush()
    template = WorkoutTemplate(user_id=other.id, name='Other', type='strength', exercises=[])
    db_session.add(template)
    await db_session.flush()
    db_session.add(TemplateExercise(user_id=other.id, template_id=template.id,
                                    exercise_id=exercise.id, name='Private name', sets=3))
    await db_session.commit()
    assert (await authenticated_client.delete('/api/v1/users/me')).status_code == 204
    await db_session.refresh(exercise)
    assert exercise.author_user_id is None
    assert exercise.name == 'Private name'
    assert exercise.category == 'strength'
    assert exercise.equipment == ['Barbell']
    assert exercise.muscle_groups == ['Chest']
    assert exercise.muscle_group == 'Chest'
    assert exercise.risk_flags == {'joint_problems': True}
    assert exercise.description is None
    assert exercise.aliases == []
    assert exercise.media_url is None
    assert exercise.slug is None
    assert exercise.status == 'archived'
    assert exercise.source == 'user'


@pytest.mark.parametrize('source', ['system', 'imported'])
async def test_delete_preserves_catalog_exercise(authenticated_client, db_session, source):
    owner = (await db_session.execute(select(User))).scalar_one()
    exercise = Exercise(name='Catalog exercise', description='Catalog instructions',
                        category='strength', source=source, status='active',
                        author_user_id=owner.id)
    db_session.add(exercise)
    await db_session.commit()
    assert (await authenticated_client.delete('/api/v1/users/me')).status_code == 204
    await db_session.refresh(exercise)
    assert exercise.name == 'Catalog exercise'
    assert exercise.description == 'Catalog instructions'
    assert exercise.source == source
    assert exercise.status == 'active'
    assert exercise.author_user_id is None


async def test_delete_preserves_other_users_history(authenticated_client, db_session):
    owner = (await db_session.execute(select(User))).scalar_one()
    other = User(telegram_id=987654321)
    exercise = Exercise(name='Custom', category='strength', source='user',
                        status='pending', author_user_id=owner.id)
    db_session.add_all([other, exercise])
    await db_session.flush()
    history = WorkoutLog(user_id=other.id, date=date.today(), status='completed',
                         exercises=[{'exercise_id': exercise.id, 'name': 'Snapshot'}])
    own_history = WorkoutLog(user_id=owner.id, date=date.today(), exercises=[])
    db_session.add_all([history, own_history])
    await db_session.flush()
    slot = WorkoutSessionExercise(user_id=other.id, workout_session_id=history.id,
                                  exercise_id=exercise.id, name='Snapshot')
    db_session.add(slot)
    await db_session.commit()
    assert (await authenticated_client.delete('/api/v1/users/me')).status_code == 204
    await db_session.refresh(exercise)
    await db_session.refresh(history)
    await db_session.refresh(slot)
    assert exercise.author_user_id is None
    assert slot.exercise_id == exercise.id
    assert history.exercises == [{'exercise_id': exercise.id, 'name': 'Snapshot'}]
    assert (await db_session.scalar(select(WorkoutLog.id).where(
        WorkoutLog.id == own_history.id))) is None


async def test_delete_rolls_back_cleanup_on_failure(db_session, monkeypatch):
    owner = User(telegram_id=654321)
    db_session.add(owner)
    await db_session.flush()
    exercise = Exercise(name='Original', category='strength', source='user',
                        status='pending', author_user_id=owner.id)
    db_session.add(exercise)
    await db_session.commit()
    owner_id, exercise_id = owner.id, exercise.id
    repository = AuthRepository(db_session)
    monkeypatch.setattr(repository, 'delete', AsyncMock(side_effect=RuntimeError('delete failed')))
    with pytest.raises(RuntimeError, match='delete failed'):
        await repository.delete_user(owner)
    db_session.expire_all()
    remaining = await db_session.get(Exercise, exercise_id)
    assert remaining.name == 'Original'
    assert remaining.author_user_id == owner_id
    assert await db_session.get(User, owner_id) is not None


async def test_create_custom_exercise_sets_source(db_session):
    owner = User(telegram_id=654322)
    db_session.add(owner)
    await db_session.commit()
    created = await ExercisesService(db_session).create_exercise(
        owner.id, ExerciseCreate(name='Custom', category='strength'))
    exercise = await db_session.get(Exercise, created.id)
    assert exercise.source == 'user'
    assert exercise.status == 'pending'


async def test_delete_preserves_template_and_progression_references(authenticated_client, db_session):
    from app.domain.progression_policy import ProgressionPolicyRecord
    from app.domain.template_exercise import TemplateExercise
    from app.domain.workout_template import WorkoutTemplate

    owner = (await db_session.execute(select(User))).scalar_one()
    other = User(telegram_id=987654322)
    exercise = Exercise(name='Shared', category='strength', source='user',
                        status='active', author_user_id=owner.id)
    db_session.add_all([other, exercise])
    await db_session.flush()
    template = WorkoutTemplate(user_id=other.id, name='Other template', type='strength',
                               exercises=[{'exercise_id': exercise.id}])
    db_session.add(template)
    await db_session.flush()
    slot = TemplateExercise(user_id=other.id, template_id=template.id,
                            exercise_id=exercise.id, name='Shared', sets=3)
    policy = ProgressionPolicyRecord(user_id=other.id, exercise_id=exercise.id,
                                     scope_key='deletion-regression')
    db_session.add_all([slot, policy])
    await db_session.commit()
    assert (await authenticated_client.delete('/api/v1/users/me')).status_code == 204
    for row in (exercise, template, slot, policy):
        await db_session.refresh(row)
    assert exercise.author_user_id is None
    assert slot.exercise_id == policy.exercise_id == exercise.id
    assert template.exercises == [{'exercise_id': exercise.id}]
