# Architecture Decision Records – BrewLite

Mỗi quyết định kiến trúc quan trọng được ghi thành một ADR ngắn. Trạng thái dùng: **Proposed**, **Accepted**, **Superseded**, **Deprecated**.

## Danh mục

| ADR | Quyết định | Trạng thái |
| :--- | :--- | :--- |
| [ADR-001](./001-monorepo.md) | Monorepo pnpm workspaces (`apps/web`, `apps/api`, `docs`) | Accepted – đã hiện thực (Docker prod chưa có) |
| [ADR-002](./002-modular-monolith-nestjs.md) | Modular monolith NestJS theo domain, không microservices | Accepted – đã hiện thực (không có UsersModule/RolesGuard) |
| [ADR-003](./003-nextjs-pwa.md) | Next.js App Router + PWA manifest/service worker tự viết | Accepted – manifest đã có, service worker chưa |
| [ADR-004](./004-postgresql-prisma-migration.md) | PostgreSQL + Prisma Migrate, forward-only | Accepted – đã hiện thực, khóa khác thiết kế (Serializable + optimistic) |
| [ADR-005](./005-mock-payment-adapter.md) | `PaymentGateway` port + `MockPaymentGateway` adapter | Accepted – hiện thực rút gọn (chưa có port/adapter, job) |
| [ADR-006](./006-deployment-platform.md) | Render cho web/API/Postgres + GHCR | Accepted – chưa hiện thực (chỉ CI) |
| [ADR-007](./007-logging-health-config.md) | JSON logging, `/health`, `/health/ready`, validate env | Accepted – health + validate env đã có, logging JSON chưa |
| [ADR-008](./008-auth-jwt-bcrypt.md) | JWT + Bcrypt + Guard/Role | Accepted – đã hiện thực (không RolesGuard, token ở localStorage) |
| [ADR-009](./009-frontend-state.md) | Zustand cho cart + fetch wrapper cho server state | Accepted – đã hiện thực (thêm TanStack Query) |
| [ADR-010](./010-vnpay-sandbox.md) | Tích hợp VNPay Sandbox (Return URL + IPN), giữ mock fallback | Proposed – kế hoạch triển khai |

Cột **Trạng thái** phản ánh mức hiện thực trong mã nguồn tại 2026-11-09 (CV14); chi tiết ở mục "Trạng thái hiện thực" cuối mỗi ADR. Các quyết định **không bị sửa**; chỗ lệch được ghi nhận, nếu muốn đổi chính thức thì tạo ADR mới.

## Liên kết

- Kiến trúc tổng thể: [`../architecture.md`](../architecture.md)
- Triển khai: [`../../deployment.md`](../../deployment.md), [`../../diagrams/deployment.puml`](../../diagrams/deployment.puml)
- Yêu cầu nguồn: [`../../requirements/srs.md`](../../requirements/srs.md), [`../../requirements/context-and-scope.md`](../../requirements/context-and-scope.md)
- Ma trận truy vết: [`../../traceability-matrix.md`](../../traceability-matrix.md)

## Quy ước thêm ADR

1. Đánh số tuần tự `NNN-ten-ngan.md`.
2. Ghi rõ bối cảnh, các lựa chọn đã cân nhắc, quyết định, hệ quả tích cực/tiêu cực và điều kiện áp dụng.
3. Cập nhật bảng mục lục này trong cùng PR.
4. Khi thay đổi quyết định cũ, tạo ADR mới và đánh dấu ADR cũ là **Superseded**, không sửa lịch sử quyết định.
5. Không ghi secret hay giá trị môi trường thật trong ADR.

## Mẫu

Xem [`template.md`](./template.md).
