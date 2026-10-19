# ADR-001: Monorepo với pnpm workspaces

- **Trạng thái**: Accepted (đã áp dụng)
- **Ngày**: 2026-10-19

## Bối cảnh
Web Next.js, API NestJS và tài liệu Task 1–3 cần được version hóa cùng nhau; nhóm nhỏ, thời gian ngắn, cần một pipeline CI duy nhất và tránh lệch version giữa các repo.

## Các lựa chọn đã cân nhắc
1. Polyrepo: repo web, API, docs riêng.
2. Monorepo pnpm workspaces: `apps/web`, `apps/api`, `docs/`.
3. Monorepo dùng Nx/Turborepo để cache build.

## Quyết định
Chọn monorepo pnpm với `pnpm-workspace.yaml` (`apps/*`). Root `package.json` giữ script `lint`, `test`, `build`, `prisma:generate`; CI chạy một lần cho toàn repo.

## Hệ quả
- **Tích cực**: một PR thay đổi xuyên web/API/docs; CI/CD và Docker context thống nhất; dễ trace yêu cầu → code.
- **Tiêu cực**: mọi thay đổi đều checkout cả repo; cần kỷ luật review để tránh phụ thuộc chéo giữa `apps/web` và `apps/api`; Dockerfile phải copy đúng workspace.
- **Chưa làm**: chưa có Nx/Turborepo cache, chưa tách package dùng chung; chỉ thêm khi build chậm thực sự.
