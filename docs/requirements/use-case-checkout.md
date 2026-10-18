# Đặc tả Use Case Trọng tâm: Thanh toán Đơn hàng

## 1. Thông tin Use Case
* **Tên Use Case**: Thanh toán đơn hàng
* **Mã định danh**: `UC-08` 
* **Mức độ ưu tiên**: **Must Have** (Chức năng cốt lõi của MVP)
* **Actor chính**: Khách hàng (Customer)
* **Actor hỗ trợ**: Cổng thanh toán (Payment Gateway Service)

---

## 2. Tóm tắt nghiệp vụ
Use case này cho phép khách hàng thực hiện thanh toán trực tuyến không dùng tiền mặt (thông qua Ví điện tử hoặc Thẻ ngân hàng) cho một đơn hàng đã được tạo và đang ở trạng thái chờ thanh toán (`PENDING`). Hệ thống sử dụng cơ chế **Idempotency** (bằng `Idempotency-Key`) để ngăn chặn việc trừ tiền lặp lại khi người dùng bấm nhiều lần hoặc do mạng di động chập chờn. Khi cổng thanh toán xác nhận thành công, đơn hàng được chuyển trạng thái sang **`PAID`** và hiển thị thông tin xác nhận cho khách hàng; nếu thất bại, đơn chuyển sang **`PAYMENT_FAILED`** và cho phép khách hàng thử lại mà không phải tạo lại đơn mới.

---

## 3. Sơ đồ Use Case (Use Case Diagram)

Sơ đồ thể hiện phạm vi Use Case Thanh toán đơn hàng, liên kết với Actor và các Use Case thành phần:

![Sơ đồ Use Case Thanh toán đơn hàng](./use-case-checkout.svg)

---

## 4. Trigger (Sự kiện kích hoạt)
Khách hàng nhấn nút **"Xác nhận thanh toán"** trên màn hình Thanh toán (`/orders/:id/payment`).

---

## 5. Tiền điều kiện (Pre-conditions)
1. Khách hàng đã đăng nhập thành công vào hệ thống và sở hữu JWT Token còn hiệu lực.
2. Đơn hàng cần thanh toán đã tồn tại trong CSDL với trạng thái **`PENDING`**, hoặc **`PAYMENT_FAILED`** (được phép thử lại theo FR-08), thuộc quyền sở hữu của chính khách hàng đăng nhập, và có tổng số tiền hợp lệ ($> 0$).
3. Dịch vụ Cổng thanh toán mô phỏng (Payment Gateway Service) đang hoạt động và có thể tiếp nhận kết nối từ NestJS API.

---

## 6. Hậu điều kiện (Post-conditions)

### 6.1. Trường hợp thành công
* Bản ghi thanh toán (`Payment`) đã được tạo ở trạng thái `PROCESSING` **trước khi** gọi cổng thanh toán (xem bước 5) được cập nhật sang **`PAID`**, lưu: `id`, `userId`, `orderId`, `amount`, `method`, `idempotencyKey`, `transactionReference` và thời gian thanh toán.
* Trạng thái đơn hàng trong bảng `Order` được cập nhật từ `PENDING` $\rightarrow$ **`PAID`**.
* Giỏ hàng đã được làm sạch từ bước tạo đơn (`POST /orders` -> `PENDING`); bước này không dùng giỏ nữa.
* Khách hàng nhận được thông báo giao dịch thành công kèm mã đơn hàng (ví dụ `#1042`), trạng thái `PAID` và lời mời nhận nước tại quầy.

### 6.2. Trường hợp thất bại (đã xác minh)
* Bản ghi `Payment` tương ứng được cập nhật sang **`FAILED`** và trạng thái đơn hàng chuyển sang **`PAYMENT_FAILED`**; kết quả thất bại được lưu theo `idempotencyKey` để lần gọi trùng key trả lại kết quả cũ (không gọi cổng thanh toán lại).
* Chỉ áp dụng khi cổng thanh toán phản hồi lỗi **xác định**, hoặc đối soát xác nhận chưa trừ tiền → chắc chắn không có giao dịch trừ tiền nào được hoàn tất.
* Hệ thống thông báo rõ nguyên nhân thất bại và cung cấp nút **"Thử thanh toán lại"** cho đúng đơn hàng này; lần thử lại dùng `Idempotency-Key` **mới** trên cùng `orderId`, không tạo thêm bản ghi đơn hàng trùng lặp.

