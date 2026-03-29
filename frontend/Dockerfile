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

# NODE_ENV must not be production during install (devDependencies include Vite).
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — runtime (nginx serves prebuilt dist only; no Node in final image)
FROM nginx:alpine AS runtime

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
