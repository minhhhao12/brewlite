# Bối cảnh, Stakeholder và Phạm vi Hệ thống

## 1. Bối cảnh nghiệp vụ
Trong mô hình vận hành quán cà phê và đồ uống truyền thống, khách hàng thường xuyên phải đối mặt với tình trạng xếp hàng kéo dài vào các khung giờ cao điểm, thời gian chờ gọi món và thanh toán bằng tiền mặt chậm chạp, dễ xảy ra nhầm lẫn đơn hoặc sai sót trong khâu thu ngân.

**BrewLite** được định vị là một giải pháp ứng dụng web hiện đại (Mobile-First / PWA), cho phép khách hàng tự phục vụ: chủ động duyệt menu số hóa, tùy biến sản phẩm (size, topping) theo sở thích, đặt đơn và thanh toán 100% không dùng tiền mặt trực tiếp trên điện thoại cá nhân. Hệ thống giúp rút ngắn tối đa thời gian chờ đợi tại quầy, tối ưu hóa năng suất phục vụ của nhân viên, đồng thời cung cấp khả năng theo dõi trạng thái đơn hàng minh bạch theo thời gian thực.

---

## 2. Bảng phân tích Stakeholder

| Stakeholder | Vai trò & Trách nhiệm chính | Mục tiêu & Kỳ vọng cốt lõi |
| :--- | :--- | :--- |
| **Khách hàng** | Người dùng cuối trực tiếp sử dụng ứng dụng để gọi đồ uống. | Trải nghiệm đặt món nhanh chóng trên di động mà không cần cài đặt app phức tạp; tùy chỉnh món linh hoạt; thanh toán an toàn, tiện lợi; nắm bắt được trạng thái đơn hàng để chủ động đến lấy món. |
| **Nhân viên quầy** | Tiếp nhận thông tin đơn hàng, thực hiện pha chế và bàn giao đồ uống cho khách. | Thông tin đơn hàng rõ ràng, chính xác (món, size, topping, ghi chú); giảm áp lực thanh toán và order miệng tại quầy; quy trình chuyển trạng thái đơn hàng đơn giản, trực quan. |
| **Quản lý cửa hàng / Product Owner** | Quản lý vận hành kinh doanh, tối ưu hóa menu và nghiệm thu tiến độ sản phẩm. | Nắm bắt được doanh thu và trạng thái đơn hàng; xác định đúng yêu cầu nghiệp vụ, ưu tiên Product Backlog hợp lý và nghiệm thu sản phẩm tăng dần (Increment) sau mỗi Sprint. |
| **Giảng viên / Khách hàng nghiệm thu** | Đánh giá toàn diện dự án theo chuẩn quy trình Công nghệ Phần mềm. | Đánh giá tính chuẩn chỉ của quy trình Agile Scrum, tính toàn vẹn của chuỗi truy vết (Traceability từ Yêu cầu $\rightarrow$ Thiết kế $\rightarrow$ Code $\rightarrow$ Test $\rightarrow$ CI/CD), chất lượng mã nguồn và sản phẩm thực tế chạy trên Production. |
| **Nhóm phát triển** | Phân tích yêu cầu, thiết kế kiến trúc, lập trình full-stack, viết kiểm thử tự động và thiết lập CI/CD. | Xây dựng kiến trúc hệ thống bền vững (Next.js + NestJS + PostgreSQL + Docker); đảm bảo tính nhất quán của dữ liệu (concurrency, transaction, idempotency); tự động hóa kiểm thử và triển khai liên tục. |
| **Đơn vị cung cấp thanh toán** | Cung cấp hoặc mô phỏng cổng thanh toán trực tuyến (Ví điện tử MoMo/ZaloPay, Thẻ ngân hàng). | Đảm bảo tính bảo mật giao dịch, toàn vẹn dữ liệu thanh toán; xử lý giao dịch an toàn với cơ chế Idempotency chống trừ tiền lặp lại; phản hồi kết quả giao dịch kịp thời. |

---

## 3. Phạm vi Hệ thống (System Scope)

### 3.1. Phạm vi trong MVP (In-Scope MVP)
* **Xem menu & Tìm kiếm**: Hiển thị danh mục sản phẩm đồ uống kèm hình ảnh, mô tả, đơn giá, trạng thái còn/hết hàng.
* **Chi tiết món & Tùy chọn**: Cho phép khách hàng chọn dung tích (Size S/M/L) và các loại Topping ăn kèm; tự động cập nhật tổng giá tức thời.
* **Quản lý giỏ hàng**: Thêm mới, thay đổi số lượng, xóa từng món hoặc toàn bộ giỏ; tự động tính tổng tiền giỏ hàng; duy trì trạng thái giỏ hàng.
* **Xác thực người dùng**: Đăng ký, đăng nhập tài khoản khách hàng; bảo vệ bằng mật khẩu mã hóa (Bcrypt) và cơ chế JWT Token.
* **Đặt đơn hàng**: Tạo đơn hàng từ giỏ hàng, xác thực tính hợp lệ của đơn, áp dụng Transaction để đảm bảo tính toàn vẹn và kiểm soát tồn kho (không bán quá số lượng).
* **Thanh toán trực tuyến mô phỏng**: Hỗ trợ thanh toán qua Ví điện tử hoặc Thẻ ngân hàng với cơ chế `Idempotency-Key` ngăn chặn thanh toán lặp; tự động cập nhật trạng thái đơn thành `PAID` hoặc `PAYMENT_FAILED`.
* **Theo dõi trạng thái & Lịch sử đơn hàng**: Màn hình xác nhận sau khi đặt; xem chi tiết mã đơn hàng và trạng thái xử lý; xem lịch sử các đơn hàng cá nhân đã đặt.

