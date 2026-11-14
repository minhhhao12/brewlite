# VNPay Sandbox — demo Return URL, chưa có IPN

## Phạm vi và giới hạn

- Giữ `PAYMENT_PROVIDER=mock` để test/demo offline; dùng `vnpay` để chuyển sang sandbox.
- Không thêm dependency VNPay; ký HMAC-SHA512 bằng Node `crypto`.
- **Chưa có IPN, querydr, refund API hay ngrok.** Đây không phải tích hợp sẵn sàng nhận tiền thật.
- Khách nhập thẻ/OTP trên VNPay, không nhập hoặc lưu dữ liệu thẻ tại BrewLite.
- Backend chỉ cập nhật khi **trình duyệt quay về Return URL có chữ ký hợp lệ**.
- Nếu đóng tab/mất mạng trước khi quay về, payment vẫn `INITIATED` (chưa rõ kết quả), không tự coi là thất bại.
- Đơn quá hạn vẫn tự hủy theo lazy expiry và hoàn kho. Thanh toán thành công quay về sau khi đơn đã hủy được lưu `PAID`, `refundRequired=true`; không hồi sinh đơn, không cộng điểm. Nhân viên đối soát/hoàn tiền thủ công.

## 1. Merchant và cấu hình

Đăng ký merchant sandbox theo hướng dẫn VNPay:
<https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html>.

Điền **thông tin được cấp**, không dùng thông tin thẻ test làm TmnCode/HashSecret:

```dotenv
PAYMENT_PROVIDER=vnpay
VNPAY_TMN_CODE=YOURCODE
VNPAY_HASH_SECRET=your-issued-secret
VNPAY_PAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payments/vnpay/return
WEB_BASE_URL=http://localhost:3001
ORDER_PAYMENT_TIMEOUT_SECONDS=900
```

- Docker: đặt trong `.env` ở thư mục gốc. Compose truyền các biến vào API.
- pnpm: đặt trong `apps/api/.env` (hoặc `.env` gốc nếu không bị file API ghi đè). Không copy đè file `.env` đang có.
- Không commit `.env`, không đưa secret vào `NEXT_PUBLIC_*`, không chia sẻ URL thanh toán/Return đầy đủ trong log công khai.
- Nếu đổi cổng, cập nhật Return URL và Web URL tương ứng. Dùng cùng hostname `localhost` cho web trước và sau thanh toán để giữ phiên đăng nhập.
- Return URL phải được merchant sandbox chấp nhận. Localhost hoạt động qua trình duyệt trên chính máy đang chạy app; không dùng được để demo trên điện thoại/máy khác bằng chính URL localhost.
- Không khai báo IPN giả. Nếu merchant bắt buộc yêu cầu IPN, cần trao đổi với VNPay/điều chỉnh phạm vi; ứng dụng hiện không cung cấp endpoint này.
- API kiểm tra cấu hình khi khởi động, từ chối secret rỗng/giá trị mẫu và cổng thanh toán ngoài sandbox.

## 2. Chạy bằng Docker Compose

Bật Docker Desktop/OrbStack trước:

```bash
docker compose up -d --build
docker compose logs -f api
```

Toàn bộ dependency vẫn được cài **trong image**, không cài lên máy host.
API tự generate Prisma Client, chạy migration mới và seed khi khởi động. Không cần reset database hay xóa volume.
Sau khi chỉ đổi `.env`, chạy `docker compose up -d --force-recreate api` để container nhận biến mới.

Kiểm tra provider (không có secret trong response):

```bash
curl http://localhost:3000/payments/config
```

Kết quả mong đợi: `{"provider":"vnpay"}`.

## 3. Máy khác chạy bằng pnpm

Máy chọn cách này cần Node/pnpm và dependency như hướng dẫn chính trong README:

```bash
pnpm install --frozen-lockfile
docker compose up -d db
pnpm prisma:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:api
# Terminal khác:
pnpm dev:web
```

