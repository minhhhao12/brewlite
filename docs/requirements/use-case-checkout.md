# Đặc tả Use Case Trọng tâm: Thanh toán Đơn hàng

## 1. Thông tin Use Case
* **Tên Use Case**: Thanh toán đơn hàng
* **Mã định danh**: `UC-08` 
* **Mức độ ưu tiên**: **Must Have** 
* **Actor chính**: Khách hàng (Customer)
* **Actor hỗ trợ**: Cổng thanh toán (Mock Payment Gateway Service)

---

## 2. Tóm tắt nghiệp vụ
Khách hàng thanh toán cho đơn hàng đã tạo bằng phương thức ví điện tử hoặc thẻ ngân hàng mô phỏng. Hệ thống kiểm tra quyền sở hữu và trạng thái đơn hàng, gửi yêu cầu đến dịch vụ thanh toán, sau đó cập nhật trạng thái đơn hàng theo kết quả.

Hệ thống sử dụng Idempotency-Key để tránh xử lý thanh toán lặp khi khách hàng gửi lại yêu cầu. Nếu thanh toán thất bại, khách hàng có thể thử lại trên đơn hàng cũ.

---

## 3. Sơ đồ Use Case (Use Case Diagram)

![Sơ đồ Use Case Thanh toán đơn hàng](./use-case-checkout.svg)

---

## 4. Trigger (Sự kiện kích hoạt)
Khách hàng nhấn nút **“Xác nhận thanh toán”** tại màn hình thanh toán của đơn hàng.
---

## 5. Tiền điều kiện (Pre-conditions)
1. Khách hàng đã đăng nhập và có JWT hợp lệ.
2. Đơn hàng tồn tại, thuộc quyền sở hữu của khách hàng và có trạng thái PENDING hoặc PAYMENT_FAILED.
3. Tổng tiền đơn hàng lớn hơn 0.
4. Dịch vụ thanh toán mô phỏng có thể tiếp nhận yêu cầu.

---

## 6. Hậu điều kiện (Post-conditions)

### 6.1. Trường hợp thành công
* Bản ghi thanh toán được lưu với trạng thái PAID.
* Đơn hàng chuyển sang trạng thái PAID.
* Khách hàng nhận được thông báo thanh toán thành công và mã đơn hàng.

### 6.2. Trường hợp thất bại (đã xác minh)
* Bản ghi thanh toán chuyển sang FAILED.
* Đơn hàng chuyển sang PAYMENT_FAILED.
* Khách hàng được thông báo và có thể thử lại bằng Idempotency-Key mới trên đơn hàng cũ.

### 6.3. Trường hợp chưa xác minh được kết quả
* Bản ghi thanh toán giữ trạng thái PROCESSING.
* Đơn hàng vẫn ở PENDING.
* Hệ thống thông báo giao dịch đang được xác minh và không cho tạo giao dịch thanh toán khác khi giao dịch trước còn đang xử lý.

---

## 7. Luồng sự kiện chính (Main Flow)

| Bước | Hành động của Actor (Khách hàng) | Phản hồi của Hệ thống (BrewLite System) |
| :---: | :--- | :--- |
| **1** | Mở màn hình thanh toán. | Giao diện Next.js hiển thị thông tin đơn: Mã đơn, tổng số tiền cần trả và danh sách các phương thức thanh toán không tiền mặt (Ví điện tử MoMo/ZaloPay, Thẻ ngân hàng). |
| **2** | Khách hàng chọn phương thức thanh toán mong muốn (ví dụ: *Ví điện tử*). | Giao diện ghi nhận lựa chọn và kích hoạt nút "Xác nhận thanh toán". |
| **3** | Khách hàng nhấn nút **"Xác nhận thanh toán"**. |  Tạo Idempotency-Key và gửi POST /payments kèm JWT. |
| **4** | | Kiểm tra JWT, dữ liệu đầu vào, quyền sở hữu, số tiền và trạng thái đơn hàng. |
| **5** | | Kiểm tra giao dịch trùng lặp; nếu hợp lệ, lưu bản ghi Payment ở trạng thái PROCESSING. |
| **6** | | Gửi yêu cầu đến Mock Payment Gateway. |
| **7** | | Nhận kết quả thành công, cập nhật Payment = PAID và Order = PAID. |
|  
| **8** | Xem kết quả thanh toán.| Hiển thị mã đơn hàng, số tiền và trạng thái thanh toán thành công |

---

## 8. Luồng thay thế (Alternative Flows)


### 8.1. Luồng AF-2: Đổi phương thức thanh toán
* **Tại bước 2**: Khách hàng chuyển đổi từ *Ví điện tử* sang *Thẻ ngân hàng*. Hệ thống hiển thị form nhập thông tin thẻ mô phỏng tương ứng mà không làm thay đổi thông tin số tiền của đơn hàng.
### 8.2. Luồng AF-3: Thanh toán lại đơn hàng
* Nếu đơn hàng ở trạng thái PAYMENT_FAILED, khách hàng có thể gửi yêu cầu thanh toán mới với Idempotency-Key mới. Hệ thống kiểm tra lại trạng thái đơn hàng và thực hiện thanh toán trên đơn cũ, không tạo đơn mới.

---

## 9. Luồng ngoại lệ (Exception Flows)

### 9.1. Luồng EF-1: JWT không hợp lệ hoặc hết hạn
* Trả 401 Unauthorized; yêu cầu khách hàng đăng nhập lại.

### 9.2. Luồng EF-2: Đơn hàng không thuộc khách hàng
* Trả 403 Forbidden; không thực hiện thanh toán.

### 9.3. Luồng EF-3: Đơn hàng không ở trạng thái hợp lệ hoặc số tiền không khớp
* Trả lỗi phù hợp; không gọi dịch vụ thanh toán.
### 9.4. Luồng EF-4: Thanh toán thất bại đã xác minh
* Lưu kết quả FAILED, chuyển đơn sang PAYMENT_FAILED và cho phép thử lại.
### 9.5. Luồng EF-5: Gateway timeout hoặc chưa xác định kết quả
* Giữ PROCESSING, đơn vẫn PENDING; trả thông báo đang xác minh và chặn giao dịch mới cho đến khi có kết quả.
### 9.6. Luồng EF-6: Yêu cầu thanh toán bị gửi lặp
* Trả kết quả đã lưu hoặc thông báo đang xử lý; không gọi gateway lần thứ hai cho cùng giao dịch.

## 10. Truy vết yêu cầu (Task 1.3)
* FR-05:	Đơn hàng được tạo trước khi thanh toán.
* FR-06:	Xử lý thanh toán, lưu kết quả và hỗ trợ thử lại an toàn.
* FR-08:	Kiểm soát chuyển trạng thái đơn hàng.
* NFR-02:	Xác thực JWT, kiểm tra quyền truy cập và validate dữ liệu.
* NFR-05:	Transaction và idempotency nhằm bảo vệ tính toàn vẹn giao dịch.