### 3.2. Phạm vi mở rộng (Extended Scope)
* **Giao diện pha chế (Kitchen Display System - KDS)**: Màn hình chuyên biệt dành riêng cho Barista tiếp nhận đơn hàng đã thanh toán và cập nhật tuần tự các trạng thái: `PAID` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`.
* **Quản trị danh mục & Tồn kho**: Trang quản lý dành cho Quản lý cửa hàng (Admin) để cập nhật thông tin sản phẩm, quản lý số lượng nguyên liệu tồn kho theo thời gian thực.

### 3.3. Phạm vi không thực hiện (Out-of-Scope)
* BrewLite chỉ phục vụ mô hình khách hàng tự đến quầy nhận đồ uống (Pick-up / Take-away). Không xây dựng hệ thống tính phí vận chuyển, định vị GPS hay ứng dụng cho tài xế giao hàng.
* Là quán cà phê hiện đại 100% không dùng tiền mặt, hệ thống kiên quyết không hỗ trợ luồng thanh toán tiền mặt truyền thống trong quy trình đặt online.
* Không bao gồm các nghiệp vụ quản trị nguồn nhân lực nội bộ của quán cà phê.

---

## 4. Giả định và Ràng buộc

### 4.1. Giả định
* Khách hàng sử dụng điện thoại thông minh có kết nối Internet (4G/5G/Wi-Fi) và trình duyệt web tiêu chuẩn (Chrome, Safari) tương thích tốt với PWA và Mobile-First.
* Dịch vụ thanh toán (Payment Gateway) phản hồi kết quả giao dịch tức thời hoặc có độ trễ mô phỏng thực tế đáng tin cậy.
* Hệ thống luôn có sẵn dữ liệu mẫu về sản phẩm, danh mục, tùy chọn size và topping để phục vụ kiểm thử và demo.

### 4.2. Ràng buộc kỹ thuật & quy trình
* **Tech Stack**:
  * Frontend: Next.js (React, TypeScript), kiến trúc hướng Mobile-First / PWA, quản lý state bằng Zustand hoặc React Query.
  * Backend: NestJS, thiết kế theo Module/Domain-driven architecture, sử dụng class-validator và JWT Guard.
  * Cơ sở dữ liệu: PostgreSQL, quản lý schema và migration thông qua Prisma.
  * DevOps: Docker & Docker Compose để container hóa môi trường Local, CI và Production.
* **Ràng buộc bảo mật**: Không lưu trữ mật khẩu dưới dạng plaintext; toàn bộ API nhạy cảm phải được bảo vệ qua JWT; không commit bí mật (Secrets, Passwords, API Keys) vào kho mã nguồn Git.

---

## 5. Phân tích Rủi ro Ban đầu & Biện pháp Giảm thiểu 

| Mã rủi ro | Mô tả rủi ro ban đầu | Mức độ ảnh hưởng | Khả năng xảy ra | Biện pháp giảm thiểu & Thiết kế kỹ thuật|
| :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | **Bán vượt tồn kho khi đặt đồng thời (Overselling)**: Nhiều khách hàng cùng đặt mua sản phẩm cuối cùng tại cùng một thời điểm. | Cao | Trung bình | Sử dụng **Transaction** kết hợp cơ chế **Optimistic Locking** (hoặc Pessimistic locking `SELECT FOR UPDATE`) trong NestJS khi tạo đơn để kiểm tra và trừ kho nguyên tử. |
| **RSK-02** | **Thanh toán trùng lặp**: Khách hàng nhấn nút thanh toán nhiều lần do mạng chập chờn hoặc retry từ client. | Rất cao | Trung bình | Bắt buộc client sinh và gửi kèm **`Idempotency-Key`** (UUID) cho mỗi giao dịch thanh toán; backend kiểm tra key trước khi xử lý, nếu trùng lặp sẽ trả về ngay kết quả trước đó mà không trừ tiền 2 lần. |
| **RSK-03** | **Cổng thanh toán bị gián đoạn / Timeout**: Dịch vụ thanh toán bên thứ ba gặp sự cố không phản hồi kết quả. | Cao | Thấp | Thiết kế trạng thái đơn hàng linh hoạt: chuyển sang `PAYMENT_FAILED` nếu timeout, cho phép khách hàng thực hiện lại thao tác thanh toán mà không cần tạo mới toàn bộ đơn hàng; có timeout bảo vệ. |
| **RSK-04** | **Lộ lọt thông tin bí mật / Secret Keys**: Secret JWT, Database credentials hoặc API keys bị đẩy lên repository công khai. | Rất cao | Thấp | Quản lý cấu hình nghiêm ngặt bằng biến môi trường qua `.env.example`, đưa `.env` vào `.gitignore`, quét secret tự động trong CI pipeline trước khi merge code. |
| **RSK-05** | **Gãy chuỗi truy vết**: Yêu cầu đặc tả không khớp với Sequence diagram, mã nguồn API và các bài kiểm thử tự động. | Trung bình | Cao | Thống nhất định danh mã yêu cầu (`FR-xx`, `NFR-xx`, `UC-xx`), chuẩn hóa tài liệu ngay từ Sprint 1 và duy trì `docs/traceability-matrix.md` cập nhật liên tục qua từng pull request. |
