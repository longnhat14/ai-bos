# ============================================================
# Stage 1: Build - cai dependencies day du (bao gom devDependencies)
# de compile TypeScript, sau do KHONG dua stage nay vao image cuoi cung.
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================================
# Stage 2: Production - CHI copy code da build (dist/) + dependencies
# THAT can luc chay (khong co devDependencies) -> image nho gon hon nhieu,
# giam dien tich tan cong (khong co ts-node, @nestjs/cli... trong production).
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Thu muc luu file dinh kem (anh loi, logo...) - can mount volume that trong
# docker-compose/production, o day chi tao san de tranh loi ENOENT lan dau.
RUN mkdir -p uploads/tickets uploads/webchat uploads/branding

EXPOSE 3000

# Healthcheck cua chinh Docker (khac voi /health endpoint dung cho load balancer
# ben ngoai) - giup lenh "docker ps" va cac cong cu orchestration (Docker Swarm,
# Kubernetes) tu dong biet container nay co dang chay khoe khong.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
