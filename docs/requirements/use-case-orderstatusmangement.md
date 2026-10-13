# I. Đặc tả Use case trọng tâm:

## 1. Tên Use case
Quản lý trạng thái đơn hàng
## 2. Actor
Nhân viên
## 3. Tóm tắt nghiệp vụ
Use case này cho phép nhân viên đã đăng nhập truy cập danh sách đơn hàng, xem thông tin chi tiết của một đơn, cập nhật trạng thái xử lý và hủy đơn nếu đơn vẫn ở trạng thái cho phép hủy. Hệ thống phải kiểm tra quyền truy cập, tính hợp lệ của chuyển trạng thái và lưu lại kết quả xử lý.
## 4. Tiền điều kiện
* Nhân viên đã đăng nhập thành công vào hệ thống.
* Hệ thống đang hoạt động và có thể truy xuất dữ liệu đơn hàng.
## 5. Hậu điều kiện
#### Thành công: 
* Danh sách hoặc chi tiết đơn hàng được hiển thị theo yêu cầu của nhân viên.
* Nếu trạng thái đơn được cập nhật, trạng thái mới sẽ được lưu vào cơ sở dữ liệu.
* Nếu đơn được hủy thành công, đơn được chuyển sang trạng thái Hủy theo quy tắc nghiệp vụ.
* Hệ thống phản hồi kết quả chính xác cho nhân viên.
#### Thất bại
* Trạng thái đơn hàng không bị thay đổi nếu thao tác cập nhật hoặc hủy không hợp lệ.
* Hệ thống thông báo thất bại.
## 6. Luồng sự kiện chính
1. Nhân viên truy cập chức năng Quản lý trạng thái đơn.
2. Nhân viên yêu cầu xem danh sách đơn hàng
3. Nhân viên chọn một đơn hàng đang có trong danh sách để xử lí.
4. Nhân viên sẽ chọn thao tác cập nhật trạng thái.
5. Sau khi chọn trạng thái mới, nhân viên nhấn xác nhận.
6. Kết quả đơn hàng được cập nhật.
## 7. Luồng thay thế
* Nhân viên sẽ tìm kiếm hoặc lọc danh sách đơn hàng.
* Nhân viên chỉ xem đơn mà không cập nhật hay thực hiện thêm thao tác nào.
## 8. Luồng ngoại lệ
* Phiên đăng nhập của nhân viên hết hạn.
* Mã đơn không tồn tại hoặc không còn truy cập được nữa.
* Chuyển sang trạng thái không hợp lệ.
* Lỗi kết nối với CSDL hoặc máy chủ khi lưu thay đổi.

# Liên kết Use case với mã yêu cầu.
| Mã yêu cầu | Nội dung yêu cầu | Use Case liên quan |
| :--- | :--- | :--- |
| FR-ORD-01 | Hệ thống cho phép nhân viên xem danh sách đơn hàng. | UC12, UC16 |
| FR-ORD-02 | Hệ thống cho phép nhân viên xem chi tiết đơn hàng. | UC12, UC16 |
| FR-ORD-03 | Hệ thống cho phép nhân viên cập nhật trạng thái đơn theo quy tắc chuyển trạng thái hợp lệ. | UC12, UC18 |
| FR-ORD-04 | Hệ thống cho phép nhân viên hủy đơn khi đơn đáp ứng điều kiện hủy. | UC17 |
| FR-AUTH-01 | Hệ thống xác thực nhân viên trước khi cho phép truy cập chức năng quản lý đơn. | UC7, UC12 |
| FR-AUTH-02 | Hệ thống chỉ cho phép tài khoản có quyền phù hợp thực hiện thao tác quản lý đơn. | UC12, UC17 |
| NFR-DATA-01 | Hệ thống phải bảo toàn tính nhất quán của dữ liệu khi cập nhật trạng thái đơn. | UC12, UC17 |

# II. Liên kết Use case với mã yêu cầu
| Mã yêu cầu | Tên yêu cầu trong SRS | Mối liên hệ với UC12 | Mức ưu tiên |
| :--- | :--- | :--- | :--- |
| **FR-09** | Quản lý trạng thái đơn (Nhân viên) | Yêu cầu chính của UC12: nhân viên xem danh sách đơn hàng và cập nhật trạng thái theo luồng hợp lệ. | Should |
| **FR-04** | Đăng ký / Đăng nhập | Xác thực nhân viên và phân biệt vai trò customer và staff trước khi truy cập chức năng quản lý đơn. | Must |
| **FR-08** | Lịch sử & Trạng thái đơn hàng | Liên quan đến việc cập nhật trạng thái trong UC12; trạng thái mới cần được phản ánh chính xác khi khách hàng xem đơn của mình. | Should |
| **NFR-02** | Bảo mật | Bảo vệ các API quản lý đơn: không có token hoặc token hết hạn trả về 401; sai vai trò trả về 403; dữ liệu đầu vào được validate bằng class-validator. | Must |

