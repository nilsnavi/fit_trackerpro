# Architecture & Design

<cite>
**Referenced Files in This Document**
- [backend/app/main.py](file://backend/app/main.py)
- [backend/app/api/auth.py](file://backend/app/api/auth.py)
- [backend/app/middleware/auth.py](file://backend/app/middleware/auth.py)
- [backend/app/utils/telegram_auth.py](file://backend/app/utils/telegram_auth.py)
- [backend/app/middleware/rate_limit.py](file://backend/app/middleware/rate_limit.py)
- [backend/app/utils/config.py](file://backend/app/utils/config.py)
- [backend/app/models/user.py](file://backend/app/models/user.py)
- [frontend/src/services/api.ts](file://frontend/src/services/api.ts)
- [frontend/src/hooks/useTelegramWebApp.ts](file://frontend/src/hooks/useTelegramWebApp.ts)
- [frontend/src/components/auth/TelegramAuthExample.tsx](file://frontend/src/components/auth/TelegramAuthExample.tsx)
- [docker-compose.yml](file://docker-compose.yml)
- [docker-compose.prod.yml](file://docker-compose.prod.yml)
- [monitoring/docker-compose.monitoring.yml](file://monitoring/docker-compose.monitoring.yml)
- [database/migrations/versions/cd723942379e_initial_schema.py](file://database/migrations/versions/cd723942379e_initial_schema.py)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the system architecture of FitTracker Pro, a Telegram Mini App for fitness and health tracking. It covers the high-level architecture, including the Telegram Mini App front-end, FastAPI back-end, PostgreSQL database, and monitoring stack. It explains component interactions, data flows, integration patterns between the front-end and back-end, microservices architecture, containerization strategy, deployment topology, cross-cutting concerns (authentication, security, monitoring, error handling), technology stack decisions, architectural patterns, and scalability considerations.

## Project Structure
FitTracker Pro follows a clear separation of concerns:
- Frontend: React + TypeScript + Vite with Telegram Mini Apps SDK integration
- Backend: FastAPI with asynchronous SQLAlchemy, Alembic migrations, Redis caching, and Sentry error tracking
- Database: PostgreSQL with initial schema and migration support
- Monitoring: Prometheus, Grafana, Loki, and cAdvisor
- DevOps: Docker and Docker Compose for local development and production deployment

```mermaid
graph TB
subgraph "Frontend"
FE_API["Axios Client<br/>api.ts"]
TG_HOOK["Telegram WebApp Hook<br/>useTelegramWebApp.ts"]
TG_COMP["Auth Demo Component<br/>TelegramAuthExample.tsx"]
end
subgraph "Backend"
FASTAPI["FastAPI App<br/>main.py"]
AUTH_ROUTER["Auth Router<br/>api/auth.py"]
JWT_MW["JWT Bearer<br/>middleware/auth.py"]
RATE_MW["Rate Limit<br/>middleware/rate_limit.py"]
CFG["Settings<br/>utils/config.py"]
TA_UTILS["Telegram Auth Utils<br/>utils/telegram_auth.py"]
DB_MODEL["User Model<br/>models/user.py"]
end
subgraph "Infrastructure"
NGINX["Nginx (Reverse Proxy)<br/>docker-compose.prod.yml"]
POSTGRES["PostgreSQL<br/>docker-compose*.yml"]
REDIS["Redis<br/>docker-compose*.yml"]
MONITOR["Monitoring Stack<br/>docker-compose.monitoring.yml"]
end
FE_API --> |HTTP/HTTPS| NGINX
NGINX --> |HTTP| FASTAPI
FASTAPI --> JWT_MW
FASTAPI --> RATE_MW
AUTH_ROUTER --> TA_UTILS
AUTH_ROUTER --> JWT_MW
AUTH_ROUTER --> DB_MODEL
FASTAPI --> CFG
FASTAPI --> POSTGRES
FASTAPI --> REDIS
MONITOR -.-> NGINX
```

**Diagram sources**
- [backend/app/main.py:56-106](file://backend/app/main.py#L56-L106)
- [backend/app/api/auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)
- [backend/app/middleware/rate_limit.py:37-179](file://backend/app/middleware/rate_limit.py#L37-L179)
- [backend/app/utils/config.py:15-55](file://backend/app/utils/config.py#L15-L55)
- [backend/app/utils/telegram_auth.py:14-105](file://backend/app/utils/telegram_auth.py#L14-L105)
- [backend/app/models/user.py:23-132](file://backend/app/models/user.py#L23-L132)
- [frontend/src/services/api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [frontend/src/hooks/useTelegramWebApp.ts:120-506](file://frontend/src/hooks/useTelegramWebApp.ts#L120-L506)
- [frontend/src/components/auth/TelegramAuthExample.tsx:17-122](file://frontend/src/components/auth/TelegramAuthExample.tsx#L17-L122)
- [docker-compose.yml:43-90](file://docker-compose.yml#L43-L90)
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-L124)

**Section sources**
- [README.md:1-237](file://README.md#L1-L237)
- [docker-compose.yml:1-99](file://docker-compose.yml#L1-L99)
- [docker-compose.prod.yml:1-132](file://docker-compose.prod.yml#L1-L132)

## Core Components
- Telegram Mini App front-end
  - Axios-based API client with automatic auth token injection
  - Telegram WebApp integration hook for native capabilities
  - Example authentication component demonstrating Telegram initData exchange
- FastAPI back-end
  - Centralized router registration and middleware pipeline
  - Telegram WebApp authentication utilities and validators
  - JWT-based authentication and authorization dependencies
  - Rate limiting middleware using Redis with graceful degradation
  - Configuration via Pydantic settings
- Database
  - PostgreSQL with Alembic migrations and JSONB fields for flexible user profiles/settings
- Monitoring stack
  - Prometheus, Grafana, Loki, cAdvisor, and Node Exporter for observability

**Section sources**
- [frontend/src/services/api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [frontend/src/hooks/useTelegramWebApp.ts:120-506](file://frontend/src/hooks/useTelegramWebApp.ts#L120-L506)
- [frontend/src/components/auth/TelegramAuthExample.tsx:17-122](file://frontend/src/components/auth/TelegramAuthExample.tsx#L17-L122)
- [backend/app/main.py:13-106](file://backend/app/main.py#L13-L106)
- [backend/app/utils/telegram_auth.py:14-105](file://backend/app/utils/telegram_auth.py#L14-L105)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)
- [backend/app/middleware/rate_limit.py:37-179](file://backend/app/middleware/rate_limit.py#L37-L179)
- [backend/app/utils/config.py:15-55](file://backend/app/utils/config.py#L15-L55)
- [database/migrations/versions/cd723942379e_initial_schema.py:19-460](file://database/migrations/versions/cd723942379e_initial_schema.py#L19-L460)

## Architecture Overview
FitTracker Pro uses a containerized microservice-style layout:
- Frontend container serves static assets behind Nginx in production
- Backend container exposes REST APIs with CORS, rate limiting, and JWT auth
- Shared infrastructure containers: PostgreSQL (primary data store), Redis (caching/rate limiting), and optional monitoring stack

```mermaid
graph TB
Client["Telegram Mini App"]
FE["Frontend Container<br/>Vite/Axios"]
NGINX["Nginx Reverse Proxy"]
BE["Backend Container<br/>FastAPI"]
DB["PostgreSQL"]
CACHE["Redis"]
MON["Monitoring Stack"]
Client --> FE
FE --> NGINX
NGINX --> BE
BE --> DB
BE --> CACHE
MON -.-> BE
MON -.-> NGINX
```

**Diagram sources**
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)
- [docker-compose.yml:43-90](file://docker-compose.yml#L43-L90)
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-L124)

## Detailed Component Analysis

### Telegram Mini App Integration
The front-end integrates tightly with Telegram WebApp:
- Initialization and theming via a dedicated hook
- Retrieval of initData from the WebApp
- Submission of initData to the backend for validation and token issuance
- Automatic Authorization header injection for subsequent API calls

```mermaid
sequenceDiagram
participant TG as "TelegramMiniApp"
participant Hook as "useTelegramWebApp.ts"
participant FE as "api.ts"
participant BE as "FastAPI Auth"
participant TA as "telegram_auth.py"
TG->>Hook : "initData available"
Hook->>FE : "POST /api/v1/auth/telegram {init_data}"
FE->>BE : "HTTP POST /api/v1/auth/telegram"
BE->>TA : "validate_and_get_user(init_data)"
TA-->>BE : "valid user or error"
BE-->>FE : "AuthResponse {access_token}"
FE->>FE : "store token in localStorage"
FE-->>Hook : "success"
```

**Diagram sources**
- [frontend/src/hooks/useTelegramWebApp.ts:120-506](file://frontend/src/hooks/useTelegramWebApp.ts#L120-L506)
- [frontend/src/services/api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [backend/app/api/auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [backend/app/utils/telegram_auth.py:172-204](file://backend/app/utils/telegram_auth.py#L172-L204)

**Section sources**
- [frontend/src/components/auth/TelegramAuthExample.tsx:62-122](file://frontend/src/components/auth/TelegramAuthExample.tsx#L62-L122)
- [frontend/src/services/api.ts:21-45](file://frontend/src/services/api.ts#L21-L45)
- [backend/app/api/auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [backend/app/utils/telegram_auth.py:108-156](file://backend/app/utils/telegram_auth.py#L108-L156)

### Authentication and Authorization
- Telegram initData validation with HMAC-SHA256 and timestamp checks
- User creation/upsertion based on Telegram identity
- JWT access/refresh tokens with configurable expiration
- Protected routes enforced via JWT Bearer middleware
- Token refresh and logout endpoints

```mermaid
flowchart TD
Start(["Auth Request"]) --> Parse["Parse initData"]
Parse --> HashCheck{"Hash Valid?"}
HashCheck --> |No| Reject["Reject Unauthorized"]
HashCheck --> |Yes| TimestampCheck["Timestamp Within Window?"]
TimestampCheck --> |No| Reject
TimestampCheck --> |Yes| UpsertUser["Upsert User in DB"]
UpsertUser --> CreateTokens["Create Access/Refresh Tokens"]
CreateTokens --> Respond["Return AuthResponse"]
Reject --> End(["End"])
Respond --> End
```

**Diagram sources**
- [backend/app/utils/telegram_auth.py:54-105](file://backend/app/utils/telegram_auth.py#L54-L105)
- [backend/app/utils/telegram_auth.py:108-156](file://backend/app/utils/telegram_auth.py#L108-L156)
- [backend/app/api/auth.py:41-91](file://backend/app/api/auth.py#L41-L91)
- [backend/app/middleware/auth.py:21-77](file://backend/app/middleware/auth.py#L21-L77)

**Section sources**
- [backend/app/api/auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)
- [backend/app/utils/telegram_auth.py:14-105](file://backend/app/utils/telegram_auth.py#L14-L105)

### Data Model: User
The User entity encapsulates Telegram identity, profile, and settings using JSONB for flexibility. It defines relationships to related entities (workouts, health logs, achievements, etc.) and includes indexes for performance.

```mermaid
erDiagram
USER {
int id PK
bigint telegram_id UK
string username
string first_name
jsonb profile
jsonb settings
timestamptz created_at
timestamptz updated_at
}
EXERCISE ||--o{ WORKOUT_TEMPLATE : "author"
USER ||--o{ WORKOUT_TEMPLATE : "creates"
USER ||--o{ WORKOUT_LOG : "logs"
USER ||--o{ GLUCOSE_LOG : "records"
USER ||--o{ DAILY_WELLNESS : "logs"
USER ||--o{ USER_ACHIEVEMENT : "earns"
USER ||--o{ CHALLENGE : "creates"
USER ||--o{ EMERGENCY_CONTACT : "manages"
```

**Diagram sources**
- [backend/app/models/user.py:23-132](file://backend/app/models/user.py#L23-L132)
- [database/migrations/versions/cd723942379e_initial_schema.py:26-42](file://database/migrations/versions/cd723942379e_initial_schema.py#L26-L42)

**Section sources**
- [backend/app/models/user.py:23-132](file://backend/app/models/user.py#L23-L132)
- [database/migrations/versions/cd723942379e_initial_schema.py:19-460](file://database/migrations/versions/cd723942379e_initial_schema.py#L19-L460)

### Backend API Surface and Routing
The backend registers routers for health, auth, users, workouts, exercises, health metrics, analytics, achievements, challenges, and emergency endpoints. The root path returns metadata and links to docs.

```mermaid
graph LR
Root["GET /"] --> Info["Info + Docs Link"]
Auth["/api/v1/auth/*"] --> AuthEP["Telegram Auth, Profile, Tokens"]
Users["/api/v1/users/*"] --> Prof["Profile CRUD"]
Workouts["/api/v1/workouts/*"] --> WL["Workout CRUD"]
Health["/api/v1/health/*"] --> HM["Glucose, Wellness"]
Analytics["/api/v1/analytics/*"] --> Stats["Dashboard, Progress, OneRM"]
Achievements["/api/v1/achievements/*"] --> List["List, User Achievements"]
Challenges["/api/v1/challenges/*"] --> ListCh["List, Join"]
Emergency["/api/v1/emergency/*"] --> Emer["Activate/Deactivate, Contacts"]
```

**Diagram sources**
- [backend/app/main.py:89-106](file://backend/app/main.py#L89-L106)

**Section sources**
- [backend/app/main.py:56-106](file://backend/app/main.py#L56-L106)

### Containerization and Deployment Topology
- Local development: docker-compose spins up PostgreSQL, Redis, backend, and frontend with shared network
- Production: docker-compose.prod.yml adds Nginx reverse proxy, SSL mounts, resource limits, and external network sharing with monitoring stack

```mermaid
graph TB
subgraph "Local Dev"
PG["postgres:15"]
RD["redis:7"]
BE["backend:fastapi"]
FE["frontend:vite"]
NET["fittracker-network"]
end
subgraph "Production"
NGINX["nginx:alpine"]
BE_PROD["backend:prod"]
FE_PROD["frontend:prod"]
MON["monitoring stack"]
end
PG --- NET
RD --- NET
BE --- NET
FE --- NET
BE_PROD --- NET
FE_PROD --- NET
NGINX --- BE_PROD
NGINX --- FE_PROD
MON -.-> NGINX
```

**Diagram sources**
- [docker-compose.yml:1-99](file://docker-compose.yml#L1-L99)
- [docker-compose.prod.yml:1-132](file://docker-compose.prod.yml#L1-L132)
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-L124)

**Section sources**
- [docker-compose.yml:1-99](file://docker-compose.yml#L1-L99)
- [docker-compose.prod.yml:1-132](file://docker-compose.prod.yml#L1-L132)

## Dependency Analysis
- Frontend-to-Backend
  - Axios client injects Authorization header automatically
  - Front-end expects backend endpoints for Telegram auth and protected routes
- Backend-to-Infrastructure
  - Database and Redis URLs configured via environment
  - Sentry DSN enables error tracking
  - CORS configured via environment variable
- Backend-to-Frontend
  - Telegram WebApp URL configured for redirect and validation
  - Front-end reads VITE_API_URL to target backend

```mermaid
graph LR
FE["frontend/src/services/api.ts"] --> BE["backend/app/main.py"]
BE --> CFG["backend/app/utils/config.py"]
BE --> DB["PostgreSQL"]
BE --> CACHE["Redis"]
BE --> TA["backend/app/utils/telegram_auth.py"]
BE --> JWT["backend/app/middleware/auth.py"]
BE --> RL["backend/app/middleware/rate_limit.py"]
```

**Diagram sources**
- [frontend/src/services/api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [backend/app/main.py:25-87](file://backend/app/main.py#L25-L87)
- [backend/app/utils/config.py:15-55](file://backend/app/utils/config.py#L15-L55)
- [backend/app/utils/telegram_auth.py:14-105](file://backend/app/utils/telegram_auth.py#L14-L105)
- [backend/app/middleware/auth.py:111-131](file://backend/app/middleware/auth.py#L111-L131)
- [backend/app/middleware/rate_limit.py:37-179](file://backend/app/middleware/rate_limit.py#L37-L179)

**Section sources**
- [frontend/src/services/api.ts:1-69](file://frontend/src/services/api.ts#L1-L69)
- [backend/app/main.py:25-87](file://backend/app/main.py#L25-L87)
- [backend/app/utils/config.py:15-55](file://backend/app/utils/config.py#L15-L55)

## Performance Considerations
- Asynchronous database operations with SQLAlchemy asyncpg reduce latency under load
- Redis-backed rate limiting with graceful fallback to in-memory storage ensures resilience
- JSONB fields enable flexible schemas while maintaining query performance with GIN indexes
- Caching via Redis supports token storage and rate-limit state
- Resource limits in production compose help prevent resource exhaustion

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication failures
  - Validate Telegram initData signature and timestamp window
  - Ensure backend SECRET_KEY and TELEGRAM_BOT_TOKEN are set
- CORS and proxy issues
  - Confirm ALLOWED_ORIGINS includes frontend origins
  - Verify Nginx configuration and SSL mounts in production
- Rate limiting errors
  - Inspect X-RateLimit-* headers and Retry-After
  - Check Redis connectivity or fallback behavior
- Sentry error tracking
  - Configure SENTRY_DSN for error reporting in both frontend and backend
- Database migrations
  - Run Alembic upgrade after deploying backend container

**Section sources**
- [backend/app/utils/telegram_auth.py:108-156](file://backend/app/utils/telegram_auth.py#L108-L156)
- [backend/app/middleware/rate_limit.py:159-169](file://backend/app/middleware/rate_limit.py#L159-L169)
- [backend/app/utils/config.py:40-47](file://backend/app/utils/config.py#L40-L47)
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)

## Conclusion
FitTracker Pro employs a pragmatic, container-first architecture combining a React-based Telegram Mini App front-end with a FastAPI-powered backend, PostgreSQL for persistence, and Redis for caching and rate limiting. The system emphasizes secure, scalable operations through JWT-based authentication, Telegram WebApp integration, robust middleware, and a comprehensive monitoring stack. The documented deployment topologies and cross-cutting concerns provide a solid foundation for development, testing, and production operations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Technology Stack Decisions
- Frontend: React + TypeScript + Vite for rapid development and strong typing; Telegram Mini Apps SDK for native integrations
- Backend: FastAPI for high-performance async APIs; SQLAlchemy for ORM; Alembic for migrations
- Infrastructure: PostgreSQL for relational data and JSONB flexibility; Redis for caching and rate limiting
- Observability: Prometheus + Grafana for metrics and visualization; Loki for log aggregation; cAdvisor and Node Exporter for container/system metrics
- DevOps: Docker and Docker Compose for reproducible environments; GitHub Actions for CI/CD

**Section sources**
- [README.md:18-44](file://README.md#L18-L44)
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-L124)

### Scalability Considerations
- Stateless backend design with JWT tokens and Redis for session-like state
- Horizontal scaling potential for backend replicas behind Nginx
- Database partitioning and indexing strategies for high-cardinality JSONB fields
- CDN-friendly static assets served by Nginx in production

[No sources needed since this section provides general guidance]