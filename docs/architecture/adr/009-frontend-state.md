# ADR-009: State frontend và lớp gọi API

- **Trạng thái**: Accepted (kế hoạch Sprint 1–2; chưa cài dependency)
- **Ngày**: 2026-10-19
## Bối cảnh
Giỏ hàng là state client (FR-03), cần persist qua refresh; dữ liệu menu/đơn là server state. SRS gợi ý Zustand hoặc React Query. Repo hiện chỉ có skeleton UI.

## Các lựa chọn đã cân nhắc
1. Zustand + localStorage cho cart; fetch wrapper cho server state.
2. React Query cho toàn bộ server state + Context cho cart.
3. Redux Toolkit cho cả hai.
4. Chỉ dùng React state, không persist.

## Quyết định
Chọn phương án 1: Zustand + `persist` middleware cho cart; một module `lib/api.ts` dùng `fetch` với base URL `NEXT_PUBLIC_API_URL`, gắn JWT và xử lý lỗi thống nhất. React Query có thể bổ sung sau nếu cần cache server state.

## Hệ quả
- **Tích cực**: cart nhẹ, persist dễ; server state không bị trộn với cart; ít dependency; phù hợp mobile-first.
- **Tiêu cực**: tự quản lý loading/error/cache cho server state; dễ lặp code fetch; localStorage có thể chứa dữ liệu nhạy cảm nếu lưu token.
- **Quy tắc**: không lưu JWT trong localStorage nếu có thể; server luôn tính lại giá/total, không tin total client.
