# BrewLite

BrewLite là ứng dụng đặt đồ uống theo hướng **mobile-first / PWA**: khách xem menu, chọn size/topping, đặt đơn, thanh toán không tiền mặt và nhận tại quầy.

**Công nghệ:** Next.js (React, TypeScript, TailwindCSS) · NestJS · PostgreSQL (Prisma) · Docker · Zustand · TanStack Query.

## 1. Cấu trúc repository

```text
brewlite/
├── apps/
│   ├── api/                  # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/20261020120000_init/migration.sql
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── products/     # GET /products, GET /products/:id
│   │       ├── health/       # GET /health, GET /health/ready
│   │       ├── prisma/       # PrismaService/PrismaModule
│   │       ├── config/       # validate env khi khởi động
│   │       ├── common/       # filter lỗi thống nhất
│   │       ├── app.controller.ts
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── web/                  # Frontend Next.js (CV03)
│       ├── app/              # layout, menu, chi tiết món, giỏ hàng
│       ├── components/       # header, footer, product card/grid/detail
│       ├── lib/              # api client, Zustand cart, types, format
│       └── public/
├── docs/                     # Đặc tả, diagram, kiến trúc, ADR
├── Dockerfile.dev            # Image dev dùng chung cho API + Web
├── docker-compose.yml        # PostgreSQL + API + Web
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```


## 2. Yêu cầu môi trường

### Cách khuyến nghị – chạy hoàn toàn bằng Docker

Chỉ cần:

- **Docker Engine / Docker Desktop / OrbStack** đang chạy (Docker Compose v2; BuildKit mặc định).
- Không cần cài Node.js, pnpm, NestJS, Next.js hay PostgreSQL trên máy host.

### Cách tùy chọn – chạy trực tiếp trên host

Chỉ dùng khi bạn đã có sẵn Node.js >= 20.11 và pnpm. Không bắt buộc cho chế độ Docker.

## 4. Chạy toàn bộ bằng Docker (khuyến nghị)

### 4.1. Lần đầu

```bash
# Từ thư mục root của repository
docker compose up --build
```

Docker sẽ:
1. Tải base image `node:22-alpine` và `postgres:16-alpine`.
2. Cài pnpm + toàn bộ dependency **bên trong image**.
3. Generate Prisma Client.
4. Khởi động PostgreSQL, API và Web.
5. Container API tự chạy migration và seed idempotent trước khi start.

Sau khi thấy log API/Web sẵn sàng:

- Web: **http://localhost:3001**
- API: **http://localhost:3000**
- Kiểm tra API: **http://localhost:3000/health**

### 4.2. Các lần sau

```bash
# Chạy nền
docker compose up -d

# Xem log
docker compose logs -f api
docker compose logs -f web

# Dừng
docker compose down          # giữ dữ liệu PostgreSQL
docker compose down -v       # xoá luôn dữ liệu PostgreSQL
```

Nếu đổi `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` sau khi đã có volume, PostgreSQL giữ mật khẩu cũ. Khi đó cần reset volume:

```bash
docker compose down -v
docker compose up --build
```
Lệnh `down -v` **xoá dữ liệu local**. Chỉ dùng khi chấp nhận mất dữ liệu dev.

Khi thay đổi **dependency** (`package.json`, `pnpm-workspace.yaml`) hoặc `Dockerfile.dev`, build lại:

```bash
docker compose up --build
```

Docker dùng layer cache; chỉ phần dependency thay đổi mới được cài lại. Nếu cache bị lỗi mới cần `docker compose build --no-cache`.

### 4.3. Chạy lệnh Prisma trong container

```bash
docker compose exec api pnpm --filter @brewlite/api db:migrate:deploy
docker compose exec api pnpm --filter @brewlite/api db:seed
docker compose exec api pnpm --filter @brewlite/api prisma:generate
```

Tạo migration mới khi sửa `schema.prisma` (chạy trong container, migration được ghi vào thư mục đang mount):

```bash
docker compose exec api pnpm --filter @brewlite/api db:migrate
```

Reset toàn bộ DB rồi migrate + seed lại:

```bash
docker compose exec api pnpm --filter @brewlite/api db:reset
```

### 4.4. Kiểm tra nhanh

```bash
curl -i http://localhost:3000/
# HTTP/1.1 200 OK
# Hello

curl -s http://localhost:3000/products
curl -s http://localhost:3000/products/11111111-1111-4111-8111-000000000001
curl -i http://localhost:3000/health/ready
```

Đo thời gian phản hồi danh sách sản phẩm:

```bash
curl -o /dev/null -s -w 'HTTP %{http_code} – %{time_total}s\n' \
  http://localhost:3000/products
```

## 5. Chạy trực tiếp trên host (tùy chọn)

Chỉ dùng khi bạn đã cài Node.js + pnpm trên host và không muốn dùng Docker cho API/Web.

### 5.1. Chỉ chạy frontend

```bash
pnpm install --filter @brewlite/web...
pnpm dev:web
# http://localhost:3001
```

Layout, header, icon giỏ, trang giỏ hàng vẫn chạy; danh sách món sẽ báo lỗi nếu API chưa bật.

### 5.2. Full stack trên host

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

corepack enable
pnpm install

docker compose up -d db

pnpm prisma:generate
pnpm db:migrate
pnpm db:seed

