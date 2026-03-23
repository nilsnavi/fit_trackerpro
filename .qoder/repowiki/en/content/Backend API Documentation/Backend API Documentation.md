# Backend API Documentation

<cite>
**Referenced Files in This Document**
- [main.py](file://backend/app/main.py)
- [auth.py](file://backend/app/api/auth.py)
- [auth.py](file://backend/app/middleware/auth.py)
- [telegram_auth.py](file://backend/app/utils/telegram_auth.py)
- [auth_schemas.py](file://backend/app/schemas/auth.py)
- [users.py](file://backend/app/api/users.py)
- [workouts.py](file://backend/app/api/workouts.py)
- [exercises.py](file://backend/app/api/exercises.py)
- [health.py](file://backend/app/api/health.py)
- [analytics.py](file://backend/app/api/analytics.py)
- [achievements.py](file://backend/app/api/achievements.py)
- [challenges.py](file://backend/app/api/challenges.py)
- [emergency.py](file://backend/app/api/emergency.py)
- [rate_limit.py](file://backend/app/middleware/rate_limit.py)
- [config.py](file://backend/app/utils/config.py)
- [user_model.py](file://backend/app/models/user.py)
- [Dockerfile](file://backend/Dockerfile)
- [docker-compose.yml](file://docker-compose.yml)
- [docker-compose.prod.yml](file://docker-compose.prod.yml)
- [nginx.conf](file://nginx/nginx.conf)
- [DEPLOYMENT.md](file://docs/DEPLOYMENT.md)
- [ENVIRONMENT_SETUP.md](file://docs/ENVIRONMENT_SETUP.md)
- [PRODUCTION_CHECKLIST.md](file://docs/PRODUCTION_CHECKLIST.md)
- [SECURITY_CHECKLIST.md](file://docs/SECURITY_CHECKLIST.md)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive Docker infrastructure documentation with Alpine Linux benefits
- Updated proxy support documentation for HTTP_PROXY, HTTPS_PROXY, and NO_PROXY environments
- Enhanced enterprise-ready infrastructure setup with Nginx reverse proxy
- Added monitoring and observability stack documentation
- Updated deployment and production setup procedures
- Enhanced security and compliance documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Infrastructure & Deployment](#infrastructure--deployment)
6. [Docker Configuration](#docker-configuration)
7. [Enterprise Infrastructure](#enterprise-infrastructure)
8. [Monitoring & Observability](#monitoring--observability)
9. [Security & Compliance](#security--compliance)
10. [Detailed Component Analysis](#detailed-component-analysis)
11. [Dependency Analysis](#dependency-analysis)
12. [Performance Considerations](#performance-considerations)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Conclusion](#conclusion)

## Introduction
FitTracker Pro is a Telegram Mini App backend built with FastAPI that provides comprehensive fitness tracking capabilities. The system enables users to authenticate via Telegram WebApp, manage workouts, track health metrics, monitor analytics, earn achievements, participate in challenges, and utilize emergency safety features. The backend follows RESTful principles with structured endpoints organized by functional domains.

**Updated** Enhanced with enterprise-ready Docker infrastructure using Alpine Linux, comprehensive proxy support, and integrated monitoring systems.

## Project Structure
The backend follows a modular FastAPI architecture with clear separation of concerns and enterprise-grade infrastructure:

```mermaid
graph TB
subgraph "Enterprise Infrastructure"
A[Docker Containers]
B[Nginx Reverse Proxy]
C[Monitoring Stack]
D[Load Balancing]
end
subgraph "API Layer"
E[Auth API]
F[Users API]
G[Workouts API]
H[Exercises API]
I[Health API]
J[Analytics API]
K[Achievements API]
L[Challenges API]
M[Emergency API]
end
subgraph "Middleware Layer"
N[Authentication Middleware]
O[Rate Limiting Middleware]
P[Proxy Support]
end
subgraph "Utility Layer"
Q[Telegram Auth Utils]
R[Configuration]
S[Environment Variables]
end
subgraph "Models Layer"
T[User Model]
U[Workout Models]
V[Health Models]
end
subgraph "Schemas Layer"
W[Pydantic Schemas]
X[API Responses]
end
A --> B
B --> C
B --> D
E --> N
F --> N
G --> N
H --> N
I --> N
J --> N
K --> N
L --> N
M --> N
N --> T
O --> R
P --> R
Q --> R
T --> U
T --> V
W --> E
W --> F
W --> G
X --> Y[Response Formats]
```

**Diagram sources**
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)
- [nginx.conf:56-144](file://nginx/nginx.conf#L56-L144)
- [main.py:90-106](file://backend/app/main.py#L90-L106)

**Section sources**
- [main.py:13-26](file://backend/app/main.py#L13-L26)
- [main.py:89-106](file://backend/app/main.py#L89-L106)

## Core Components

### Authentication System
The authentication system combines Telegram WebApp authentication with JWT token management:

```mermaid
sequenceDiagram
participant Client as "Telegram WebApp"
participant AuthAPI as "Auth API"
participant Telegram as "Telegram Servers"
participant JWT as "JWT Tokens"
participant DB as "Database"
Client->>AuthAPI : POST /api/v1/auth/telegram
AuthAPI->>Telegram : Validate initData signature
Telegram-->>AuthAPI : Signature verification result
AuthAPI->>DB : Create/Update user record
DB-->>AuthAPI : User object
AuthAPI->>JWT : Generate access & refresh tokens
JWT-->>AuthAPI : JWT tokens
AuthAPI-->>Client : AuthResponse with tokens
Note over Client,JWT : Subsequent requests use Bearer tokens
```

**Diagram sources**
- [auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [telegram_auth.py:172-204](file://backend/app/utils/telegram_auth.py#L172-L204)

### Rate Limiting System
The system implements distributed rate limiting using Redis with configurable limits per endpoint:

```mermaid
flowchart TD
A[Incoming Request] --> B{Check Redis Availability}
B --> |Redis Available| C[Use Redis Storage]
B --> |Redis Unavailable| D[Use Memory Storage]
C --> E[Generate Key: ratelimit:{identifier}:{path}]
D --> E
E --> F[Clean Old Entries]
F --> G[Count Current Requests]
G --> H{Within Limit?}
H --> |Yes| I[Allow Request]
H --> |No| J[Raise 429 Too Many Requests]
I --> K[Increment Counter]
K --> L[Set Expiry]
L --> M[Process Request]
M --> N[Add Rate Limit Headers]
N --> O[Return Response]
J --> P[Add Rate Limit Headers]
P --> Q[Return Error Response]
```

**Diagram sources**
- [rate_limit.py:37-179](file://backend/app/middleware/rate_limit.py#L37-L179)

**Section sources**
- [auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [auth.py:21-76](file://backend/app/middleware/auth.py#L21-L76)
- [rate_limit.py:17-34](file://backend/app/middleware/rate_limit.py#L17-L34)

## Architecture Overview

```mermaid
graph TB
subgraph "External Systems"
TA[Telegram WebApp]
TG[Telegram Bot API]
RD[Redis Cache]
DB[(PostgreSQL Database)]
MON[Monitoring Stack]
NGINX[Nginx Proxy]
ENDUSER[End Users]
end
subgraph "FastAPI Application"
APP[Main Application]
AUTH[Auth Router]
API[API Routers]
MW[Middleware]
UT[Utilities]
ENDPT[Endpoints]
end
subgraph "Core Services"
JWT[JWT Management]
TL[Rate Limiting]
TA2[Telegram Auth]
CFG[Configuration]
PROXY[Proxy Support]
ALPINE[Alpine Linux]
GUNICORN[Gunicorn Workers]
end
ENDUSER --> NGINX
NGINX --> APP
TA --> AUTH
TG --> TA2
RD --> TL
DB --> APP
APP --> AUTH
APP --> API
APP --> MW
APP --> UT
AUTH --> JWT
MW --> TL
UT --> TA2
UT --> CFG
UT --> PROXY
UT --> ALPINE
APP --> ENDPT
ENDPT --> GUNICORN
APP --> MON
```

**Diagram sources**
- [main.py:56-75](file://backend/app/main.py#L56-L75)
- [rate_limit.py:48-59](file://backend/app/middleware/rate_limit.py#L48-L59)
- [config.py:15-54](file://backend/app/utils/config.py#L15-L54)
- [Dockerfile:2-60](file://backend/Dockerfile#L2-L60)
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)

## Infrastructure & Deployment

### Enterprise Deployment Architecture

The FitTracker Pro backend is designed for enterprise deployment with comprehensive infrastructure support:

```mermaid
graph TB
subgraph "Production Environment"
A[Load Balancer/Nginx]
B[Reverse Proxy]
C[Backend Services]
D[Database Layer]
E[Caching Layer]
F[Monitoring & Logging]
end
subgraph "Containerized Services"
G[Backend Container]
H[Frontend Container]
I[PostgreSQL Container]
J[Redis Container]
K[Monitoring Containers]
end
subgraph "Security Layer"
L[SSL/TLS Termination]
M[CORS Management]
N[Rate Limiting]
O[Firewall Rules]
end
A --> B
B --> C
C --> D
C --> E
C --> F
G --> I
G --> J
H --> A
L --> A
M --> B
N --> B
O --> A
```

**Diagram sources**
- [docker-compose.prod.yml:3-132](file://docker-compose.prod.yml#L3-L132)
- [nginx.conf:56-144](file://nginx/nginx.conf#L56-L144)

### Container Orchestration

The system uses Docker Compose for orchestration with separate development and production configurations:

**Development Environment:**
- Alpine Linux base with optimized dependencies
- Hot reload for development
- Volume mounting for code changes
- Integrated development tools

**Production Environment:**
- Optimized Alpine Linux containers
- Gunicorn with Uvicorn workers
- Resource limits and constraints
- SSL termination at Nginx layer
- Comprehensive monitoring stack

**Section sources**
- [docker-compose.yml:1-99](file://docker-compose.yml#L1-L99)
- [docker-compose.prod.yml:1-132](file://docker-compose.prod.yml#L1-L132)

## Docker Configuration

### Alpine Linux Benefits

The backend utilizes Alpine Linux for several key advantages:

**Size and Security:**
- Minimal attack surface with reduced package footprint
- Faster container startup times
- Lower memory and CPU overhead
- Regular security updates from Alpine Security Team

**Optimized Dependencies:**
- Lightweight system libraries (musl libc instead of glibc)
- Optimized compiler toolchain (gcc, musl-dev)
- Reduced container image size (~50% smaller than Debian-based images)
- Efficient package management with apk

### Proxy Support Configuration

The Docker configuration includes comprehensive proxy support:

**Environment Variables:**
- `HTTP_PROXY`: HTTP proxy for outbound connections
- `HTTPS_PROXY`: HTTPS proxy for secure connections  
- `NO_PROXY`: Comma-separated list of hosts excluded from proxy
- Automatic propagation to pip installer and system packages

**Implementation Details:**
- Proxy arguments passed during Docker build phase
- System-level proxy configuration for package installation
- Python pip configuration with proxy support
- Alpine package manager configured for proxy environments

**Section sources**
- [Dockerfile:1-60](file://backend/Dockerfile#L1-L60)

### Container Security Features

**Non-Root User Execution:**
- Dedicated `appuser` account for container processes
- Restricted file permissions and ownership
- Principle of least privilege applied
- Read-only filesystem where possible

**Health Checks:**
- Built-in health monitoring for all services
- Database connectivity verification
- Application endpoint health validation
- Automatic restart policies

**Resource Management:**
- CPU and memory limits for production containers
- Process isolation and resource constraints
- Graceful shutdown handling

**Section sources**
- [Dockerfile:32-59](file://backend/Dockerfile#L32-L59)
- [docker-compose.prod.yml:25-101](file://docker-compose.prod.yml#L25-L101)

## Enterprise Infrastructure

### Nginx Reverse Proxy Configuration

The production setup includes a comprehensive Nginx reverse proxy with enterprise-grade features:

**SSL/TLS Termination:**
- Automatic HTTPS redirection
- Modern TLS protocols (TLSv1.2, TLSv1.3)
- Strong cipher suite configuration
- Certificate management integration

**Security Headers:**
- Comprehensive security headers implementation
- Content Security Policy (CSP) configuration
- XSS protection and clickjacking prevention
- Strict Transport Security enforcement

**Performance Optimization:**
- HTTP/2 and HTTP/3 support
- Gzip compression for static and dynamic content
- Connection pooling and keep-alive
- Caching strategies for static assets

**Rate Limiting and Protection:**
- Configurable rate limiting zones
- DDoS protection mechanisms
- Request size limits
- Connection limiting per IP

**Section sources**
- [nginx.conf:56-144](file://nginx/nginx.conf#L56-L144)

### Monitoring and Observability Stack

**Prometheus Metrics Collection:**
- System-level metrics with Node Exporter
- Container metrics with cAdvisor
- Custom application metrics
- Alerting rules and notification channels

**Grafana Dashboard:**
- Real-time system monitoring
- Application performance dashboards
- Custom visualization panels
- Historical trend analysis

**Log Aggregation:**
- Centralized log collection with Loki
- Structured logging with JSON format
- Log retention and archival policies
- Search and filtering capabilities

**Section sources**
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-L124)

### Load Balancing and High Availability

**Service Discovery:**
- Docker Swarm native service discovery
- Health check integration
- Automatic failover mechanisms
- Load distribution across replicas

**Connection Pooling:**
- Optimized database connection pools
- Redis client connection management
- HTTP client connection reuse
- Resource cleanup and recycling

**Section sources**
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)

## Monitoring & Observability

### Prometheus Metrics Configuration

The monitoring stack collects comprehensive metrics for system and application performance:

**System Metrics:**
- CPU utilization and load averages
- Memory consumption and swap usage
- Disk I/O and network throughput
- Process counts and resource limits

**Application Metrics:**
- Request rates and response times
- Error rates and exception counts
- Database query performance
- Cache hit ratios and memory usage

**Custom Metrics:**
- User activity and engagement metrics
- Feature usage analytics
- Performance benchmarks
- Business KPI tracking

### Grafana Dashboard Implementation

**Dashboard Categories:**
- Infrastructure overview with system health
- Application performance monitoring
- Database and cache metrics
- Custom business metrics and analytics

**Alerting Integration:**
- Threshold-based alerting rules
- Notification channels (Slack, email, SMS)
- Escalation policies and on-call schedules
- Alert suppression during maintenance windows

### Log Management

**Structured Logging:**
- JSON-formatted log entries
- Correlation IDs for request tracing
- Severity levels and contextual information
- Performance timing and resource metrics

**Log Aggregation:**
- Centralized log collection and storage
- Search and filtering capabilities
- Log retention and archival policies
- Export and compliance reporting

**Section sources**
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-124)

## Security & Compliance

### SSL/TLS Configuration

**Certificate Management:**
- Automated certificate acquisition and renewal
- Multiple certificate validation checks
- Certificate chain verification
- Automatic deployment to Nginx

**Security Hardening:**
- Modern TLS protocol enforcement
- Strong cipher suite selection
- Perfect forward secrecy implementation
- OCSP stapling for certificate validation

**Section sources**
- [nginx.conf:61-76](file://nginx/nginx.conf#L61-L76)

### CORS and Cross-Origin Security

**Origin Validation:**
- Configurable allowed origins list
- Wildcard origin restrictions
- Subdomain matching and validation
- Pre-flight request handling

**Security Headers:**
- Content Security Policy (CSP) implementation
- XSS protection headers
- Clickjacking prevention
- MIME-type sniffing protection

### Rate Limiting and DDoS Protection

**Multi-Layer Protection:**
- Nginx-level rate limiting
- Application-level rate limiting
- IP-based blocking and throttling
- Request size and frequency controls

**Monitoring and Alerts:**
- Real-time traffic analysis
- Anomaly detection and alerting
- Attack pattern recognition
- Automatic mitigation responses

**Section sources**
- [nginx.conf:33-36](file://nginx/nginx.conf#L33-L36)
- [nginx.conf:78-101](file://nginx/nginx.conf#L78-L101)

### Compliance and Auditing

**Data Protection:**
- GDPR compliance measures
- Data retention and deletion policies
- User consent management
- Data subject rights implementation

**Audit Logging:**
- Comprehensive event logging
- User action tracking
- Security incident logging
- Compliance reporting capabilities

**Section sources**
- [SECURITY_CHECKLIST.md:1-193](file://docs/SECURITY_CHECKLIST.md#L1-L193)

## Detailed Component Analysis

### Authentication Endpoints

#### Telegram Authentication
**Endpoint:** `POST /api/v1/auth/telegram`
**Authentication:** None (required for initial auth)
**Purpose:** Validates Telegram initData and authenticates users

**Request Schema:**
- `init_data` (string, required): Raw initData string from Telegram WebApp

**Response Schema:**
- `success` (boolean): Authentication result
- `message` (string): Status message
- `user` (object): Telegram user data
- `access_token` (string): JWT access token
- `token_type` (string): Token type (bearer)
- `expires_in` (integer): Token expiration in seconds

**Validation Rules:**
- initData must be signed by Telegram servers
- Timestamp must be within 5 minutes
- User data must be extractable from initData

**Section sources**
- [auth.py:95-175](file://backend/app/api/auth.py#L95-L175)
- [auth_schemas.py:10-44](file://backend/app/schemas/auth.py#L10-L44)
- [telegram_auth.py:108-156](file://backend/app/utils/telegram_auth.py#L108-L156)

#### User Profile Management
**Endpoint:** `GET /api/v1/auth/me`
**Authentication:** JWT Bearer required
**Purpose:** Retrieve current user's profile

**Response Schema:**
- `id` (integer): Internal user ID
- `telegram_id` (integer): Telegram user ID
- `username` (string): Telegram username
- `first_name` (string): First name
- `profile` (object): User profile data
- `settings` (object): User settings
- `created_at` (datetime): Account creation timestamp
- `updated_at` (datetime): Last update timestamp

**Section sources**
- [auth.py:186-222](file://backend/app/api/auth.py#L186-L222)
- [auth_schemas.py:60-72](file://backend/app/schemas/auth.py#L60-L72)

#### Token Refresh
**Endpoint:** `POST /api/v1/auth/refresh`
**Authentication:** None
**Purpose:** Refresh access token using refresh token

**Request Schema:**
- `refresh_token` (string, required): JWT refresh token

**Response Schema:**
- `access_token` (string): New access token
- `refresh_token` (string): New refresh token
- `token_type` (string): Token type
- `expires_in` (integer): Token expiration in seconds

**Section sources**
- [auth.py:274-317](file://backend/app/api/auth.py#L274-L317)
- [auth_schemas.py:82-84](file://backend/app/schemas/auth.py#L82-L84)

### User Management Endpoints

#### User Creation
**Endpoint:** `POST /api/v1/users/`
**Authentication:** JWT Bearer required
**Purpose:** Create or update user from Telegram data

**Request Schema:**
- `telegram_id` (integer, required): Telegram user ID
- `username` (string): Telegram username
- `first_name` (string): First name
- `last_name` (string): Last name

**Response Schema:**
Same as user profile response

**Section sources**
- [users.py:32-44](file://backend/app/api/users.py#L32-L44)
- [users.py:12-26](file://backend/app/api/users.py#L12-L26)

### Workout Tracking Endpoints

#### Workout Templates
**Endpoint:** `GET /api/v1/workouts/templates`
**Authentication:** JWT Bearer required
**Purpose:** Get user's workout templates with filtering and pagination

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page
- `template_type` (string): Filter by type (cardio, strength, flexibility, mixed)

**Response Schema:**
- `items` (array): Workout templates
- `total` (integer): Total count
- `page` (integer): Current page
- `page_size` (integer): Items per page

**Section sources**
- [workouts.py:29-105](file://backend/app/api/workouts.py#L29-L105)

#### Workout History
**Endpoint:** `GET /api/v1/workouts/history`
**Authentication:** JWT Bearer required
**Purpose:** Get workout history with date filtering

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page
- `date_from` (date): Filter from date (YYYY-MM-DD)
- `date_to` (date): Filter to date (YYYY-MM-DD)

**Response Schema:**
- `items` (array): Workout history items
- `total` (integer): Total count
- `page` (integer): Current page
- `page_size` (integer): Items per page
- `date_from` (date): Applied filter
- `date_to` (date): Applied filter

**Section sources**
- [workouts.py:260-334](file://backend/app/api/workouts.py#L260-L334)

#### Start Workout Session
**Endpoint:** `POST /api/v1/workouts/start`
**Authentication:** JWT Bearer required
**Purpose:** Start a new workout session

**Request Schema:**
- `template_id` (integer): Template to use
- `name` (string): Workout name
- `type` (string): Workout type

**Response Schema:**
- `id` (integer): Workout log ID
- `user_id` (integer): User ID
- `template_id` (integer): Template ID
- `date` (date): Workout date
- `start_time` (datetime): Start timestamp
- `status` (string): Session status (in_progress)
- `message` (string): Status message

**Section sources**
- [workouts.py:337-412](file://backend/app/api/workouts.py#L337-L412)

#### Complete Workout Session
**Endpoint:** `POST /api/v1/workouts/complete`
**Authentication:** JWT Bearer required
**Purpose:** Complete a workout session

**Request Schema:**
- `duration` (integer): Workout duration in minutes
- `exercises` (array): Exercise completion data
- `comments` (string): Workout notes
- `tags` (array): Tags for categorization
- `glucose_before` (number): Blood glucose before workout
- `glucose_after` (number): Blood glucose after workout

**Response Schema:**
- All workout log fields plus completion data

**Section sources**
- [workouts.py:415-493](file://backend/app/api/workouts.py#L415-L493)

### Health Monitoring Endpoints

#### Glucose Tracking
**Endpoint:** `POST /api/v1/health/glucose`
**Authentication:** JWT Bearer required
**Purpose:** Record a new glucose measurement

**Request Schema:**
- `value` (number, required): Glucose value
- `measurement_type` (string, required): Measurement timing
- `timestamp` (datetime): Measurement timestamp
- `notes` (string): Additional notes
- `workout_id` (integer): Associated workout

**Response Schema:**
- `id` (integer): Glucose log ID
- `user_id` (integer): User ID
- `workout_id` (integer): Associated workout
- `value` (number): Glucose value
- `measurement_type` (string): Measurement timing
- `timestamp` (datetime): Measurement timestamp
- `notes` (string): Notes

**Section sources**
- [health.py:29-91](file://backend/app/api/health.py#L29-L91)

#### Wellness Tracking
**Endpoint:** `POST /api/v1/health/wellness`
**Authentication:** JWT Bearer required
**Purpose:** Create or update daily wellness entry

**Request Schema:**
- `date` (date, required): Entry date
- `sleep_score` (integer): Sleep quality score
- `sleep_hours` (number): Hours slept
- `energy_score` (integer): Energy level
- `pain_zones` (object): Pain location scores
- `stress_level` (integer): Stress level
- `mood_score` (integer): Mood score
- `notes` (string): Additional notes

**Response Schema:**
- All wellness entry fields

**Section sources**
- [health.py:259-336](file://backend/app/api/health.py#L259-L336)

#### Health Statistics
**Endpoint:** `GET /api/v1/health/stats`
**Authentication:** JWT Bearer required
**Purpose:** Get health statistics summary

**Query Parameters:**
- `period` (string, default: "30d"): Time period (7d, 30d, 90d, 1y)

**Response Schema:**
- `period` (string): Applied period
- `glucose` (object): Glucose statistics
- `workouts` (object): Workout statistics
- `wellness` (object): Wellness statistics
- `generated_at` (datetime): Report generation timestamp

**Section sources**
- [health.py:409-614](file://backend/app/api/health.py#L409-L614)

### Analytics Endpoints

#### Exercise Progress
**Endpoint:** `GET /api/v1/analytics/progress`
**Authentication:** JWT Bearer required
**Purpose:** Get exercise progress analytics

**Query Parameters:**
- `exercise_id` (integer): Specific exercise ID
- `period` (string, default: "30d"): Time period

**Response Schema:**
Array of exercise progress data with:
- `exercise_id` (integer): Exercise ID
- `exercise_name` (string): Exercise name
- `period` (string): Applied period
- `data_points` (array): Chart data points
- `summary` (object): Progress summary
- `best_performance` (object): Best performance record

**Section sources**
- [analytics.py:27-197](file://backend/app/api/analytics.py#L27-L197)

#### Workout Calendar
**Endpoint:** `GET /api/v1/analytics/calendar`
**Authentication:** JWT Bearer required
**Purpose:** Get workout calendar for a specific month

**Query Parameters:**
- `year` (integer, default: current year): Year
- `month` (integer, default: current month): Month

**Response Schema:**
- `year` (integer): Year
- `month` (integer): Month
- `days` (array): Calendar day entries
- `summary` (object): Monthly summary

**Section sources**
- [analytics.py:200-307](file://backend/app/api/analytics.py#L200-L307)

#### Data Export
**Endpoint:** `POST /api/v1/analytics/export`
**Authentication:** JWT Bearer required
**Purpose:** Request data export

**Request Schema:**
- `format` (string, required): Export format
- `date_from` (date, required): Start date
- `date_to` (date, required): End date
- `include_workouts` (boolean): Include workout data
- `include_glucose` (boolean): Include glucose data
- `include_wellness` (boolean): Include wellness data
- `include_achievements` (boolean): Include achievements data

**Response Schema:**
- `export_id` (string): Export job ID
- `status` (string): Export status
- `format` (string): Export format
- `download_url` (string): Download URL
- `expires_at` (datetime): Expiration timestamp
- `requested_at` (datetime): Request timestamp
- `file_size` (integer): File size

**Section sources**
- [analytics.py:310-365](file://backend/app/api/analytics.py#L310-L365)

### Achievements Endpoints

#### Achievement Catalog
**Endpoint:** `GET /api/v1/achievements/`
**Authentication:** JWT Bearer required
**Purpose:** Get list of all available achievements

**Query Parameters:**
- `category` (string): Filter by category

**Response Schema:**
- `items` (array): Achievement objects
- `total` (integer): Total count
- `categories` (array): Available categories

**Section sources**
- [achievements.py:25-88](file://backend/app/api/achievements.py#L25-L88)

#### User Achievements
**Endpoint:** `GET /api/v1/achievements/user`
**Authentication:** JWT Bearer required
**Purpose:** Get current user's achievements

**Response Schema:**
- `items` (array): User achievement objects
- `total` (integer): Total count
- `total_points` (integer): Total points earned
- `completed_count` (integer): Completed achievements
- `in_progress_count` (integer): In-progress achievements
- `recent_achievements` (array): Recently earned achievements

**Section sources**
- [achievements.py:91-171](file://backend/app/api/achievements.py#L91-L171)

#### Claim Achievement
**Endpoint:** `POST /api/v1/achievements/{achievement_id}/claim`
**Authentication:** JWT Bearer required
**Purpose:** Claim an achievement if criteria are met

**Response Schema:**
- `unlocked` (boolean): Whether achievement was unlocked
- `achievement` (object): Achievement details
- `points_earned` (integer): Points earned
- `new_total_points` (integer): Total points after unlock
- `message` (string): Status message

**Section sources**
- [achievements.py:216-309](file://backend/app/api/achievements.py#L216-L309)

### Challenges Endpoints

#### Challenge Catalog
**Endpoint:** `GET /api/v1/challenges/`
**Authentication:** JWT Bearer required
**Purpose:** Get list of challenges with filtering

**Query Parameters:**
- `status` (string): Filter by status
- `challenge_type` (string): Filter by type
- `is_public` (boolean): Filter by visibility
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page

**Response Schema:**
- `items` (array): Challenge objects
- `total` (integer): Total count
- `page` (integer): Current page
- `page_size` (integer): Items per page
- `filters` (object): Applied filters

**Section sources**
- [challenges.py:32-158](file://backend/app/api/challenges.py#L32-L158)

#### Create Challenge
**Endpoint:** `POST /api/v1/challenges/`
**Authentication:** JWT Bearer required
**Purpose:** Create new challenge

**Request Schema:**
- `name` (string, required): Challenge name
- `description` (string, required): Challenge description
- `type` (string, required): Challenge type
- `goal` (object, required): Goal specification
- `start_date` (date, required): Start date
- `end_date` (date, required): End date
- `is_public` (boolean): Public visibility
- `max_participants` (integer): Maximum participants
- `rules` (object): Challenge rules
- `banner_url` (string): Banner image URL

**Response Schema:**
- All challenge fields including status and metadata

**Section sources**
- [challenges.py:215-314](file://backend/app/api/challenges.py#L215-L314)

### Emergency Endpoints

#### Emergency Contacts
**Endpoint:** `GET /api/v1/emergency/contact`
**Authentication:** JWT Bearer required
**Purpose:** Get user's emergency contacts

**Response Schema:**
- `items` (array): Emergency contact objects
- `total` (integer): Total count
- `active_count` (integer): Active contacts count

**Section sources**
- [emergency.py:27-78](file://backend/app/api/emergency.py#L27-L78)

#### Send Emergency Notification
**Endpoint:** `POST /api/v1/emergency/notify`
**Authentication:** JWT Bearer required
**Purpose:** Send emergency notification to all active contacts

**Request Schema:**
- `message` (string): Emergency message
- `location` (string): Location details
- `workout_id` (integer): Associated workout
- `severity` (string): Alert severity level

**Response Schema:**
- `notified_at` (datetime): Notification timestamp
- `severity` (string): Alert severity
- `message_sent` (string): Sent message content
- `results` (array): Notification results
- `successful_count` (integer): Successful notifications
- `failed_count` (integer): Failed notifications

**Section sources**
- [emergency.py:249-359](file://backend/app/api/emergency.py#L249-L359)

## Dependency Analysis

```mermaid
graph TB
subgraph "External Dependencies"
JWT[jose/jwt]
REDIS[redis-py]
SQLA[SQLAlchemy]
FASTAPI[FastAPI]
ALPINE[Alpine Linux]
NGINX[nginx]
PROM[Prometheus]
GRAFANA[grafana]
LOKI[loki]
CADVISOR[cAdvisor]
NODEEXP[node_exporter]
end
subgraph "Internal Modules"
MAIN[main.py]
AUTH_API[auth.py]
AUTH_MW[auth.py]
TGA[telegram_auth.py]
RL[rate_limit.py]
CFG[config.py]
UM[user_model.py]
ENDPT[endpoints]
end
subgraph "Database Models"
U[User]
WT[WorkoutTemplate]
WL[WorkoutLog]
GL[GlucoseLog]
DW[DailyWellness]
AC[Achievement]
UA[UserAchievement]
CH[Challenge]
EC[EmergencyContact]
EX[Exercise]
end
subgraph "Schemas"
AS[auth_schemas.py]
WS[workouts_schemas.py]
HS[health_schemas.py]
ES[exercises_schemas.py]
AS2[analytics_schemas.py]
AS3[achievements_schemas.py]
AS4[challenges_schemas.py]
AS5[emergency_schemas.py]
end
MAIN --> AUTH_API
MAIN --> RL
AUTH_API --> AUTH_MW
AUTH_API --> TGA
AUTH_MW --> UM
RL --> CFG
TGA --> CFG
AUTH_API --> AS
AUTH_MW --> AS
UM --> U
U --> WT
U --> WL
U --> GL
U --> DW
U --> AC
U --> UA
U --> CH
U --> EC
U --> EX
WS --> WL
HS --> GL
HS --> DW
ES --> EX
AS2 --> WL
AS3 --> UA
AS4 --> CH
AS5 --> EC
ENDPT --> ALPINE
ENDPT --> NGINX
ENDPT --> PROM
ENDPT --> GRAFANA
ENDPT --> LOKI
ENDPT --> CADVISOR
ENDPT --> NODEEXP
```

**Diagram sources**
- [main.py:13-26](file://backend/app/main.py#L13-L26)
- [auth.py:34-36](file://backend/app/api/auth.py#L34-L36)
- [auth.py:19-24](file://backend/app/middleware/auth.py#L19-L24)
- [telegram_auth.py:11-12](file://backend/app/utils/telegram_auth.py#L11-L12)
- [rate_limit.py:14-15](file://backend/app/middleware/rate_limit.py#L14-L15)
- [config.py:15-54](file://backend/app/utils/config.py#L15-L54)
- [user_model.py:23-132](file://backend/app/models/user.py#L23-L132)

**Section sources**
- [main.py:13-26](file://backend/app/main.py#L13-L26)
- [auth.py:34-36](file://backend/app/api/auth.py#L34-L36)
- [auth.py:19-24](file://backend/app/middleware/auth.py#L19-L24)

## Performance Considerations

### Rate Limiting Configuration
The system implements tiered rate limiting with Redis-backed counters:

| Endpoint Pattern | Requests | Window (seconds) |
|-----------------|----------|------------------|
| `/api/v1/auth/telegram` | 5 | 60 |
| `/api/v1/auth/refresh` | 10 | 60 |
| `/api/v1/auth/logout` | 10 | 60 |
| `/api/v1/emergency/notify` | 20 | 60 |
| `/api/v1/analytics/export` | 5 | 3600 |
| Default | 100 | 60 |

### Database Optimization
- All user-related queries use indexed Telegram user IDs
- Pagination implemented across list endpoints
- Efficient filtering with SQLAlchemy ORM
- JSONB fields optimized for profile and settings data

### Caching Strategy
- Redis used for rate limiting counters
- In-memory fallback when Redis unavailable
- Configurable cache expiration for dynamic data

### Container Performance
**Alpine Linux Benefits:**
- Reduced container startup time (up to 50% faster)
- Lower memory footprint (20-30% less RAM usage)
- Faster cold start performance
- Reduced disk I/O operations

**Gunicorn Worker Configuration:**
- Uvicorn workers for optimal async performance
- Configurable worker count based on CPU cores
- Process isolation for stability
- Graceful worker restart handling

**Section sources**
- [Dockerfile:21-30](file://backend/Dockerfile#L21-L30)
- [docker-compose.prod.yml:77-82](file://docker-compose.prod.yml#L77-L82)

## Troubleshooting Guide

### Authentication Issues
**Common Problems:**
- Invalid Telegram initData signature
- Expired authentication timestamps
- Missing or malformed user data

**Diagnostic Steps:**
1. Verify Telegram bot token configuration
2. Check initData timestamp validity (within 5 minutes)
3. Confirm signature verification passes
4. Validate user data extraction succeeds

**Section sources**
- [telegram_auth.py:108-156](file://backend/app/utils/telegram_auth.py#L108-L156)
- [auth.py:135-183](file://backend/app/api/auth.py#L135-L183)

### Rate Limiting Errors
**429 Too Many Requests Response:**
- Check X-RateLimit-* headers for current limits
- Review endpoint-specific configurations
- Monitor Redis connectivity for distributed limits

**Section sources**
- [rate_limit.py:159-169](file://backend/app/middleware/rate_limit.py#L159-L169)

### Database Connection Issues
**Symptoms:**
- Operational errors on database operations
- Connection pool exhaustion
- Transaction failures

**Solutions:**
1. Verify DATABASE_URL configuration
2. Check connection pool settings
3. Implement proper error handling
4. Monitor database performance

**Section sources**
- [config.py:22-23](file://backend/app/utils/config.py#L22-L23)

### Docker and Container Issues

**Container Startup Failures:**
- Check Alpine package installation logs
- Verify proxy configuration for package downloads
- Review non-root user permissions
- Validate health check configurations

**Performance Issues:**
- Monitor container resource usage
- Check Gunicorn worker configuration
- Verify Redis connectivity
- Review database connection pooling

**Network Connectivity:**
- Verify Docker network configuration
- Check Nginx proxy settings
- Validate SSL certificate configuration
- Review CORS policy settings

**Section sources**
- [Dockerfile:21-30](file://backend/Dockerfile#L21-L30)
- [docker-compose.prod.yml:102-124](file://docker-compose.prod.yml#L102-L124)

### Monitoring and Observability Issues

**Metrics Collection Failures:**
- Verify Prometheus target configuration
- Check Node Exporter connectivity
- Validate cAdvisor permissions
- Review metric scraping intervals

**Dashboard Display Issues:**
- Check Grafana datasource configuration
- Verify dashboard JSON imports
- Review metric label formats
- Validate time range selections

**Log Aggregation Problems:**
- Check Loki service availability
- Verify Promtail configuration
- Review log file permissions
- Validate log retention policies

**Section sources**
- [monitoring/docker-compose.monitoring.yml:1-124](file://monitoring/docker-compose.monitoring.yml#L1-124)

## Conclusion
The FitTracker Pro backend provides a comprehensive RESTful API for fitness tracking applications with robust authentication, comprehensive workout and health monitoring, advanced analytics, gamification features, social challenges, and emergency safety capabilities. The modular architecture ensures maintainability and scalability, while the Telegram WebApp integration provides seamless user experience.

**Updated** The enhanced infrastructure now includes enterprise-grade Docker deployment with Alpine Linux benefits, comprehensive proxy support, integrated monitoring systems, and production-ready security configurations. The system demonstrates best practices in security, performance, and error handling, making it suitable for production deployment in fitness and health monitoring applications with enterprise-scale infrastructure requirements.

Key enhancements include:
- Alpine Linux optimization for reduced resource usage
- Comprehensive proxy support for enterprise environments
- Integrated monitoring and observability stack
- Production-ready security configurations
- Scalable container orchestration
- Advanced load balancing and high availability
- Comprehensive logging and audit capabilities
- Automated deployment and rollback procedures