# Multi-stage production build: Vite → static assets → nginx
# -----------------------------------------------------------------------------
# Stage 1 — build (Node installs full dependency tree; Vite/tsc live in devDependencies)
FROM node:20-alpine AS builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY

WORKDIR /app

# Disable husky in CI/Docker — no .git dir available and hooks are not needed.
ENV HUSKY=0
# Ensure devDependencies are installed for `tsc && vite build` regardless of CI defaults.
ENV NODE_ENV=development

# NODE_ENV must not be production during install (devDependencies include Vite).
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — runtime (nginx serves prebuilt dist only; no Node in final image)
FROM nginx:alpine AS runtime

RUN apk add --no-cache curl gettext

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY startup.sh /startup.sh

COPY --from=builder /app/dist /usr/share/nginx/html

RUN sed -i 's/\r$//' /startup.sh && chmod +x /startup.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1/healthz || exit 1

ENTRYPOINT ["/startup.sh"]