### 6.3. Trường hợp timeout / chưa xác minh được (đang đối soát)
* Khi cổng thanh toán **timeout** hoặc trả kết quả không xác định, hệ thống **không kết luận `FAILED` ngay** (tránh trừ tiền 2 lần): bản ghi `Payment` được giữ ở **`PROCESSING`** kèm `expiresAt`, đơn hàng **vẫn `PENDING`**, và API trả `409/202` *"đang xác minh"*.
* Job đối soát nền (qua `verifyResult()` / callback `verifyCallback`, RSK-03) sẽ chốt kết quả:
  * xác nhận **thành công** → `Payment = PAID`, đơn `PENDING -> PAID`;
  * xác nhận **thất bại** → `Payment = FAILED`, đơn `PENDING -> PAYMENT_FAILED`;
  * `Payment` ở `PROCESSING` quá `expiresAt` mà xác nhận **chưa trừ tiền** → `markExpired()` → `Payment = EXPIRED` (đơn vẫn `PENDING`) để khách thử lại bằng key mới.
* Trong lúc còn `PROCESSING` chưa hết hạn, mọi yêu cầu thanh toán mới (kể cả **key khác**) đều bị chặn `409` để bảo đảm một đơn chỉ có tối đa 1 giao dịch đang xử lý.

---

## 7. Luồng sự kiện chính (Main Flow)

| Bước | Hành động của Actor (Khách hàng) | Phản hồi của Hệ thống (BrewLite System) |
| :---: | :--- | :--- |
| **1** | Khách hàng truy cập màn hình Thanh toán của đơn hàng vừa tạo (hoặc từ danh sách đơn chờ thanh toán). | Giao diện Next.js hiển thị thông tin đơn: Mã đơn, tổng số tiền cần trả và danh sách các phương thức thanh toán không tiền mặt (Ví điện tử MoMo/ZaloPay, Thẻ ngân hàng). |
| **2** | Khách hàng chọn phương thức thanh toán mong muốn (ví dụ: *Ví điện tử*). | Giao diện ghi nhận lựa chọn và kích hoạt nút "Xác nhận thanh toán". |
| **3** | Khách hàng nhấn nút **"Xác nhận thanh toán"**. | Client Next.js tự động tạo một mã duy nhất `Idempotency-Key` (chuẩn UUID v4). |
| **4** | | Client Next.js gửi yêu cầu `POST /payments` chứa: `orderId`, `method`, `amount` và header `Idempotency-Key` kèm JWT Bearer Token tới NestJS API. |
| **5** | | NestJS API (Payment Controller & Service):<br>1. Kiểm tra JWT Token và thẩm định dữ liệu đầu vào (`class-validator`).<br>2. Kiểm tra `Idempotency-Key` xem đã tồn tại giao dịch xử lý trước đó chưa.<br>3. Mở transaction và khóa đơn (`SELECT Order ... FOR UPDATE`); kiểm tra đơn thuộc về user hiện tại (ngược lại `403`), `amount == order.totalAmount` (ngược lại `400`), và trạng thái hợp lệ để thanh toán: `PENDING`, hoặc `PAYMENT_FAILED` (khi đó gọi `assertTransition(PAYMENT_FAILED -> PENDING)` — FR-08).<br>4. Nếu còn `Payment` **khác** của đúng `orderId` đang `PROCESSING` chưa hết `expiresAt` → trả `409` (đang xác minh), không tạo giao dịch mới. Ngược lại ghi bản ghi `Payment` trạng thái `PROCESSING` (kèm `expiresAt`) làm mốc idempotency (ràng buộc UNIQUE `(userId, orderId, idempotencyKey)`) **trước khi** gọi cổng thanh toán; nếu trùng UNIQUE do request đồng thời thì đọc lại bản ghi và trả `409`/kết quả đã lưu. |
| **6** | | NestJS API kích hoạt Use Case con **"Xử lý thanh toán online"**: Gọi API dịch vụ Cổng thanh toán mô phỏng (Mock Payment Gateway) để trừ tiền. |
| **7** | | Cổng thanh toán mô phỏng xử lý giao dịch an toàn và phản hồi trạng thái thành công (`SUCCESS`, Transaction ID). |
| **8** | | NestJS API mở Transaction:<br>1. Cập nhật bản ghi `Payment` (`PROCESSING` $\rightarrow$ `PAID`) kèm `transactionReference` từ cổng thanh toán.<br>2. Cập nhật trạng thái đơn hàng từ `PENDING` $\rightarrow$ **`PAID`**.<br>3. Commit transaction và trả về phản hồi HTTP `200 OK` kèm thông tin đơn đã thanh toán. |
| **9** | Khách hàng xem màn hình xác nhận thanh toán thành công và nhận mã lấy nước. | Giao diện Next.js chuyển hướng khách hàng sang màn hình Xác nhận đơn (`/orders/:id/confirmation`), hiển thị mã đơn hàng, trạng thái `PAID` và thông điệp chuẩn bị đồ uống (giỏ hàng đã xóa từ lúc tạo đơn `PENDING`). |

