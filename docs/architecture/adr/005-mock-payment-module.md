# ADR-005: Thanh toán mô phỏng trong module Payments

- **Trạng thái**: Accepted (interface + mock đã có; flow thanh toán TODO Sprint 2)
- **Ngày**: 2026-10-19
## Bối cảnh
Đồ án không có merchant account/secret thật, nhưng cần demo end-to-end success/failure và chứng minh idempotency, transaction, trạng thái đơn.

## Các lựa chọn đã cân nhắc
1. `PaymentProvider` interface + `MockPaymentProvider` trong NestJS, chọn qua DI token.
2. Mock trực tiếp trong `PaymentsService`/`OrdersService`.
3. Tách mock payment thành service/container riêng.
4. Tích hợp gateway sandbox thật (MoMo/VNPay/Stripe).

## Quyết định
Chọn phương án 1. Interface có `createPayment` và `verifyResult`; `PaymentsModule` bind `PAYMENT_PROVIDER` → `MockPaymentProvider`. Provider thật sau này chỉ cần implement lại interface.

## Hệ quả
- **Tích cực**: không rủi ro tiền thật, không lưu dữ liệu thẻ; dễ test success/failure; thay provider không đổi controller/order flow; không thêm service mạng.
- **Tiêu cực**: không mô phỏng đầy đủ webhook, chữ ký, timeout thực; `verifyResult` hiện quá đơn giản; flow `POST /payments` chưa code.
- **Điều kiện**: khi tích hợp thật phải thêm xác thực callback, đối soát, secret riêng và không log dữ liệu nhạy cảm.
