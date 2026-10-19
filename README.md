# BrewLite

BrewLite là PWA đặt cà phê không tiền mặt: khách xem menu, chọn size/topping, đặt đơn, thanh toán mô phỏng và nhận tại quầy. Repo phục vụ bài tập lớn môn Công nghệ Phần mềm (Assignment 2).

> Trạng thái: **Task 3 – skeleton kiến trúc**. Nghiệp vụ auth/orders/payments là TODO Sprint 1–2; production **chưa deploy**.

## Cấu trúc

```text
apps/
  web/        Next.js 16 (App Router) + PWA manifest/service worker
  api/        NestJS 11 + Prisma 6 (health, module khung domain)
docs/
  requirements/   Task 1
  diagrams/       Activity / Sequence / Class (Task 2)
  architecture/   Task 3: architecture.md, deployment.md, ADR, deployment.puml
  traceability-matrix.md
.github/workflows/ci.yml
docker-compose.yml
```

## Chạy local (native)

Yêu cầu: Node.js ≥ 22, pnpm 12, PostgreSQL 16 (hoặc dùng Docker bên dưới).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm prisma:generate
pnpm prisma:migrate

pnpm dev:api   # http://localhost:3000
pnpm dev:web   # http://localhost:3001
```

Kiểm tra API:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

## Chạy local bằng Docker Compose

```bash
cp .env.example .env
docker compose up --build
# web: http://localhost:3001
# api: http://localhost:3000
# db:  localhost:5432
```

Compose chạy migration tự động qua `apps/api/docker-entrypoint.sh` (biến `RUN_MIGRATIONS=true`).

## Lệnh kiểm tra

```bash
pnpm lint
pnpm test
pnpm build
```

## Tài liệu

- [Kiến trúc](docs/architecture/architecture.md)
- [Deployment & rollback](docs/architecture/deployment.md)
- [ADR](docs/architecture/adr/README.md)
- [SRS](docs/requirements/srs.md)
- [Traceability matrix](docs/traceability-matrix.md)

## Deploy & rollback (tóm tắt)

- CI: `.github/workflows/ci.yml` – lint/test/build → image GHCR → deploy hook Render → smoke test `/health/ready`. Vercel tự deploy web từ Git.
- Rollback API: Render redeploy image `sha-<commit>` trước đó; migration là forward-only.
- Rollback web: Vercel → Deployments → Promote deployment cũ.
- Rollback DB: restore backup theo gói Render; kiểm tra quy trình thực tế trước khi thao tác.

## Ghi chú

- Không commit `.env` hoặc secret; chỉ commit `.env.example`.
- Giới hạn gói free/backup của Render/Vercel cần kiểm tra lại trên trang giá chính thức.