---

## 8. Luồng thay thế (Alternative Flows)

### 8.1. Luồng AF-1: Áp dụng mã khuyến mãi (Extend UC - Áp dụng mã khuyến mãi)
* **Trước bước 1 (lúc tạo đơn):** khách hàng nhập mã giảm giá ở màn hình giỏ hàng; mã được gửi kèm trong `POST /orders` theo FR-09.
* **Hệ thống**: Kiểm tra mã hợp lệ, tính discount vào `order.totalAmount` trước khi tạo `PENDING`.
* Khách hàng thanh toán từ bước 1 với số tiền sau giảm giá; không sửa total khi đơn đã `PENDING`.

### 8.2. Luồng AF-2: Đổi phương thức thanh toán
* **Tại bước 2**: Khách hàng chuyển đổi từ *Ví điện tử* sang *Thẻ ngân hàng*. Hệ thống hiển thị form nhập thông tin thẻ mô phỏng tương ứng mà không làm thay đổi thông tin số tiền của đơn hàng.

---

## 9. Luồng ngoại lệ (Exception Flows)

### 9.1. Luồng EF-1: Phiên đăng nhập hết hạn (401 Unauthorized)
* **Tại bước 4 hoặc 5**: JWT token của khách hàng bị hết hạn hoặc không hợp lệ.
* **Hệ thống**: Trả về mã lỗi HTTP `401 Unauthorized`. Client chuyển hướng người dùng đến trang Đăng nhập và lưu lại `orderId` hiện tại để tự động quay lại thanh toán ngay sau khi đăng nhập thành công.

### 9.2. Luồng EF-2: Đơn hàng không ở trạng thái hợp lệ để thanh toán
* **Tại bước 5**: Đơn hàng đã ở trạng thái `PAID` (đã thanh toán rồi) hoặc `CANCELLED` (đã bị hủy). Riêng `PAYMENT_FAILED` được phép thử lại theo FR-08 (`PAYMENT_FAILED -> PENDING -> PAID`): hệ thống tự gọi `assertTransition(PAYMENT_FAILED -> PENDING)` (FR-08) trước khi thực hiện thanh toán lại, client không cần gọi thêm API nào khác.
* **Hệ thống**: NestJS chặn lại với mã lỗi `400 Bad Request` kèm thông báo: *"Đơn hàng này không còn ở trạng thái chờ thanh toán"*. Không gọi sang cổng thanh toán.

