# ADR-010: Tích hợp VNPay Sandbox cho thanh toán

- **Trạng thái**: Proposed
- **Ngày**: 2026-11-09
- **Liên quan**: FR-06, FR-08, FR-10, NFR-05, RSK-02, RSK-03, ADR-005

> **Cập nhật hiện thực 2026-11-14:** Theo phạm vi demo đã chốt, đã thêm **VNPay Sandbox Return-only**, giữ mock, chưa triển khai IPN/tunnel/querydr/refund API. Xem [hướng dẫn hiện hành](../../vnpay-sandbox.md). Các phần Return + IPN bên dưới vẫn là thiết kế mở rộng, không phải mô tả toàn bộ code đang chạy. `PaymentsController` hiện đã có JWT guard và kiểm tra quyền sở hữu đơn; Return đặt ở controller public riêng, xác thực bằng chữ ký. Schema dùng `INITIATED/PAID/FAILED` hiện có, thêm `expiresAt` và `refundRequired`, chưa thêm enum `EXPIRED/CANCELLED` cho Payment.

## Bối cảnh

Hiện tại BrewLite thanh toán bằng mock ngay trong `PaymentsService`:

- `POST /payments` tạo `Payment` và trả kết quả `PAID`/`FAILED` ngay lập tức.
- Đơn hàng đi thẳng `PENDING -> PAID` hoặc `PENDING -> PAYMENT_FAILED`.
- Idempotency dựa trên unique `(userId, orderId, idempotencyKey)`.
- Chưa có cổng thanh toán thật, chưa có callback/webhook.

VNPay Sandbox là luồng **bất đồng bộ**:

1. Backend tạo URL thanh toán và redirect trình duyệt sang VNPay.
2. Khách nhập thẻ/QR/OTP trên trang VNPay.
3. VNPay redirect khách về `vnp_ReturnUrl`.
4. VNPay gọi server-to-server tới IPN URL để xác nhận kết quả.

Vì vậy không thể chỉ "đổi provider mock thành VNPay" trong một hàm. Cần thêm trạng thái chờ thanh toán, callback có xác thực chữ ký, xử lý callback lặp và xử lý callback đến muộn.

## Các lựa chọn đã cân nhắc

1. **Chỉ dùng Return URL** – đơn giản, demo được thành công/thất bại, nhưng không đáng tin: khách đóng trình duyệt trước khi redirect thì server không biết kết quả; không chứng minh được xử lý webhook.
2. **Return URL + IPN, dùng VNPay làm cổng duy nhất** – đúng chuẩn sandbox, cần URL công khai HTTPS cho IPN.
3. **Return URL + IPN, giữ mock làm fallback** – đúng chuẩn nhưng vẫn demo offline/test được. Chọn phương án này.
4. **Tách hẳn payment service/container riêng** – quá mức với đồ án monolith.

## Quyết định

Chọn **phương án 3**: thêm adapter VNPay Sandbox vào module `payments`, giữ `PAYMENT_PROVIDER=mock|vnpay` để chọn cổng.

### Nguyên tắc

- **Không lưu dữ liệu thẻ.** Khách nhập thẻ trên trang VNPay; BrewLite chỉ nhận mã giao dịch.
- **IPN là nguồn sự thật** để chốt thanh toán. Return URL chỉ để hiển thị kết quả và cũng đi qua cùng hàm xác nhận idempotent.
- **Xác thực chữ ký trước mọi xử lý**: HMAC-SHA512 trên chuỗi tham số đã sắp xếp, dùng `vnp_HashSecret`.
- **Mọi chuyển trạng thái đơn vẫn đi qua `OrderStateMachine.assertTransition`** (FR-08).
- **Idempotency hiện có được giữ nguyên**: một `Idempotency-Key` tương ứng một lần thử thanh toán; gửi lại cùng key trả lại đúng payment/URL cũ, không tạo giao dịch mới.
- **Không tin dữ liệu client**: luôn kiểm tra `vnp_TmnCode`, `vnp_Amount`, trạng thái payment và quyền sở hữu đơn.

### Luồng chuẩn

