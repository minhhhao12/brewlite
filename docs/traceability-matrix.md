# Truy vết Yêu cầu (Traceability Matrix)

Tài liệu này theo dõi chuỗi truy vết từ Yêu cầu (Task 1) $\rightarrow$ Thiết kế & Sơ đồ (Task 2 & 3) $\rightarrow$ Hiện thực Code/API (Task 4 & 5) $\rightarrow$ Kiểm thử tự động (Task 4 & 5).

## 1. Yêu cầu chức năng (FR)

| Mã yêu cầu | Tên yêu cầu / Mô tả | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test Case | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **FR-01** | Hiển thị menu đồ uống | US-01 / UC-01 Xem menu | Activity-01, Class-01 | `GET /products` | API-T01, UI-T01 | Sẵn sàng (Task 1) |
| **FR-02** | Xem chi tiết & Tùy chọn (size, topping) | US-02 / UC-02, UC-03 Chi tiết món & Size/Topping | Activity-01, Sequence-01, Class-01 | `GET /products/:id` | API-T02, UI-T02 | Sẵn sàng (Task 1) |
| **FR-03** | Quản lý giỏ hàng & tính tiền (client-side) | US-03 / UC-04, UC-04a Giỏ hàng | Activity-01, Sequence-01, Class-01 | Client state (Zustand) + localStorage | UI-T03 | Sẵn sàng (Task 1) |
| **FR-04** | Đăng ký & Đăng nhập (Bcrypt, JWT) | US-04 / UC-05, UC-06 Xác thực | Activity-01, Sequence-01, Class-01 | `POST /auth/register`, `POST /auth/login` | API-T03, INT-T01 | Sẵn sàng (Task 1) |
| **FR-05** | Đặt đơn hàng (Transaction, trừ tồn kho) | US-05 / UC-07 Đặt đơn hàng | Activity-01, Sequence-01, Class-01 | `POST /orders` | INT-T02, CONC-T01 | Sẵn sàng (Task 1) |
| **FR-06** | Thanh toán không tiền mặt (Idempotent) | US-06 / UC-08 Thanh toán đơn hàng | Activity-01, Sequence-01, Class-01 | `POST /payments` (+ `Idempotency-Key`) | INT-T03, INT-T04 | Sẵn sàng (Task 1) |
| **FR-07** | Lịch sử & Trạng thái đơn hàng cá nhân | US-07 / UC-10 Xem lịch sử & trạng thái đơn | Activity-01, Sequence-01, Class-01 | `GET /orders/me`, `GET /orders/:id` | API-T04 | Sẵn sàng (Task 1) |
| **FR-08** | Order State Machine (nguồn duy nhất) | US-08 / UC-11 Quản lý trạng thái đơn | Activity-01, Sequence-01, Class-01 | `Order.assertTransition()` (State Machine Service) | UNIT-T02, INT-T04 | Sẵn sàng (Task 1) |
| **FR-09** | Áp dụng mã khuyến mãi | US-09 / UC-09 Áp dụng khuyến mãi | Activity-01, Sequence-01, Class-01 | Validate `promoCode` trong `POST /orders` | UNIT-T01 | Sẵn sàng (Task 1) |
| **FR-10** | Tích lũy điểm thưởng (idempotent theo orderId) | US-10 / UC-08 (bước post-commit) | Activity-01, Sequence-01, Class-01 | `LoyaltyService` sau commit `PENDING → PAID` | UNIT-T03 | Sẵn sàng (Task 1) |
| **FR-11** | Quản lý món & trạng thái món (Extended) | US-11 / UC-12 Quản lý sản phẩm/menu | Class-01, Deployment-01 | `PATCH /products/:id` (role=STAFF, audit log) | API-T05 | Sẵn sàng (Task 1) - Extended |
| **FR-12** | Giao hàng tận nơi | — (Out-of-Scope) | — | — | — | Không thực hiện (Won't) |
| **FR-13** | Thanh toán tiền mặt tại quầy | — (Out-of-Scope) | — | — | — | Không thực hiện (Won't) |
| **FR-14** | Vận hành: Health check & Seed | Toàn hệ thống | Deployment-01 | `GET /health`, Prisma `migrate` + `seed` | SMOKE-T01 | Sẵn sàng (Task 1) |

## 2. Yêu cầu phi chức năng (NFR)

| Mã yêu cầu | Tên yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test Case | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **NFR-01** | Hiệu năng phản hồi (`GET /products` < 500ms, đặt+thanh toán < 1000ms) | Toàn hệ thống | Deployment-01 | Toàn bộ API NestJS | PERF-T01 | Sẵn sàng (Task 1) |
| **NFR-02** | Bảo mật: Bcrypt, JWT Guard, RBAC, `class-validator` | UC-05, UC-06, UC-07, UC-08 | Activity-01, Sequence-01, Class-01 (`User`, `UserRole`) | Guards, Pipes, `.env` + `.gitignore` | SEC-T01 | Sẵn sàng (Task 1) |
| **NFR-03** | Tính khả dụng Mobile-First & PWA | Toàn hệ thống | UI Wireframe | Frontend Next.js PWA (Manifest, icon) | UI-E2E-T01 | Sẵn sàng (Task 1) |
| **NFR-04** | CI/CD Quality Gate & Docker Deploy | Toàn hệ thống | Deployment-01 | GitHub Actions, Dockerfile, `docker-compose.yml` | CI-T01 | Sẵn sàng (Task 1) |
| **NFR-05** | Toàn vẹn dữ liệu & Concurrency Lock, Idempotency | UC-07, UC-08 | Activity-01, Sequence-01, Class-01 (`Product.stock`, `Payment.idempotencyKey`) | Transaction + `SELECT FOR UPDATE` | CONC-T01, INT-T03 | Sẵn sàng (Task 1) |

## 3. Quy ước mã tạo phẩm thiết kế (Task 2 & 3)

Các mã sơ đồ dùng trong cột "Thiết kế / Sơ đồ" ở trên trỏ tới các tệp sau:

| Mã sơ đồ | Tệp nguồn | Bản kết xuất | Trạng thái |
| :--- | :--- | :--- | :--- |
| Activity-01 | `docs/diagrams/activity-checkout.puml` | `docs/diagrams/activity-checkout.svg` | puml đã cập nhật; **cần re-export SVG** |
| Sequence-01 | `docs/diagrams/sequence-checkout.puml` | `docs/diagrams/sequence-checkout.svg` | puml đã cập nhật; **cần re-export SVG** |
| Class-01 | `docs/diagrams/class-diagram.puml` | `docs/diagrams/class-diagram.svg` | puml đã cập nhật; **cần re-export SVG** |
| Deployment-01 | `docs/architecture/deployment.md` + `docs/architecture/diagrams/deployment.puml` | `docs/architecture/diagrams/deployment.svg` | hạ tầng production chưa deploy |