### 9.3. Luồng EF-3: Cổng thanh toán báo lỗi hoặc giao dịch thất bại
* **Tại bước 7**: Tài khoản không đủ số dư, thông tin thanh toán sai (lỗi **xác định**) hoặc cổng thanh toán bị **timeout** (kết quả không xác định).
* **Hệ thống**:
  1. **Lỗi xác định**: cập nhật `Payment` sang **`FAILED`** (lưu kết quả theo `Idempotency-Key`), đơn hàng sang **`PAYMENT_FAILED`**, ghi log, trả `400/502`; UI hiển thị nút **"Thử thanh toán lại"** / **"Chọn phương thức khác"**.
  2. **Timeout / không xác định**: **không** kết luận thất bại ngay (xem §6.3). Gọi `verifyResult()` đối soát với cổng thanh toán (hoặc chờ callback `verifyCallback`):
     * xác minh *thất bại* → xử lý như lỗi xác định;
     * xác minh *thành công* → chuyển `PENDING -> PAID` như luồng chính;
     * *chưa xác minh được* → giữ `Payment = PROCESSING` (kèm `expiresAt`), đơn vẫn `PENDING`, trả `409/202` *"đang xác minh"*; **không** cho khách thử lại bằng key mới cho tới khi đối soát xong.

### 9.4. Luồng EF-4: Gửi lặp lại yêu cầu thanh toán
* **Tại bước 4**: Do đường truyền mạng chập chờn hoặc người dùng nhấn nút thanh toán nhiều lần liên tiếp, client gửi đi nhiều request với cùng một mã `Idempotency-Key`.
* **Hệ thống**:
  1. NestJS phát hiện `Idempotency-Key` này đã tồn tại trong CSDL (bản ghi `Payment`):
     - Nếu giao dịch trước đó đang xử lý (`PROCESSING`): Trả về trạng thái đang tiến hành (`409 Conflict` hoặc chờ kết quả).
     - Nếu giao dịch trước đó đã thành công (`PAID`): Trả về ngay kết quả giao dịch ban đầu (mã đơn, trạng thái `PAID`).
     - Nếu giao dịch trước đó đã thất bại (`FAILED`): Trả về ngay kết quả thất bại đã lưu (trạng thái `PAYMENT_FAILED`); khách muốn thử lại thì dùng `Idempotency-Key` **mới**.
  2. Tuyệt đối không gửi lệnh trừ tiền sang Cổng thanh toán lần thứ 2.

### 9.5. Luồng EF-5: Gửi yêu cầu thanh toán mới khi giao dịch trước chưa kết thúc
* **Tại bước 4**: khách (hoặc client) tạo `Idempotency-Key` **mới** và gửi `POST /payments` cho cùng `orderId` trong lúc giao dịch trước còn `PROCESSING` (ví dụ sau timeout chưa đối soát xong, hoặc do bấm nút tạo key mới).
* **Hệ thống**: dưới khóa `SELECT Order ... FOR UPDATE`, phát hiện còn `Payment` khác đang `PROCESSING` cho đúng `orderId` → trả `409 Conflict` (*"đang xác minh giao dịch trước đó"*), **không** tạo giao dịch mới và **không** gọi cổng thanh toán. Mục đích: bảo đảm một đơn chỉ có tối đa 1 giao dịch đang xử lý, chặn trừ tiền 2 lần ngay cả khi client đổi key.

---

## 10. Truy vết yêu cầu (Task 1.3)

`UC-08` bao phủ `FR-05` (đơn `PENDING` đầu vào), `FR-06` (luồng chính), `FR-09` (mã khuyến mãi extend `UC-07`), `NFR-02` (JWT + validate), `NFR-05` (transaction + idempotency). Sơ đồ nguồn `use-case-checkout.puml` dùng ID `UC-07` (base/ngữ cảnh), `UC-08`, `UC-09` và các use case con `UC-08a..e`; trong đó `UC-09` **extend `UC-07`** vì mã được áp dụng lúc tạo đơn (AF-1). Các ID `UC-08a..e` là phân rã nội bộ của `UC-08`, được định nghĩa trong tài liệu này (không định nghĩa lại trong `srs.md`).