```text
Web                         API                         VNPay
 |  POST /orders             |                            |
 |-------------------------->|                            |
 |  POST /payments           |                            |
 |  Idempotency-Key          | tạo Payment(INITIATED)     |
 |-------------------------->| build URL + ký HMAC-SHA512 |
 |  { paymentUrl }           |                            |
 |<--------------------------|                            |
 |  redirect paymentUrl --------------------------------->|
 |                                                       | khách thanh toán
 |<---------------- vnp_ReturnUrl (GET có chữ ký) -------|
 |                         xác thực chữ ký               |
 |                         cập nhật idempotent           |
 |<-- 302 /checkout/result?orderCode=... ----------------|
 |                                                       |
 |                         IPN (GET server-to-server) <--|
 |                         xác thực + cập nhật           |
 |                         {"RspCode":"00",...} --------->|
```

### API dự kiến

| Method | Endpoint | Ghi chú |
| :--- | :--- | :--- |
| `POST` | `/payments` | Giữ nguyên endpoint. Với VNPay trả thêm `paymentUrl`, `requiresRedirect: true`. |
| `GET` | `/payments/config` | Public, trả `{ provider: "mock" \| "vnpay" }` để web biết hiển thị UI nào. |
| `GET` | `/payments/vnpay/return` | Public. Xác thực chữ ký, xác nhận idempotent, 302 về web. |
| `GET` | `/payments/vnpay/ipn` | Public. Trả JSON `{ RspCode, Message }` đúng quy định VNPay. |
| `GET` | `/payments/order/:orderId` | Có JWT. Trả trạng thái payment gần nhất + trạng thái đơn để web polling. |

`POST /payments` cần được bảo vệ bằng `JwtAuthGuard` và kiểm tra đơn thuộc user đang đăng nhập. Hiện controller thanh toán chưa có guard; đây là việc bảo mật cần làm trước khi nối cổng thật.

### Thay đổi dữ liệu

Mở rộng `Payment` (migration mới, forward-only):

```prisma
enum PaymentStatus {
  INITIATED
  PAID
  FAILED
  EXPIRED
  CANCELLED
}

model Payment {
  // ... trường hiện có
  provider         String   @default("mock") @db.VarChar(20)
  providerTxnRef   String?  @unique @db.VarChar(64) // vnp_TxnRef
  paymentUrl       String?  @db.Text
  responseCode     String?  @db.VarChar(10)
  transactionStatus String? @db.VarChar(10)
  bankCode         String?  @db.VarChar(20)
  payDate          DateTime?
  expiresAt        DateTime?
  rawCallback      Json?
}
```

- `providerTxnRef` lấy từ `paymentId` bỏ dấu gạch ngang (32 ký tự alphanumeric), duy nhất và không trùng trong ngày.
- `Payment.status = INITIATED` nghĩa là đang chờ VNPay; `EXPIRED` khi quá `vnp_ExpireDate`; `CANCELLED` khi khách hủy đơn/đổi ý.
- `transactionReference` tiếp tục lưu mã giao dịch VNPay (`vnp_TransactionNo`) để tra cứu/đối soát.
- `rawCallback` chỉ lưu sau khi đã lọc/che dữ liệu nhạy cảm, phục vụ truy vết.

### Biến môi trường

```dotenv
PAYMENT_PROVIDER=vnpay

# Lấy khi đăng ký merchant sandbox tại https://sandbox.vnpayment.vn/devreg/
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_PAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<api-public>/payments/vnpay/return
VNPAY_IPN_URL=https://<api-public>/payments/vnpay/ipn
VNPAY_LOCALE=vn
VNPAY_ORDER_TYPE=other
VNPAY_EXPIRE_MINUTES=15

# Lazy expiry đơn chưa thanh toán (áp dụng cho cả mock hiện tại), tính từ Order.createdAt
ORDER_PAYMENT_TIMEOUT_SECONDS=900

# Dùng để redirect về web sau khi xử lý Return URL
WEB_BASE_URL=http://localhost:3001
```

- `validateEnv` phải **fail-fast** nếu `PAYMENT_PROVIDER=vnpay` mà thiếu `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET`/`VNPAY_RETURN_URL`.
- IPN bắt buộc URL public HTTPS. Khi dev local, dùng `cloudflared tunnel` hoặc `ngrok`, rồi khai báo URL đó trong merchant sandbox.
- Bật `trust proxy` để lấy đúng IP khách cho `vnp_IpAddr` khi chạy sau reverse proxy.

### Xử lý các ca khó

