# Bối cảnh, stakeholder và phạm vi:
## 1. Bối cảnh nghiệp vụ
Nhận thấy tình trạng khách hàng tốn quá nhiều thời gian để xếp hàng đặt món hoặc chờ thanh toán bằng tiền mặt tại quán. Ứng dụng **BrewLite** được xây dựng để hiện đại hoá quy trình này, ứng dụng cho phép khách hàng tự đặt món, điều chỉnh tuỳ chọn theo sở thích và ý muốn của mình và khách hàng còn có thể thanh toán không qua tiền mặt, giúp tối ưu hoá thời gian phục vụ và giảm tải cho nhân viên tại quầy.
## 2. Bảng phân tích Skateholder
| Stakeholder | Mục tiêu và Kỳ vọng |
| :--- | :--- |
| **Khách hàng** | Đặt đồ uống nhanh chóng, tùy chỉnh đồ uống theo sở thích, thanh toán không dùng tiền mặt và có thể theo dõi trạng thái đơn hàng theo thời gian thực. |
| **Nhân viên quầy** | Tiếp nhận đơn hàng tự động, cập nhật trạng thái pha chế mà không cần thực hiện thủ công. |
| **Quản lý** | Xác định đúng yêu cầu nghiệp vụ, quản lý tiến độ, ưu tiên tính năng (backlog) và nghiệm thu sản phẩm sau mỗi Sprint. |
| **Giảng viên / KH nghiệm thu** | Đánh giá độ hoàn thiện của quy trình, mã nguồn và mức độ đáp ứng các tiêu chí của sản phẩm. |
| **Nhóm phát triển** | Phân tích, thiết kế kiến trúc, lập trình, kiểm thử và tự động hóa triển khai hệ thống thành công. |
| **Đơn vị thanh toán** | Cung cấp cổng thanh toán ổn định để xử lý giao dịch an toàn. |
## 3. Phạm vi In-scope
* Hiển thị menu đồ uống.
* Xem chi tiết đồ uống và tùy chọn size/topping. 
* Quản lý giỏ hàng (Thêm, sửa, xoá sản phẩm trong giỏ).
* Xác thực người dùng (JWT).
* Đặt đơn hàng và theo dõi trạng thái đơn.
* Thanh toán mô phỏng (Ví/Thẻ).
## 4. Phạm vi Out-of-scope
* Trang dành cho riêng nhân viên pha chế và trang quản lý admin.
* Tính năng giao hàng.
## 5. Giả định, ràng buộc và rủi ro
* Giả định: Người dùng có điện thoại kết nối mạng ổn định, sử dụng app ở dạng web mobile-first.
* Ràng buộc: Frontend bắt buộc sử dụng NextJS, Backend bắt buộc sử dụng NestJS và Database là PostgreSQL.
* Rủi ro: Lỗi vượt quá số lượng tồn kho khi có nhiều khách đặt một sản phẩm cùng trong một thời điểm.

