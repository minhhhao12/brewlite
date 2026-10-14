# Truy vết Yêu cầu (Traceability Matrix)

Tài liệu này theo dõi chuỗi truy vết từ Yêu cầu (Task 1) $\rightarrow$ Thiết kế & Sơ đồ (Task 2 & 3) $\rightarrow$ Hiện thực Code/API (Task 4 & 5) $\rightarrow$ Kiểm thử tự động (Task 4 & 5).

| Mã yêu cầu | Tên yêu cầu / Mô tả | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test Case | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **FR-01** | Hiển thị menu đồ uống | US-01 / UC-01 Xem menu | Activity-01, Class-01 | `GET /products` | API-T01, UI-T01 | Sẵn sàng (Task 1) |
| **FR-02** | Xem chi tiết & Tùy chọn (size, topping) | US-02 / UC-02 Chi tiết món | Activity-01, Class-01 | `GET /products/:id` | API-T02, UI-T02 | Sẵn sàng (Task 1) |
| **FR-03** | Quản lý giỏ hàng & tính tiền | US-03 / UC-04 Giỏ hàng | Activity-01, Class-01 | Client Zustand/State | UI-T03 | Sẵn sàng (Task 1) |
| **FR-04** | Đăng ký & Đăng nhập (Bcrypt, JWT) | US-04 / UC-05, UC-06 Xác thực | Sequence-01, Class-01 | `POST /auth/register`, `POST /auth/login` | API-T03, INT-T01 | Sẵn sàng (Task 1) |
| **FR-05** | Đặt đơn hàng (Transaction, trừ tồn kho) | UC-01 Đặt & thanh toán đơn hàng | Activity-01, Sequence-01, Class-01 | `POST /orders` | INT-T02 | Sẵn sàng (Task 1) |
| **FR-06** | Thanh toán không tiền mặt (Idempotent) | UC-01 Đặt & thanh toán đơn hàng | Sequence-01, Class-01 | `POST /payments` | INT-T03 | Sẵn sàng (Task 1) |
| **FR-07** | Áp dụng mã khuyến mãi | US-05 / UC-09 Khuyến mãi | Class-01 | `POST /promotions/validate` | UNIT-T01 | Sẵn sàng (Task 1) |
| **FR-08** | Lịch sử & Trạng thái đơn hàng | US-06 / UC-10 Lịch sử đơn | Class-01 | `GET /orders/me`, `GET /orders/:id` | API-T04 | Sẵn sàng (Task 1) |
| **FR-09** | Order State Machine | US-07 / UC-11 Trạng thái đơn | Activity-01, Class-01 | State Machine Service | UNIT-T02 | Sẵn sàng (Task 1) |
| **NFR-01** | Hiệu năng phản hồi (<500ms) | Toàn hệ thống | Deployment-01 | Toàn bộ API NestJS | PERF-T01 | Sẵn sàng (Task 1) |
| **NFR-02** | Bảo mật JWT, RBAC & class-validator | Toàn hệ thống | Deployment-01 | Guards, Pipes | SEC-T01 | Sẵn sàng (Task 1) |
| **NFR-03** | Tính khả dụng Mobile-First & PWA | Toàn hệ thống | UI Wireframe | Frontend Next.js PWA | UI-E2E-T01 | Sẵn sàng (Task 1) |
| **NFR-04** | CI/CD Quality Gate & Docker Deploy | Toàn hệ thống | Deployment-01 | GitHub Actions, Docker | CI-T01 | Sẵn sàng (Task 1) |
| **NFR-05** | Toàn vẹn dữ liệu & Concurrency Lock | UC-01 Đặt & thanh toán | Sequence-01 | Transaction & Locks | CONC-T01 | Sẵn sàng (Task 1) |

