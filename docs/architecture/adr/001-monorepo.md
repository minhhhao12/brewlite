# ADR-001: Monorepo với pnpm workspaces

- **Trạng thái**: Accepted – thiết kế; hiện thực ở Task 4.1
- **Ngày**: 2026-10-19
- **Liên quan**: NFR-04, ADR-006

## Bối cảnh

BrewLite gồm frontend Next.js, backend NestJS và toàn bộ tài liệu Task 1–5. Nhóm nhỏ, thời gian ngắn, cần một pipeline CI duy nhất và tránh lệch phiên bản giữa web/API. Repository hiện đã có `docs/` và cấu trúc đích `apps/web`, `apps/api`.

## Các lựa chọn đã cân nhắc

1. **Polyrepo**: repository riêng cho web, API và docs.
2. **Monorepo pnpm workspaces**: `apps/web`, `apps/api`, `docs/` trong một repository.
3. **Monorepo có Nx/Turborepo**: thêm cache và task graph.

## Quyết định

Chọn phương án **2**:

- `pnpm-workspace.yaml` khai báo `apps/*`.
- Root `package.json` giữ các script `lint`, `test`, `build`, `prisma:generate` để CI chạy một lần cho toàn repo.
- Dockerfile của từng app copy đúng workspace/manifest cần thiết.
- Tài liệu Task 1–5 nằm trong `docs/`, được version hóa cùng mã nguồn.

## Hệ quả

**Tích cực**

- Một PR có thể thay đổi xuyên web/API/docs và cập nhật traceability trong cùng commit.
- Một pipeline, một lịch sử commit, một nơi cấu hình format/lint.
- Dễ clone và chạy `docker compose up` cho cả hệ thống.

**Tiêu cực**

- Mọi thay đổi đều checkout cả repo; CI có thể chạy nhiều việc không liên quan nếu không lọc theo path.
- Dễ tạo phụ thuộc chéo giữa `apps/web` và `apps/api`; cần review ranh giới.
- Docker context lớn hơn; cần `.dockerignore` đúng.

**Giảm thiểu**

- Chưa thêm Nx/Turborepo; chỉ thêm khi build chậm thực sự.
- Không import code giữa web và API; chia sẻ contract qua REST/JSON, không qua package nội bộ.
- CI có thể lọc path ở Task 4.4 nếu cần.
