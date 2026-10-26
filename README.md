# BrewLite

BrewLite là ứng dụng đặt đồ uống theo hướng **mobile-first / PWA**: khách xem menu, chọn size/topping, đặt đơn, thanh toán không tiền mặt và nhận tại quầy.

**Công nghệ:** Next.js (React, TypeScript, TailwindCSS) · NestJS · PostgreSQL (Prisma) · Docker · Zustand · TanStack Query.

## Mục lục

1. [Trạng thái tính năng](#1-trạng-thái-tính-năng)
2. [Cấu trúc repository](#2-cấu-trúc-repository)
3. [Yêu cầu môi trường](#3-yêu-cầu-môi-trường)
4. [Chạy bằng Docker (khuyến nghị)](#4-chạy-bằng-docker-khuyến-nghị)
5. [Chạy trực tiếp trên máy host (tùy chọn)](#5-chạy-trực-tiếp-trên-máy-host-tùy-chọn)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Dữ liệu mẫu và tài khoản demo](#7-dữ-liệu-mẫu-và-tài-khoản-demo)
8. [API](#8-api)
9. [Thử nhanh luồng đặt đơn và thanh toán](#9-thử-nhanh-luồng-đặt-đơn-và-thanh-toán)
10. [Cơ sở dữ liệu](#10-cơ-sở-dữ-liệu)
11. [Scripts](#11-scripts)
12. [Chạy kiểm thử](#12-chạy-kiểm-thử)
13. [Quy trình làm việc nhóm](#13-quy-trình-làm-việc-nhóm)
14. [Xử lý sự cố thường gặp](#14-xử-lý-sự-cố-thường-gặp)
15. [Tài liệu](#15-tài-liệu)

## 1. Trạng thái tính năng

| Nhóm | Đã có | Chưa có |
| :--- | :--- | :--- |
| Giao diện web | Menu (`/`), chi tiết món + chọn size/topping (`/products/:id`), giỏ hàng (`/cart`), đăng ký (`/register`), đăng nhập (`/login`) | Trang thanh toán, trang xác nhận đơn, lịch sử đơn |
| API | Sản phẩm, đăng ký/đăng nhập (JWT), tạo/xem/hủy đơn, cập nhật trạng thái đơn (nhân viên), thanh toán mô phỏng có `Idempotency-Key`, mã khuyến mãi khi tạo đơn | Cộng điểm tích lũy sau khi thanh toán |
| Hệ thống | Docker Compose chạy PostgreSQL + API + Web, tự migrate và seed; CI trên GitHub Actions | Triển khai production (xem [`docs/deployment.md`](./docs/deployment.md)) |

**Hạn chế đã biết:** `POST /payments` hiện **chưa yêu cầu đăng nhập** và chưa kiểm tra người gọi có phải chủ đơn hay không (thiết kế trong [`sequence-checkout.puml`](./docs/diagrams/sequence-checkout.puml) yêu cầu JWT). Đây là việc cần bổ sung trước khi đưa vào sử dụng thật.

## 2. Cấu trúc repository

```text
brewlite/
├── apps/
│   ├── api/                  # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/   # migration SQL (chạy bằng prisma migrate deploy)
│   │   │   └── seed.ts       # dữ liệu mẫu
│   │   └── src/
│   │       ├── auth/         # đăng ký/đăng nhập, JwtAuthGuard, @CurrentUser()
│   │       ├── products/     # GET /products, GET /products/:id
│   │       ├── orders/       # đơn hàng + domain/order-state-machine.ts
│   │       ├── payments/     # thanh toán mô phỏng + Idempotency-Key
│   │       ├── health/       # GET /health, GET /health/ready
│   │       ├── prisma/       # PrismaService / PrismaModule
│   │       ├── config/       # kiểm tra biến môi trường khi khởi động
│   │       ├── common/       # filter lỗi thống nhất
│   │       └── main.ts
│   └── web/                  # Frontend Next.js
│       ├── app/              # trang: menu, chi tiết món, giỏ hàng, đăng nhập, đăng ký
│       ├── components/       # header, footer, product card/grid/detail, giỏ hàng
│       ├── lib/              # api client, Zustand (giỏ hàng, đăng nhập), types, format
│       └── public/
├── docs/                     # Đặc tả, sơ đồ, kiến trúc, ADR
├── Dockerfile.dev            # Image dev dùng chung cho API + Web
├── docker-compose.yml        # PostgreSQL + API + Web
├── .github/workflows/ci.yml  # CI: install → generate → lint → test → build
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

## 3. Yêu cầu môi trường

### Cách khuyến nghị: chạy hoàn toàn bằng Docker

Chỉ cần **Docker Desktop / Docker Engine / OrbStack** đang chạy (Docker Compose v2, BuildKit mặc định) và **Git**. Không cần cài Node.js, pnpm hay PostgreSQL trên máy.

Máy cần trống các cổng **3000** (API), **3001** (Web), **5432** (PostgreSQL), hoặc đổi cổng trong file `.env` (xem mục 6).

### Cách tùy chọn: chạy trực tiếp trên máy host

Chỉ cần khi không dùng Docker cho API/Web, hoặc khi muốn chạy test ngay trên máy:

- **Node.js ≥ 20.11** (khuyến nghị 22, xem `.nvmrc`).
- **pnpm 12.14.0**, bật bằng `corepack enable` (đi kèm Node).
- Docker vẫn cần để chạy PostgreSQL (`docker compose up -d db`).

## 4. Chạy bằng Docker (khuyến nghị)

### 4.1. Lần đầu (máy mới)

```bash
git clone https://github.com/minhhhao12/brewlite.git
cd brewlite
git checkout dev          # nhánh làm việc chung của nhóm
docker compose up --build
```

Docker sẽ:

1. Tải `node:22-alpine` và `postgres:16-alpine`.
2. Cài pnpm và toàn bộ dependency **bên trong image**.
3. Khởi động PostgreSQL, sau đó API: container API tự chạy `prisma generate`, `migrate deploy` và seed trước khi start.
4. Khởi động Web khi API đã khỏe.

Lần build đầu mất vài phút. Khi log API báo đã chạy và Web sẵn sàng:

| Dịch vụ | Địa chỉ |
| :--- | :--- |
| Web | http://localhost:3001 |
| API | http://localhost:3000 |
| Kiểm tra API | http://localhost:3000/health |

Mở http://localhost:3001 phải thấy menu 12 món.

### 4.2. Các lần sau

```bash
docker compose up -d          # chạy nền
docker compose logs -f api    # xem log API (Ctrl+C chỉ thoát xem log, không dừng container)
docker compose logs -f web
docker compose down           # dừng, giữ dữ liệu PostgreSQL
docker compose down -v        # dừng và XÓA dữ liệu PostgreSQL
```

Khi đổi **dependency** (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) hoặc `Dockerfile.dev`, build lại:

```bash
docker compose up --build
```

Nếu đổi `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` sau khi đã có dữ liệu, PostgreSQL vẫn giữ mật khẩu cũ. Khi đó reset volume (mất dữ liệu local):

```bash
docker compose down -v
docker compose up --build
```

### 4.3. Chạy lệnh Prisma trong container

```bash
docker compose exec api pnpm --filter @brewlite/api db:migrate:deploy
docker compose exec api pnpm --filter @brewlite/api db:seed
docker compose exec api pnpm --filter @brewlite/api prisma:generate
docker compose exec api pnpm --filter @brewlite/api db:migrate   # tạo migration mới sau khi sửa schema.prisma
docker compose exec api pnpm --filter @brewlite/api db:reset     # xóa DB, migrate và seed lại
```

### 4.4. Kiểm tra nhanh

```bash
curl -i http://localhost:3000/health          # 200 OK (liveness, không query DB)
curl -i http://localhost:3000/health/ready    # 200 OK (có SELECT 1 trên PostgreSQL)
curl -s http://localhost:3000/products        # danh sách món
```

## 5. Chạy trực tiếp trên máy host (tùy chọn)

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

corepack enable
pnpm install

docker compose up -d db       # chỉ chạy PostgreSQL

pnpm prisma:generate
pnpm db:migrate
pnpm db:seed

pnpm dev:api                  # terminal 1 → http://localhost:3000
pnpm dev:web                  # terminal 2 → http://localhost:3001
```

Chỉ muốn xem giao diện: `pnpm install --filter @brewlite/web...` rồi `pnpm dev:web`. Danh sách món sẽ báo lỗi nếu API chưa bật.

## 6. Biến môi trường

### Docker Compose (file `.env` ở thư mục gốc, không bắt buộc)

Không có file `.env` thì Docker Compose dùng giá trị mặc định dưới đây. Copy `.env.example` thành `.env` khi cần đổi cổng hoặc secret.

| Biến | Mặc định | Ghi chú |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `brewlite` | User DB local. |
| `POSTGRES_PASSWORD` | `brewlite_local_only` | Chỉ dùng local. |
| `POSTGRES_DB` | `brewlite` | Tên database. |
| `POSTGRES_PORT` | `5432` | Cổng PostgreSQL trên máy host (chỉ mở cho `127.0.0.1`). |
| `API_PORT` | `3000` | Cổng API. |
| `WEB_PORT` | `3001` | Cổng Web. |
| `JWT_SECRET` | giá trị local | Tối thiểu 32 ký tự. Production phải dùng secret riêng. |

### API: `apps/api/.env` (chỉ khi chạy trên host)

| Biến | Mặc định | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` bắt buộc có `DATABASE_URL` và `JWT_SECRET` riêng, nếu thiếu API không khởi động. |
| `PORT` | `3000` | Cổng API. |
| `DATABASE_URL` | PostgreSQL local | Dạng `postgresql://user:pass@host:5432/db?schema=public`. |
| `JWT_SECRET` | giá trị local | ≥ 32 ký tự. |
| `JWT_EXPIRES_IN` | `1h` | Thời hạn access token. |
| `CORS_ORIGIN` | `http://localhost:3001,http://127.0.0.1:3001` | Danh sách origin được gọi API, phân tách bằng dấu phẩy. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` hoặc `error`. |
| `PAYMENT_PROVIDER` | `mock` | Hiện chỉ hỗ trợ `mock`; giá trị khác trả `503` khi thanh toán. |

`apps/api/.env.example` còn liệt kê `PAYMENT_MOCK_*` và `RUN_MIGRATIONS`, nhưng code hiện chưa đọc các biến này.

### Web: `apps/web/.env.local` (chỉ khi chạy trên host)

| Biến | Ví dụ | Ghi chú |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Được đưa vào bundle lúc build; đổi URL phải build lại. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Tắt telemetry của Next.js. |

## 7. Dữ liệu mẫu và tài khoản demo

**Seed** (tự chạy khi container API khởi động, chạy lại không tạo trùng):

- 12 sản phẩm, mỗi sản phẩm có 3 size và 3 topping.
- Mã khuyến mãi **`WELCOME10`**: giảm 10%, tối đa 20.000đ, áp dụng cho đơn từ 50.000đ, hiệu lực đến hết 2027.
- Một user kỹ thuật `payment-test@brewlite.local` dùng cho dữ liệu kiểm thử, **không đăng nhập được**.

**Seed không tạo tài khoản đăng nhập.** Tạo tài khoản demo bằng cách đăng ký:

- Trên web: http://localhost:3001/register.
- Hoặc bằng API (mật khẩu từ 6 ký tự):

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@brewlite.local","password":"demo1234"}'
```

Tài khoản đăng ký mới luôn có vai trò `CUSTOMER`. Để có tài khoản nhân viên (`STAFF`, dùng cập nhật trạng thái đơn), đăng ký một tài khoản rồi nâng quyền trong DB:

```bash
docker compose exec db psql -U brewlite -d brewlite \
  -c "UPDATE \"User\" SET role = 'STAFF' WHERE email = 'staff@brewlite.local';"
```

Vai trò được đọc lại từ DB ở mỗi request nên không cần đăng nhập lại ([ADR-008](./docs/architecture/adr/008-auth-jwt-bcrypt.md)).

## 8. API

Địa chỉ gốc khi chạy local: `http://localhost:3000`. Các route đánh dấu 🔒 cần header `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/` | Trả chuỗi `Hello`. |
| `GET` | `/health` | Liveness, không query DB. |
| `GET` | `/health/ready` | Readiness, chạy `SELECT 1` trên PostgreSQL. |
| `GET` | `/products` | Danh sách món đang bán, kèm size/topping. |
| `GET` | `/products/:id` | Chi tiết món + size/topping. `404` nếu không có. |
| `POST` | `/auth/register` | Đăng ký. Body: `email`, `password` (6–72 ký tự), `username` (tùy chọn). `409` nếu email đã tồn tại. |
| `POST` | `/auth/login` | Đăng nhập, trả `accessToken` (JWT) và thông tin user. Sai email/mật khẩu trả `401`. |
| `GET` | `/auth/me` 🔒 | Trả thông tin người dùng hiện tại, dùng để kiểm tra token. |
| `POST` | `/orders` 🔒 | Tạo đơn từ giỏ hàng. Body: `items[]` (`productId`, `quantity` 1–20, `sizeOptionId?`, `toppingOptionIds?`) và `promoCode?`. Server tự tính lại giá, kiểm tra và trừ tồn kho. Đơn mới có trạng thái `PENDING`. |
| `GET` | `/orders/me` 🔒 | Danh sách đơn của người dùng hiện tại. |
| `GET` | `/orders/:id` 🔒 | Chi tiết đơn. Chỉ chủ đơn hoặc `STAFF` xem được, người khác nhận `403`. |
| `POST` | `/orders/:id/cancel` 🔒 | Hủy đơn và hoàn tồn kho. Khách chỉ hủy được đơn `PENDING` hoặc `PAYMENT_FAILED`; đơn `PAID` chỉ `STAFF` hủy được. |
| `PATCH` | `/orders/:id/status` 🔒 | Chỉ `STAFF`. Body: `{ "status": "PREPARING" }`. Chuyển không hợp lệ trả `400`. |
| `POST` | `/payments` | Thanh toán mô phỏng, xem chi tiết bên dưới. |

### Thanh toán `POST /payments`

- Header bắt buộc: **`Idempotency-Key`** (chuỗi 1–64 ký tự, ví dụ UUID). Client cũ vẫn có thể gửi `idempotencyKey` trong body; nếu gửi cả hai thì phải trùng nhau, nếu không trả `400`.
- Body: `orderId` (UUID), `method` (`WALLET` hoặc `CARD`), `simulateFailure` (tùy chọn, `true` để mô phỏng thanh toán lỗi; bị từ chối ở production).
- Kết quả: `{ payment, orderStatus, reused }`. Thành công đưa đơn sang `PAID`, thất bại đã xác minh đưa đơn sang `PAYMENT_FAILED`.
- **Gửi lại cùng `Idempotency-Key` cho cùng đơn** trả lại kết quả đã lưu (`reused: true`), không tạo thanh toán thứ hai. Dùng khi mạng chập chờn hoặc khách bấm đúp.
- Đơn `PAYMENT_FAILED` được thử lại bằng **khóa mới**. Đơn đã `PAID`, `PREPARING`, `READY`, `COMPLETED` hoặc `CANCELLED` trả `409`.

### Luồng trạng thái đơn hàng

Mọi thay đổi trạng thái đều qua `OrderStateMachine.assertTransition()` (`apps/api/src/orders/domain/order-state-machine.ts`), chuyển không hợp lệ trả `400`:

```text
PENDING ──► PAID ──► PREPARING ──► READY ──► COMPLETED
   │          │
   │          └────► CANCELLED
   ├────► PAYMENT_FAILED ──► PENDING (thử lại thanh toán)
   │            │
   └────────────┴────► CANCELLED
```

`COMPLETED` và `CANCELLED` là trạng thái cuối. Đơn đã vào `PREPARING` thì không hủy được. Chuyển giữ nguyên trạng thái (ví dụ `CANCELLED → CANCELLED`) cũng bị từ chối.

### Định dạng lỗi

Mọi lỗi trả cùng một dạng:

```json
{ "statusCode": 409, "code": "HTTP_ERROR", "message": "...", "path": "/payments", "timestamp": "..." }
```

Dữ liệu gửi lên được kiểm tra toàn cục (`whitelist`, `forbidNonWhitelisted`): trường lạ hoặc sai kiểu trả `400`.

## 9. Thử nhanh luồng đặt đơn và thanh toán

Chạy sau khi `docker compose up` đã sẵn sàng. Món mẫu dùng id `11111111-1111-4111-8111-000000000001` (Cà phê sữa đá).

### Bash (macOS, Linux, Git Bash, WSL)

```bash
API=http://localhost:3000
EMAIL="demo$RANDOM@brewlite.local"

curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"demo1234\"}"

TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"demo1234\"}" \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

ORDER_ID=$(curl -s -X POST $API/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"11111111-1111-4111-8111-000000000001","quantity":1}]}' \
  | sed -n 's/.*"orderId":"\([^"]*\)".*/\1/p')

# Thanh toán hai lần cùng Idempotency-Key: lần 2 có "reused":true và cùng paymentId
for i in 1 2; do
  curl -s -X POST $API/payments -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: demo-key-1' \
    -d "{\"orderId\":\"$ORDER_ID\",\"method\":\"WALLET\"}"; echo
done
```

### PowerShell (Windows)

```powershell
$api = "http://localhost:3000"
$mail = "demo$(Get-Random)@brewlite.local"

Invoke-RestMethod -Method Post -Uri "$api/auth/register" -ContentType "application/json" -Body (@{email=$mail; password="demo1234"} | ConvertTo-Json)
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType "application/json" -Body (@{email=$mail; password="demo1234"} | ConvertTo-Json)
$h = @{Authorization = "Bearer $($login.accessToken)"}

$order = Invoke-RestMethod -Method Post -Uri "$api/orders" -Headers $h -ContentType "application/json" -Body '{"items":[{"productId":"11111111-1111-4111-8111-000000000001","quantity":1}]}'
$id = $order.orderId

$k = @{"Idempotency-Key" = "demo-key-1"}
$body = (@{orderId=$id; method="WALLET"} | ConvertTo-Json)
$r1 = Invoke-RestMethod -Method Post -Uri "$api/payments" -Headers $k -ContentType "application/json" -Body $body
$r2 = Invoke-RestMethod -Method Post -Uri "$api/payments" -Headers $k -ContentType "application/json" -Body $body
"Lần 1: reused=$($r1.reused) paymentId=$($r1.payment.paymentId)"
"Lần 2: reused=$($r2.reused) paymentId=$($r2.payment.paymentId)"
```

Kết quả đúng: lần 1 `reused=False`, lần 2 `reused=True`, hai `paymentId` giống nhau. Thử thêm: thanh toán lần nữa với khóa khác cho cùng đơn phải trả `409`; bỏ header `Idempotency-Key` phải trả `400`.

## 10. Cơ sở dữ liệu

### 10.1. Model chính

`User`, `Product`, `ProductOption`, `Order`, `OrderItem`, `OrderItemOption`, `Payment`, `Promotion`, `LoyaltyTransaction`, `AuditLog` cùng các enum, theo [`class-diagram.puml`](./docs/diagrams/class-diagram.puml).

Điểm quan trọng:

- `Product.version`: khóa lạc quan khi cập nhật sản phẩm.
- `Payment @@unique(userId, orderId, idempotencyKey)`: chốt chặn cuối cho thanh toán lặp (FR-06).
- `LoyaltyTransaction @@unique(orderId, type)`: mỗi đơn tối đa 1 lần cộng và 1 lần hoàn điểm.
- `Promotion.code` và `Order.orderCode` là duy nhất.
- Check constraint: tồn kho, giá, tổng tiền không âm; `quantity > 0`.
- Giỏ hàng không có bảng trong DB: giỏ là state ở client (lưu `localStorage`, khóa `brewlite-cart`).

### 10.2. Migration và seed

- Migration nằm ở `apps/api/prisma/migrations/`.
- Docker tự chạy `prisma migrate deploy` và seed khi container API khởi động.
- Trên host: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.
- Xem dữ liệu bằng giao diện: `pnpm db:studio` (host) hoặc `docker compose exec db psql -U brewlite -d brewlite`.

## 11. Scripts

Chạy ở thư mục gốc (cần Node và pnpm trên host):

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `pnpm dev:api` | NestJS chế độ watch. |
| `pnpm dev:web` | Next.js ở cổng 3001. |
| `pnpm build` | Build toàn bộ workspace. |
| `pnpm lint` | ESLint cho API và Web. |
| `pnpm test` | Jest của API. |
| `pnpm format` / `pnpm format:check` | Prettier. |
| `pnpm prisma:generate` | Sinh Prisma Client. |
| `pnpm db:migrate` / `db:migrate:deploy` | `prisma migrate dev` / `deploy`. |
| `pnpm db:seed` / `db:reset` / `db:studio` | Seed, reset DB, mở Prisma Studio. |

## 12. Chạy kiểm thử

Test của API là **unit test và integration test dùng DB giả trong bộ nhớ**, không cần PostgreSQL chạy, nhưng cần Prisma Client đã được sinh (`pnpm prisma:generate`).

```bash
pnpm prisma:generate                                  # lần đầu, hoặc sau khi sửa schema.prisma
pnpm test                                             # toàn bộ test API, phải xanh hết
pnpm --filter @brewlite/api exec jest payments        # chỉ test có tên chứa "payments"
pnpm --filter @brewlite/web typecheck                 # kiểm tra kiểu TypeScript của web
pnpm lint
pnpm build
```

Chạy test trong container (không cần cài gì trên host):

```bash
docker compose exec api pnpm --filter @brewlite/api test
```

Các nhóm test chính: máy trạng thái đơn hàng (kiểm tra đủ 49 cặp trạng thái), dịch vụ đơn hàng, dịch vụ thanh toán, **idempotency của `POST /payments`** (`payments.idempotency.e2e.spec.ts`, gồm ca gửi hai lần cùng khóa và ca bấm đúp song song), đăng ký/đăng nhập.

**CI** (GitHub Actions, `.github/workflows/ci.yml`) chạy với mỗi Pull Request vào `main` hoặc `dev`: `pnpm install --frozen-lockfile` → `prisma generate` → `lint` → `test` → `build`. PR chưa xanh thì chưa gộp. Test của web (`apps/web/lib/cart-store.test.ts`) hiện chưa nằm trong CI.

Cả API lẫn web đều dùng ValidationPipe/Filter lỗi toàn cục, CORS đọc từ `CORS_ORIGIN`.

## 13. Quy trình làm việc nhóm

- Nhánh dùng chung là **`dev`**. Mỗi công việc làm trên **một nhánh riêng**, đặt tên `cvXX-ten-ngan` (ví dụ `cv17-idempotent-payments`).
- Mở **Pull Request vào `dev`** (không phải `main`), mô tả ngắn thay đổi và cách đã kiểm tra. CI phải xanh trước khi gộp.
- Trước khi tạo nhánh mới: `git checkout dev && git pull origin dev`.
- Nếu `pnpm-lock.yaml` bị xung đột khi gộp: chọn bản của `dev`, chạy `pnpm install` để sinh lại rồi commit. CI dùng `--frozen-lockfile` nên lockfile phải khớp `package.json`.

## 14. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
| :--- | :--- |
| Test hoặc VS Code báo thiếu `OrderStatus`, `Prisma.Decimal`, `Prisma.LogLevel`... từ `@prisma/client` | Prisma Client chưa được sinh trên máy. Chạy `pnpm prisma:generate`, rồi chạy lại test (VS Code: `Ctrl+Shift+P` → *TypeScript: Restart TS Server*). Cần chạy lại sau mỗi lần cài dependency mới hoặc sửa `schema.prisma`. |
| `docker compose up` báo cổng đã được sử dụng | Tắt chương trình đang chiếm cổng 3000/3001/5432, hoặc đổi `API_PORT`/`WEB_PORT`/`POSTGRES_PORT` trong `.env`. |
| Sau khi pull code mới, API hoặc Web báo thiếu module | Có dependency mới. Chạy `docker compose up --build`. |
| API không kết nối được DB sau khi đổi `POSTGRES_*` | Volume cũ giữ mật khẩu cũ: `docker compose down -v` rồi `docker compose up --build` (mất dữ liệu local). |
| Web không hiện món, báo lỗi tải dữ liệu | API chưa sẵn sàng hoặc `NEXT_PUBLIC_API_URL` sai. Kiểm tra http://localhost:3000/health; đổi URL thì phải build lại web. |
| PowerShell báo `npm.ps1 cannot be loaded because running scripts is disabled` | Chạy một lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `node` hoặc `pnpm` không nhận ra trên Windows | Chỉ cần khi chạy trên host. Cài Node.js LTS, mở lại terminal, chạy `corepack enable`. Dùng Docker thì bỏ qua. |
| Git cảnh báo `LF will be replaced by CRLF` | Chỉ là cảnh báo kiểu xuống dòng của Windows, không ảnh hưởng. |
| `POST /payments` trả `409` | Đơn không còn ở `PENDING` hoặc `PAYMENT_FAILED` (đã thanh toán, đang pha, đã hủy...). Tạo đơn mới để thử lại. |
| `POST /payments` trả `400` "Thiếu header Idempotency-Key" | Thêm header `Idempotency-Key` (xem mục 8). |

## 15. Tài liệu

| Nhóm | Tài liệu |
| :--- | :--- |
| Yêu cầu | [`context-and-scope.md`](./docs/requirements/context-and-scope.md), [`srs.md`](./docs/requirements/srs.md), [`use-case-checkout.md`](./docs/requirements/use-case-checkout.md) |
| Mô hình hóa | [`activity-checkout.puml`](./docs/diagrams/activity-checkout.puml), [`sequence-checkout.puml`](./docs/diagrams/sequence-checkout.puml), [`class-diagram.puml`](./docs/diagrams/class-diagram.puml) |
| Kiến trúc | [`architecture.md`](./docs/architecture/architecture.md), [`ADR`](./docs/architecture/adr/README.md), [`deployment.md`](./docs/deployment.md) |
| Truy vết | [`traceability-matrix.md`](./docs/traceability-matrix.md) |