| Ca | Cách xử lý |
| :--- | :--- |
| Callback sai chữ ký | IPN trả `97`; Return redirect về trang lỗi. Không cập nhật DB. |
| Không tìm thấy `vnp_TxnRef` | IPN trả `01`. |
| `vnp_Amount` khác số tiền đã lưu | IPN trả `04`, ghi log cảnh báo. |
| IPN gửi lặp | Nếu đã chốt cùng kết quả, trả `02` (VNPay dừng retry). |
| Return đến trước IPN | Return và IPN dùng chung hàm `confirmPayment` idempotent; bên nào đến trước cũng đúng, bên sau trả `02`. |
| Khách đóng trình duyệt, không quay về | IPN vẫn cập nhật đơn. |
| IPN đến sau khi đơn đã `PAID` | Trả `02`, không cộng điểm lần hai. |
| IPN thành công đến sau khi khách đã hủy đơn | Đánh dấu `Payment = PAID`, giữ đơn `CANCELLED` (không phá state machine), ghi log `VNPAY_LATE_SUCCESS` + cờ cần hoàn tiền để nhân viên xử lý. Không tự đổi đơn sang `PAID`. |
| Hết hạn thanh toán (mặc định 15 phút) | **Lazy expiry**, không dùng cron/scheduler: khi `GET /orders/:id`, `GET /orders/me`, `POST /payments` hoặc `PATCH /orders/:id/status` chạm đơn `PENDING`/`PAYMENT_FAILED` quá `createdAt + ORDER_PAYMENT_TIMEOUT_SECONDS`, hệ thống `updateMany` có điều kiện chuyển đơn sang `CANCELLED` với `cancelReason = SYSTEM_EXPIRED`, hoàn kho + nguyên liệu đúng một lần. `POST /payments` sau deadline trả `409`. |
| Thanh toán thất bại tại VNPay | Payment `FAILED`, đơn `PENDING -> PAYMENT_FAILED`; khách thử lại bằng key mới, đơn quay lại `PENDING` như luồng hiện tại. |
| Gửi lại cùng `Idempotency-Key` | Trả lại đúng `Payment` + `paymentUrl` đã lưu; không gọi VNPay lần nữa. |
| Hai request đồng thời cùng key | Unique key + bắt `P2002`/`409` như hiện tại, trả kết quả của request thắng. |

### Frontend

- Thêm lựa chọn **VNPay (ATM/Visa/Mastercard/QR)**; với chế độ VNPay thì **bỏ form nhập thẻ và QR giả lập** vì VNPay đảm nhận.
- Sau khi tạo đơn và nhận `paymentUrl`, dùng `window.location.assign(paymentUrl)` (redirect toàn trang, không `fetch`).
- Lưu `orderId`, `orderCode` vào `sessionStorage` trước khi rời trang để trang kết quả còn dữ liệu.
- Trang `/checkout/result` (hoặc `/checkout/vnpay-return`):
  - Đọc `orderCode`/`orderId` trên URL.
  - Gọi `GET /payments/order/:orderId` để lấy trạng thái thật, không tin query string.
  - `PAID`: xóa giỏ hàng, hiện thành công + điểm thưởng.
  - `FAILED`/`EXPIRED`: hiện thất bại, cho thử lại hoặc hủy đơn.
  - `INITIATED`: hiện "đang xác minh", polling 2 giây/lần tối đa ~30 giây rồi hướng dẫn chờ.
- Trang Return không tự cộng điểm: điểm do backend cộng sau khi chốt `PAID`, idempotent theo `orderId`.

### Các file dự kiến thay đổi

| Khu vực | File |
| :--- | :--- |
| DB | `apps/api/prisma/schema.prisma`, migration mới |
| VNPay adapter | `apps/api/src/payments/vnpay/vnpay.service.ts` (build URL, ký, verify) |
| Callback | `apps/api/src/payments/vnpay/vnpay.controller.ts` (`return`, `ipn`) |
| Nghiệp vụ | `apps/api/src/payments/payments.service.ts`, `payments.controller.ts` |
| DTO | `apps/api/src/payments/dto/*.ts` |
| Config | `apps/api/src/config/env.validation.ts`, `apps/api/.env.example` |
| Web | `apps/web/components/checkout-view.tsx`, `checkout/payment-methods.tsx`, `lib/api.ts`, `lib/types.ts`, `app/checkout/result/page.tsx` |
| Test | `payments/vnpay.service.spec.ts`, `payments/payments.vnpay.e2e.spec.ts` |
| Tài liệu | ADR này, `README.md`, `docs/deployment.md` |

