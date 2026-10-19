# Architecture Decision Records – BrewLite

Mỗi quyết định kiến trúc quan trọng được ghi thành một ADR ngắn. Trạng thái dùng: **Accepted**, **Superseded**, **Deprecated**.

| ADR | Quyết định | Trạng thái |
| :--- | :--- | :--- |
| [ADR-001](./001-monorepo.md) | Monorepo pnpm workspaces (`apps/web`, `apps/api`, `docs`) | Accepted – đã áp dụng |
| [ADR-002](./002-modular-monolith-nestjs.md) | Modular monolith NestJS theo domain, không microservices | Accepted – module khung |
| [ADR-003](./003-nextjs-pwa.md) | Next.js App Router + PWA manifest/service worker tự viết | Accepted – skeleton |
| [ADR-004](./004-postgresql-migration.md) | PostgreSQL + Prisma migration, deploy khi khởi động | Accepted – có migration init |
| [ADR-005](./005-mock-payment-module.md) | `PaymentProvider` + `MockPaymentProvider` trong module Payments | Accepted – interface/mock |
| [ADR-006](./006-deployment-platform.md) | Vercel + Render + Render Postgres + GHCR | Accepted – kế hoạch |
| [ADR-007](./007-logging-health-config.md) | JSON logging, `/health`, `/health/ready`, validate env | Accepted – đã áp dụng |
| [ADR-008](./008-auth-jwt-bcrypt.md) | JWT + Bcrypt + guard/role | Accepted – kế hoạch Sprint 2 |
| [ADR-009](./009-frontend-state.md) | Zustand cho cart + fetch wrapper cho server state | Accepted – kế hoạch |

## Liên kết

- Kiến trúc tổng thể: [`../architecture.md`](../architecture.md)
- Deployment diagram: [`../deployment.md`](../deployment.md), [`../diagrams/deployment.puml`](../diagrams/deployment.puml)
- Yêu cầu nguồn: [`../../requirements/srs.md`](../../requirements/srs.md), [`../../requirements/context-and-scope.md`](../../requirements/context-and-scope.md)

## Quy ước thêm ADR

1. Đánh số tuần tự `NNN-ten-ngan.md`.
2. Ghi rõ bối cảnh, lựa chọn thay thế, quyết định, hệ quả tích cực/tiêu cực.
3. Cập nhật bảng mục lục này trong cùng PR.
