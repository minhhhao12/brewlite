# ADR-004: PostgreSQL + Prisma migration

- **Trạng thái**: Accepted (schema + migration init đã có)
- **Ngày**: 2026-10-19
## Bối cảnh
Cần CSDL quan hệ cho order/payment với transaction, unique constraint và khóa row. SRS chọn PostgreSQL; nhóm cần migration tái tạo được DB ở local và production.

## Các lựa chọn đã cân nhắc
1. PostgreSQL + Prisma (schema, migrate, client type-safe).
2. PostgreSQL + TypeORM.
3. PostgreSQL + Knex/SQL thuần.
4. SQLite cho demo.

## Quyết định
Chọn phương án 1, Prisma **6.19.3**. Schema tại `apps/api/prisma/schema.prisma`; migration SQL commit trong `apps/api/prisma/migrations/`; production chạy `prisma migrate deploy` trong `docker-entrypoint.sh` khi `RUN_MIGRATIONS=true`.

## Hệ quả
- **Tích cực**: type-safe, migration có version, dễ seed, hỗ trợ transaction/unique/index; PostgreSQL đúng yêu cầu.
- **Tiêu cực**: migration lúc container start có thể chạy đồng thời nếu scale nhiều instance; rollback dữ liệu không tự động; Prisma thêm generated client vào image.
- **Giảm thiểu**: MVP chạy một instance; forward-only migration; backup trước deploy; chuyển sang pre-deploy job khi scale.
