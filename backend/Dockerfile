# Python Backend Dockerfile for FastAPI
FROM python:3.11-alpine3.22

# Proxy arguments
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Injected by CI (docker build --build-arg); defaults for local builds
ARG APP_VERSION=1.0.0
ARG GIT_COMMIT_SHA=
ARG BUILD_TIMESTAMP=

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_VERSION=$APP_VERSION \
    GIT_COMMIT_SHA=$GIT_COMMIT_SHA \
    BUILD_TIMESTAMP=$BUILD_TIMESTAMP

# Set working directory
WORKDIR /app

# Install system dependencies
RUN export http_proxy=$HTTP_PROXY && \
    export https_proxy=$HTTPS_PROXY && \
    sed -i 's|https://dl-cdn.alpinelinux.org|http://dl-cdn.alpinelinux.org|g' /etc/apk/repositories && \
    apk add --no-cache \
    python3-dev \
    gcc \
    musl-dev \
    postgresql-dev \
    libffi-dev \
    curl

# Create non-root user (Alpine style)
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Copy requirements first for better caching
COPY requirements ./requirements

# Install Python dependencies
RUN pip install --no-cache-dir --proxy=$HTTPS_PROXY -r requirements/prod.txt

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/system/health || exit 1

# Run the application with Gunicorn and Uvicorn workers
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-", "--capture-output", "--enable-stdio-inheritance", "app.main:app"]
