# ADR-003: Next.js App Router + PWA mức cơ bản

- **Trạng thái**: Accepted (skeleton đã áp dụng)
- **Ngày**: 2026-10-19
## Bối cảnh
Khách hàng dùng điện thoại, cần mở nhanh, không cài app store. SRS yêu cầu mobile-first/PWA tối thiểu: manifest, theme color, icon, trải nghiệm gần app.

## Các lựa chọn đã cân nhắc
1. Next.js App Router + manifest metadata route + service worker viết tay.
2. Next.js + plugin `next-pwa`/Workbox.
3. SPA Vite + PWA plugin.
4. Native app.

## Quyết định
Chọn phương án 1. Dùng `apps/web/app/manifest.ts`, `apps/web/public/sw.js`, `offline.html`, đăng ký SW ở production. Không thêm dependency PWA/workbox.

## Hệ quả
- **Tích cực**: ít dependency, dễ hiểu, Next.js tối ưu build/deploy Vercel; kiểm soát cache rõ ràng.
- **Tiêu cực**: cache thủ công dễ serve asset cũ; không có offline mutation, background sync, push; install prompt không đồng nhất giữa trình duyệt.
- **Giảm thiểu**: tăng `CACHE_NAME` mỗi lần đổi app shell; chỉ cache asset same-origin; test lại sau deploy.
