# ADR-006: Nền tảng triển khai Vercel + Render + GHCR

- **Trạng thái**: Accepted (kế hoạch; hạ tầng chưa được tạo)
- **Ngày**: 2026-10-19
- **Bối cảnh**: Nhóm cần một môi trường production truy cập được qua HTTPS, có CDN cho Next.js, chạy container NestJS và PostgreSQL có persistent storage, trong khi ngân sách và thời gian của đồ án rất hạn chế.
- **Các lựa chọn đã cân nhắc**:
  1. Vercel (web) + Render Web Service (API Docker) + Render Managed Postgres + GHCR.
  2. Railway cho cả web/API/DB.
  3. VPS tự quản lý (Docker Compose + Nginx + Certbot).
  4. Fly.io cho API và Postgres.
- **Quyết định**: Chọn phương án 1. Next.js deploy trên Vercel; NestJS API đóng gói Docker, push lên GHCR và Render pull image; PostgreSQL dùng Render Managed Postgres. GitHub Actions là CI/CD duy nhất.
- **Hệ quả tích cực**: Không phải quản trị server; HTTPS/CDN có sẵn; Render có managed Postgres và persistent disk; GHCR miễn phí cho public image; pipeline đơn giản, dễ giải thích.
- **Hệ quả tiêu cực**: Phụ thuộc hai nhà cung cấp; cold start và giới hạn tài nguyên ở gói thấp; Render không tự chạy migration nếu không cấu hình; giá/gói free thay đổi, **cần kiểm tra lại trên trang giá chính thức** trước khi chốt.
- **Điều kiện áp dụng**: Cần tạo service Render, database, GHCR package, đặt secret trong dashboard/GitHub Secrets; xem `docs/architecture/deployment.md`.