## Kế hoạch triển khai

### Phase 0 – Chuẩn bị (0,5 ngày)

- [ ] Đăng ký VNPay Sandbox merchant, lấy `vnp_TmnCode` + `vnp_HashSecret`.
- [ ] Chạy `cloudflared tunnel --url http://localhost:3000`, khai báo Return URL + IPN URL trong merchant sandbox.
- [ ] Chốt phạm vi: chỉ thanh toán + IPN + hoàn tiền thủ công; **không** làm refund API, querydr, trả góp.

### Phase 1 – Nền tảng VNPay (0,5–1 ngày)

- [ ] Viết `VnpayService`:
  - [ ] `buildPaymentUrl(input)` sắp xếp tham số, `encodeURIComponent`, ký HMAC-SHA512.
  - [ ] `verifySignature(query)` loại `vnp_SecureHash`/`vnp_SecureHashType`, sắp xếp lại, so sánh timing-safe.
  - [ ] Format `vnp_CreateDate`/`vnp_ExpireDate` theo GMT+7; amount = `Math.round(total * 100)` và từ chối nếu không phải số nguyên VND.
  - [ ] `vnp_OrderInfo` bỏ dấu tiếng Việt, cắt ≤ 255 ký tự.
- [ ] Unit test vector ký/verify, tamper amount, sai secret, thiếu tham số.

### Phase 2 – DB + API khởi tạo (1 ngày)

- [ ] Migration thêm trường/enum mới; cập nhật seed/test nếu cần.
- [ ] `POST /payments` nhánh VNPay:
  - [ ] Tạo `Payment(INITIATED)` với `providerTxnRef` trước khi redirect.
  - [ ] Lưu `paymentUrl`, `expiresAt`.
  - [ ] Trả `{ payment, orderStatus, reused, requiresRedirect, paymentUrl }`.
  - [ ] Cùng `Idempotency-Key` trả lại URL cũ; key mới cho lượt mới.
- [ ] Thêm `@UseGuards(JwtAuthGuard)` + kiểm tra `order.userId === currentUser.userId`.
- [ ] `GET /payments/config`, `GET /payments/order/:orderId`.
- [ ] Test service: pending/failed/paid/cancelled, idempotency, race.

### Phase 3 – Return URL + IPN (1–1,5 ngày)

- [ ] `GET /payments/vnpay/return`: verify → `confirmPayment` → 302 về `WEB_BASE_URL/checkout/result?orderCode=...`.
- [ ] `GET /payments/vnpay/ipn`: verify → kiểm tra tmnCode/amount/txnRef → `confirmPayment` → trả `RspCode` đúng bảng.
- [ ] `confirmPayment` idempotent:
  - [ ] Thành công: Payment `PAID`, Order `PENDING -> PAID`, cộng điểm sau commit.
  - [ ] Thất bại: Payment `FAILED`, Order `PENDING -> PAYMENT_FAILED`.
  - [ ] Đã chốt: trả `02`; log nếu kết quả xung đột.
  - [ ] Đơn `CANCELLED` + thành công muộn: đánh dấu cần hoàn tiền, không đổi đơn.
- [ ] Test IPN: chữ ký sai, amount sai, txnRef lạ, lặp, đến muộn, đơn đã hủy.

### Phase 4 – Frontend (0,5–1 ngày)

- [ ] `GET /payments/config` để chọn UI mock/VNPay.
- [ ] Nút thanh toán VNPay → redirect; lưu state vào `sessionStorage`.
- [ ] Trang kết quả + polling trạng thái; xóa giỏ hàng khi `PAID`.
- [ ] Hiển thị lỗi theo `vnp_ResponseCode` (bảng mã rút gọn) và nút thử lại/hủy đơn.
- [ ] Ẩn form thẻ/QR giả lập khi provider = VNPay.

### Phase 5 – Kiểm thử end-to-end + tài liệu (1 ngày)

