# ADR-009: State frontend và lớp gọi API

- **Trạng thái**: Accepted – thiết kế; hiện thực Task 4–5
- **Ngày**: 2026-10-19
- **Liên quan**: FR-02, FR-03, FR-04, FR-06, FR-07, NFR-03

## Bối cảnh

Giỏ hàng là state client (FR-03), cần persist qua refresh. Dữ liệu menu/đơn là server state. SRS gợi ý Zustand hoặc React Query. Client cần gắn JWT, xử lý lỗi và idempotency key khi thanh toán.

## Các lựa chọn đã cân nhắc

1. **Zustand + `persist` cho cart; fetch wrapper cho server state**.
2. React Query cho toàn bộ server state + Context cho cart.
3. Redux Toolkit cho cả hai.
4. Chỉ dùng React state, không persist.

## Quyết định

Chọn phương án **1**:

- `useCartStore` (Zustand + `persist`) lưu `{productId, size, toppingIds, qty}` và preview; không lưu total có thẩm quyền.
- `lib/api.ts` là fetch wrapper: base URL `NEXT_PUBLIC_API_URL`, gắn `Authorization: Bearer`, parse lỗi thống nhất, xử lý `401` → login và `409` → "đang xác minh".
- Server state dùng fetch + loading/error state; có thể bổ sung React Query sau nếu cần cache.
- Idempotency key do component thanh toán sinh; giữ nguyên khi retry cùng lần thử, sinh mới sau `PAYMENT_FAILED`.
- JWT lưu bộ nhớ + `sessionStorage`; cart persist localStorage.

## Hệ quả

**Tích cực**

- Cart nhẹ, persist dễ, phù hợp mobile-first.
- Server state không bị trộn với cart; ít dependency.
- Một nơi xử lý base URL, JWT và lỗi API.
- Dễ test cart logic và API wrapper độc lập.

**Tiêu cực**

- Tự quản lý loading/error/cache cho server state; dễ lặp code fetch.
- localStorage có thể chứa dữ liệu nhạy cảm nếu lưu token; vì vậy token không đặt ở đây.
- React Query sẽ giải quyết cache tốt hơn nếu màn hình phức tạp.

**Quy tắc**

- Server luôn tính lại giá/total; client không gửi total có thẩm quyền.
- Không cache response API chứa dữ liệu cá nhân trong service worker.
- Khi đổi `NEXT_PUBLIC_API_URL`, phải rebuild web vì biến được inline lúc build.
