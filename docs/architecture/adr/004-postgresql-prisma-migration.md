# ADR-004: PostgreSQL + Prisma Migrate

- **Trạng thái**: Accepted – thiết kế; hiện thực Task 4–5
- **Ngày**: 2026-10-19
- **Liên quan**: FR-05, FR-06, FR-09, FR-10, NFR-05, NFR-04

## Bối cảnh

Cần CSDL quan hệ cho order/payment với transaction, unique constraint và khóa row. Task 1 đã chọn PostgreSQL và Prisma. Cần migration tái tạo được DB ở local, CI và production, đồng thời có chiến lược rollback an toàn.

## Các lựa chọn đã cân nhắc

1. **PostgreSQL + Prisma** (schema, migrate, client type-safe).
2. PostgreSQL + TypeORM.
3. PostgreSQL + Knex/SQL thuần.
4. SQLite cho demo.

## Quyết định

Chọn phương án **1**:

- Schema tại `apps/api/prisma/schema.prisma`; migration SQL commit trong `apps/api/prisma/migrations/`.
- Local: `prisma migrate dev`; production: `prisma migrate deploy` trước khi start API (entrypoint hoặc pre-deploy command).
- Seed idempotent bằng `upsert`; dữ liệu mẫu gồm Product (>= 100), size S/M/L, topping, promotion.
- Khóa row dùng `SELECT ... FOR UPDATE` cho `Order`, `Product`, `Promotion`.
- Ràng buộc quan trọng: `Payment @@unique(userId, orderId, idempotencyKey)`, `LoyaltyTransaction @@unique(orderId, type)`, `Promotion.code @unique`, `Order.orderCode @unique`.
- Migration **forward-only**; rollback code bằng image cũ, rollback dữ liệu bằng backup/restore.

## Hệ quả

**Tích cực**

- Type-safe, migration có version, dễ seed và test.
- Hỗ trợ transaction, unique, index và raw SQL khi cần `FOR UPDATE`.
- PostgreSQL đúng yêu cầu Task 1; chạy được bằng Docker Compose.

**Tiêu cực**

- Migration lúc container start có thể chạy đồng thời nếu scale nhiều instance.
- Không tự động down migration; rollback dữ liệu phụ thuộc backup.
- Prisma thêm generated client vào image; cần `prisma generate` trong build.

**Giảm thiểu**

- MVP chạy **một instance API**; khi scale, chuyển migration sang release job/pre-deploy riêng.
- Backup trước migration production; ghi rõ RPO/RTO thực tế của gói Render.
- Kiểm tra migration trên DB sạch và DB có dữ liệu trước khi deploy.
