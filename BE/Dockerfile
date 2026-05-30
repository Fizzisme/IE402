# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# firebase-service-account.json không đưa vào image (sensitive).
# Mount vào runtime qua docker-compose volumes hoặc copy thủ công vào VPS.

EXPOSE 3000

CMD ["node", "dist/main"]
