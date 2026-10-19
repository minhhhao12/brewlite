# ADR-005: PaymentGateway port + MockPaymentGateway adapter

- **Trạng thái**: Accepted – thiết kế; hiện thực Task 5
- **Ngày**: 2026-10-19
- **Liên quan**: FR-06, FR-08, FR-10, NFR-05, RSK-02, RSK-03

## Bối cảnh

Đồ án không có merchant account/secret thật, nhưng cần demo end-to-end thành công/thất bại và chứng minh idempotency, transaction, trạng thái đơn. Task 2 đã mô tả `PaymentGateway` trong class diagram và "Mock Gateway" trong sequence diagram.

## Các lựa chọn đã cân nhắc

1. **Port `PaymentGateway` + adapter `MockPaymentGateway` trong NestJS**, chọn qua DI token.
2. Mock trực tiếp trong `PaymentsService`/`OrdersService`.
3. Tách mock payment thành service/container riêng.
4. Tích hợp gateway sandbox thật (MoMo/VNPay/Stripe).

## Quyết định

Chọn phương án **1**:

- Interface `PaymentGateway` gồm `createPayment(orderId, amount, method)` và `verifyResult(transactionReference?, idempotencyKey)`; `verifyCallback(rawBody, signature)` dành cho Extended/webhook. Nếu timeout trước khi có reference, job đối soát dùng key.
- `MockPaymentGateway` chạy **trong process** API; cấu hình delay/tỷ lệ lỗi; trả `transactionReference` dạng `mock_<orderId>_<uuid>`.
- `PaymentsModule` bind `PAYMENT_PROVIDER` → `MockPaymentGateway`.
- Gateway chỉ được gọi **sau khi** reservation `Payment = PROCESSING` đã commit (FR-06).
- Timeout chưa xác minh: giữ `PROCESSING`, đơn `PENDING`; `PaymentReconciliationJob` dùng `verifyResult` để chốt `PAID`/`FAILED`/`EXPIRED`.
- Gateway thật sau này chỉ cần implement lại interface, không đổi controller/order flow.

## Hệ quả

**Tích cực**

- Không rủi ro tiền thật, không lưu dữ liệu thẻ.
- Dễ test success/failure/timeout bằng cấu hình.
- Ranh giới rõ để thay gateway thật; không thêm service mạng trong MVP.
- Hỗ trợ đúng các trạng thái `PaymentStatus` đã đặc tả.

**Tiêu cực**

- Không mô phỏng đầy đủ webhook, chữ ký, độ trễ mạng thật.
- `verifyResult`/job đối soát là đường phức tạp, cần test kỹ.
- Nếu gateway thật có API khác, có thể phải mở rộng interface.

**Điều kiện khi tích hợp thật**

- Xác thực callback bằng HMAC-SHA256 + timestamp + chống replay.
- Không log dữ liệu nhạy cảm; secret ở dashboard.
- Callback hợp lệ vẫn phải đi qua `assertTransition` của FR-08.