Điền cấu hình sandbox trong `apps/api/.env`, và API URL trong `apps/web/.env.local`.
Không chạy đồng thời API/Web bằng pnpm và container trên cùng cổng.

## 4. Thử thanh toán

1. Mở <http://localhost:3001>, đăng nhập bằng tài khoản khách hàng.
2. Thêm món còn hàng, tới checkout. Phải thấy **VNPay Sandbox**, không thấy form thẻ hoặc QR giả lập.
3. Xác nhận đơn. Payment được lưu `INITIATED`, đơn vẫn `PENDING`.
4. Trình duyệt chuyển sang VNPay; chọn ngân hàng NCB và nhập thẻ **sandbox**:

| Trường | Giá trị test |
| :--- | :--- |
| Ngân hàng | NCB |
| Số thẻ | `9704198526191432198` |
| Chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| OTP | `123456` |

Thông tin thẻ test do VNPay cung cấp; nếu bị từ chối, kiểm tra lại bộ thẻ test hiện hành.
Không dùng thẻ/tiền thật.

5. Hoàn tất và **đợi VNPay chuyển về BrewLite**.
6. Trang `/checkout/result` gọi API có JWT để đọc kết quả đã lưu:
   - Thành công: payment/đơn `PAID`, điểm thưởng được cộng một lần.
   - Hủy/thất bại đã xác minh: payment `FAILED`, đơn `PAYMENT_FAILED`; có nút thử lại cho **cùng đơn** bằng lượt mới.
   - Chưa nhận Return: hiển thị chưa xác nhận, không kết luận thất bại. Có thể tiếp tục URL cũ khi còn hạn.
   - Đơn đã hủy nhưng thanh toán thành công: cảnh báo cần đối soát, không thanh toán lại.

Mỗi lần thử có mã `vnp_TxnRef` riêng; gửi lại cùng Idempotency-Key trả payment/URL cũ.
Một đơn có lượt `INITIATED` chưa rõ kết quả không được tạo lượt thanh toán thứ hai.
Không đổi provider khi đang có giao dịch chưa hoàn tất.

Giỏ hàng chỉ được xóa sau xác nhận thành công và khi khớp snapshot trước khi chuyển VNPay, không xóa giỏ mới được sửa ở tab khác.

## 5. Kiểm thử

Trong container đã có dependency:

```bash
docker compose exec -e PAYMENT_PROVIDER=mock api pnpm --filter @brewlite/api test --runInBand
docker compose exec api pnpm --filter @brewlite/api build
docker compose exec web pnpm --filter @brewlite/web typecheck
docker compose exec web pnpm --filter @brewlite/web lint
```

Smoke test ký/verify, ngày GMT+7 và cấu hình **không cần cài dependency**, dùng Node >=22.13:

```bash
node --test tests/vnpay-protocol.test.mjs
```

Các test Nest/Jest bổ sung nằm trong `apps/api/src/payments/vnpay/`.
Kiểm tra thủ công thêm: hủy tại VNPay, reload Return URL, sửa amount/chữ ký, đóng tab, hết hạn đơn và thanh toán quay về sau khi hủy.

## 6. Đối soát trường hợp muộn

Nhân viên có thể kiểm tra các payment `refundRequired` trong PostgreSQL/Prisma Studio.
Ví dụ truy vấn đọc bằng user/database local mặc định:

```bash
docker compose exec db psql -U brewlite -d brewlite -c \
  'SELECT "paymentId", "orderId", "amount", "transactionReference", "payDate" FROM "Payment" WHERE "refundRequired" = true;'
```

Không cập nhật đơn `CANCELLED` về `PAID` để “sửa” tình huống này: kho đã được hoàn.
Nếu khách báo đã thanh toán nhưng không có Return hợp lệ, cần tra cứu trên sandbox merchant; BrewLite chưa có API truy vấn tự động.
