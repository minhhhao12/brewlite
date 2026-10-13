# Danh sách Yêu cầu Hệ thống (System Requirements)

## 1. Yêu cầu chức năng (Functional Requirements)

| Mã ID | Tên yêu cầu | Mức ưu tiên | Tiêu chí chấp nhận |
| :---- | :---------- | :---------- | :----------------- |
| **FR-01** | Xem menu đồ uống | Must | API trả về danh sách sản phẩm; giao diện hiển thị danh sách đồ uống gồm hình ảnh, tên, giá. |
| **FR-02** | Xem chi tiết & Tùy chọn | Must |Xem được chi tiết sản phẩm; chọn được size (S/M/L) và topping; giá tự động cập nhật theo tùy chọn. |
| **FR-03** | Quản lý giỏ hàng | Must| Thêm, sửa số lượng, xóa món; tự động tính tổng tiền; hiển thị số lượng món; giỏ hàng được giữ lại sau khi đăng nhập. |
| **FR-04** | Đăng ký / Đăng nhập | Must | Mật khẩu được băm (Bcrypt); đăng nhập trả về token JWT; có hai vai trò `customer` và `staff`; các route đặt đơn và quản trị được bảo vệ theo vai trò. |
| **FR-05** | Đặt đơn hàng | Must | Người dùng đã đăng nhập tạo đơn từ giỏ hàng; đơn được lưu với trạng thái `PENDING` và tổng tiền khớp giỏ hàng; giỏ hàng được xóa sau khi tạo đơn thành công. |
| **FR-06** | Thanh toán đơn hàng | Must | Hiển thị tổng tiền và nút "Thanh toán"; chọn phương thức Ví/Thẻ và chuyển sang cổng thanh toán; thành công chuyển trạng thái `PAID`, thất bại hoặc hết hạn chuyển `PAYMENT_FAILED`. |
| **FR-07** | Áp dụng khuyến mãi | Could | Nhập mã hợp lệ thì tổng tiền giảm đúng; mã sai hoặc hết hạn hiển thị thông báo lỗi. |
| **FR-08** | Lịch sử & Trạng thái đơn hàng | Should | Khách hàng chỉ xem được đơn của chính mình; hiển thị mã đơn và trạng thái hiện tại (`PENDING`, `PAID`, `PAYMENT_FAILED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`). |
| **FR-09** | Quản lý trạng thái đơn (Nhân viên) | Should| Chỉ tài khoản `Nhân viên` mới xem được danh sách đơn và cập nhật trạng thái theo luồng hợp lệ (`PAID` → `PREPARING` → `READY` → `COMPLETED`)|
| **FR-10** | Quản lý sản phẩm / menu| Could | Nhân viên có thể thêm, sửa, ẩn/xóa sản phẩm, size và topping; thay đổi hiển thị ngay trên menu của khách. |
| **FR-11** | Quản lý khuyến mãi| Could| Nhân viên có thể tạo, sửa, vô hiệu hóa mã khuyến mãi kèm điều kiện và thời hạn. |

## 2. Yêu cầu phi chức năng (Non-Functional Requirements)

| Mã ID | Tên yêu cầu | Mức ưu tiên | Tiêu chí chấp nhận |
| :---- | :---------- | :---------- | :----------------- |
| **NFR-01** | Hiệu năng | Must | request GET /products có thời gian phản hồi dưới 500ms với bộ dữ liệu mẫu 100 sản phẩm. |
| **NFR-02** | Bảo mật | Must | Request không có token hoặc token hết hạn trả về 401; truy cập sai vai trò trả về 403; toàn bộ dữ liệu đầu vào được validate bằng class-validator. |
| **NFR-03** | Khả năng triển khai | Must | Triển khai tự động (CI/CD) qua Docker; môi trường production truy cập được qua HTTPS. |