pnpm dev:api   # terminal 1
pnpm dev:web   # terminal 2
```

> Khi chạy host, `docker compose up -d db` chỉ khởi động service `db`; API/Web chạy bằng pnpm ở host.

## 6. API hiện có

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/` | Trả chuỗi `Hello` |
| `GET` | `/health` | Liveness, không query DB (FR-14). |
| `GET` | `/health/ready` | Readiness, chạy `SELECT 1` trên PostgreSQL. |
| `GET` | `/products` | Danh sách món `ACTIVE`, kèm size/topping đang bán (FR-01). |
| `GET` | `/products/:id` | Chi tiết món + size/topping (FR-02). `404` nếu không có. |

`GET /products` chỉ chọn field cần cho menu, dùng index `Product(status)` và `Product(name)`, không N+1.

## 7. Cơ sở dữ liệu

### 7.1. Model chính

`User`, `Product`, `ProductOption`, `Order`, `OrderItem`, `OrderItemOption`, `Payment`, `Promotion`, `LoyaltyTransaction`, `AuditLog` cùng các enum theo `docs/diagrams/class-diagram.puml`.

Điểm quan trọng:

- `Product.version` – optimistic locking (mặc định `0`, tăng khi cập nhật sản phẩm).
- `Payment @@unique(userId, orderId, idempotencyKey)` – chặn xử lý thanh toán lặp (FR-06).
- `Payment(orderId, status)` – tìm giao dịch `PROCESSING` nhanh.
- `LoyaltyTransaction @@unique(orderId, type)` – mỗi đơn tối đa 1 `EARN`, 1 `REVERSAL`.
- `Promotion.code @unique`, `Order.orderCode @unique`.
- Check constraint: tồn kho, giá, số lượng và tổng tiền không âm; `quantity > 0`.
- `Cart`/`CartItem` **không có bảng** – giỏ hàng là state client (FR-03).

### 7.2. Migration và seed

- Migration: `apps/api/prisma/migrations/20261020120000_init/migration.sql`.
- Seed idempotent: 12 sản phẩm, mỗi sản phẩm 3 size + 3 topping, 1 khuyến mãi `WELCOME10`.
- Docker: tự chạy `prisma migrate deploy` + seed khi container API khởi động.
- Host: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.

## 8. Biến môi trường

### Docker Compose

| Biến | Mặc định | Ghi chú |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `brewlite` | User DB local. |
| `POSTGRES_PASSWORD` | `brewlite_local_only` | Chỉ dùng local. |
| `POSTGRES_DB` | `brewlite` | Tên database. |
| `POSTGRES_PORT` | `5432` | Cổng publish DB. |
| `API_PORT` | `3000` | Cổng API local. |
| `WEB_PORT` | `3001` | Cổng Web local. |
| `JWT_SECRET` | giá trị local | Production phải dùng secret riêng. |

Có thể copy `.env.example` thành `.env` nếu muốn đổi cổng/secret.

### API – `apps/api/.env` (chỉ khi chạy host)

`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` (≥ 32 ký tự), `CORS_ORIGIN`, `LOG_LEVEL`, `PAYMENT_PROVIDER`, `PAYMENT_MOCK_*`, `RUN_MIGRATIONS`.

Ở `development`, API có default local cho `DATABASE_URL`/`JWT_SECRET` để `GET /` vẫn chạy khi DB chưa khởi động. Ở `production`, thiếu `DATABASE_URL` hoặc `JWT_SECRET` sẽ **fail-fast**.

### Web – `apps/web/.env.local` (chỉ khi chạy host)

| Biến | Ví dụ | Ghi chú |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Được inline lúc build; đổi URL phải rebuild. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Tắt telemetry Next.js. |

## 9. Scripts (chạy trên host)

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `pnpm dev:api` | Chạy NestJS watch mode. |
| `pnpm dev:web` | Chạy Next.js (Webpack) ở cổng 3001. |
| `pnpm build` | Build toàn bộ workspace. |
| `pnpm lint` | ESLint cho API + Web. |
| `pnpm test` | Jest (API). |
| `pnpm format` / `pnpm format:check` | Prettier. |
| `pnpm db:migrate` | `prisma migrate dev`. |
| `pnpm db:seed` | Seed dữ liệu mẫu. |
| `pnpm db:reset` | Reset DB + migrate + seed. |
| `pnpm prisma:generate` | Generate Prisma Client. |

## 10. Kiểm thử và chất lượng

```bash
pnpm lint
pnpm --filter @brewlite/api test
pnpm --filter @brewlite/web typecheck
pnpm build
```

- ESLint 9 + Prettier ở root và từng app.
- ValidationPipe toàn cục: `whitelist`, `forbidNonWhitelisted`, `transform`.
- Filter lỗi trả thống nhất `{ statusCode, code, message, details?, path, timestamp }`.
- CORS đọc từ `CORS_ORIGIN` (Docker mặc định cho `localhost` và `127.0.0.1`).

## 11. Tài liệu

| Nhóm | Tài liệu |
| :--- | :--- |
| Yêu cầu (Task 1) | [`context-and-scope.md`](./docs/requirements/context-and-scope.md), [`srs.md`](./docs/requirements/srs.md), [`use-case-checkout.md`](./docs/requirements/use-case-checkout.md) |
| Mô hình hóa (Task 2) | [`activity-checkout.puml`](./docs/diagrams/activity-checkout.puml), [`sequence-checkout.puml`](./docs/diagrams/sequence-checkout.puml), [`class-diagram.puml`](./docs/diagrams/class-diagram.puml) |
| Kiến trúc (Task 3) | [`architecture.md`](./docs/architecture/architecture.md), [`ADR`](./docs/architecture/adr/README.md), [`deployment.md`](./docs/deployment.md) |
| Truy vết | [`traceability-matrix.md`](./docs/traceability-matrix.md) |