- [ ] Sandbox thẻ test NCB: `9704198526191432198`, tên `NGUYEN VAN A`, phát hành `07/15`, OTP `123456` (kiểm tra lại theo tài liệu demo hiện hành).
- [ ] Kịch bản:
  - [ ] Thành công: đơn `PAID`, payment `PAID`, điểm cộng đúng một lần.
  - [ ] Khách hủy trên VNPay: `PAYMENT_FAILED`, thử lại thành công.
  - [ ] Đóng trình duyệt sau khi trả tiền: IPN vẫn chốt đơn.
  - [ ] Gửi lặp IPN: không cộng điểm lần hai.
  - [ ] Sửa `vnp_Amount`/chữ ký: bị từ chối.
  - [ ] Hết hạn thanh toán: đơn `PENDING`/`PAYMENT_FAILED` quá hạn bị lazy expiry → `CANCELLED` (`SYSTEM_EXPIRED`), hoàn kho một lần; `POST /payments` trả `409`.
- [ ] Cập nhật README, `.env.example`, deployment checklist, traceability matrix.
- [ ] Ghi chú cách demo với thầy: URL tunnel, thẻ test, các trường hợp thành công/thất bại.

## Hệ quả

**Tích cực**

- Đáp ứng yêu cầu tích hợp cổng thanh toán thật ở mức sandbox.
- Chứng minh được xác thực callback, idempotency, xử lý bất đồng bộ và nhất quán trạng thái.
- Không lưu dữ liệu thẻ, giảm phạm vi PCI.
- Giữ mock để test offline và demo khi mạng/VNPay lỗi.

**Tiêu cực / rủi ro**

- Phức tạp hơn mock: cần URL public, IPN, trạng thái chờ, xử lý callback lặp/muộn.
- Có thêm migration và cấu hình môi trường.
- Sandbox có thể chậm/không ổn định; cần mock fallback.
- Trường hợp thanh toán thành công muộn sau khi hủy đơn cần quy trình hoàn tiền thủ công.
- Nếu chỉ demo trên localhost, IPN không hoạt động; phải dùng tunnel hoặc deploy.

**Giảm thiểu**

- Bắt đầu bằng Phase 1–2 để có URL thanh toán chạy được, sau đó mới làm callback.
- Dùng chung `confirmPayment` cho Return và IPN, test kỹ tính idempotent.
- Log có `paymentId`, `orderCode`, `vnp_TxnRef`, `RspCode`; không log secret/hash.
- Giữ `PAYMENT_PROVIDER=mock` trong CI và test tự động.

## Ước lượng

| Phạm vi | Thời gian |
| :--- | :--- |
| Chỉ happy path, chỉ Return URL, chưa IPN | 1–1,5 ngày |
| Đúng chuẩn sandbox: Return + IPN + idempotency + test + tài liệu | 3–4 ngày làm việc |
| Nếu vừa học vừa làm | 5–7 ngày |
| Thêm refund/querydr/đối soát tự động | +2–3 ngày |

**Kết luận**: không quá khó về mặt code, nhưng khó hơn mock ở phần **luồng bất đồng bộ và callback công khai**. Với đồ án, mức nên làm là Return URL + IPN + xác thực chữ ký + idempotency; chưa cần refund tự động.

## Tiêu chí hoàn thành

- [ ] Thanh toán sandbox thành công từ web, đơn chuyển `PAID`, điểm cộng đúng một lần.
- [ ] Thanh toán thất bại/hủy chuyển `PAYMENT_FAILED`, thử lại được.
- [ ] IPN đến khi trình duyệt đã đóng vẫn cập nhật đơn.
- [ ] Callback sai chữ ký/sai amount bị từ chối và có log.
- [ ] Gửi lặp cùng `Idempotency-Key` hoặc lặp IPN không tạo giao dịch/điểm trùng.
- [ ] `PAYMENT_PROVIDER=mock` vẫn chạy toàn bộ test cũ.
- [ ] README + `.env.example` + ADR được cập nhật.

## Liên kết

- [ADR-005](./005-mock-payment-adapter.md)
- [Use case thanh toán](../../requirements/use-case-checkout.md)
- [SRS – FR-06/FR-08/FR-10](../../requirements/srs.md)
- [Kiến trúc thanh toán](../architecture.md)
- VNPay Sandbox: <https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html>
- Đăng ký sandbox: <https://sandbox.vnpayment.vn/devreg/>
