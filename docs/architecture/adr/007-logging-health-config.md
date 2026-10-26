# ADR-007: JSON logging, health check và validate cấu hình

- **Trạng thái**: Accepted – thiết kế; hiện thực Task 4–5
- **Ngày**: 2026-10-19
- **Liên quan**: FR-14, NFR-02, NFR-04

## Bối cảnh

Cần biết container còn sống, DB có sẵn sàng và cấu hình sai phải fail sớm. Log dạng text khó lọc trên Render/GitHub Actions; secret không được lộ qua log. NFR-04 yêu cầu smoke test `GET /health`.

## Các lựa chọn đã cân nhắc

1. **JSON logger tự viết + `/health`, `/health/ready` + validate env bằng `class-validator`**.
2. Pino/Nest Terminus + OpenTelemetry.
3. Chỉ dùng Nest `Logger` mặc định, không health check.
4. Health check chỉ trả `ok`, không kiểm tra DB.

## Quyết định

Chọn phương án **1**:

- Log JSON một dòng/entry ra stdout: `timestamp`, `level`, `service`, `context`, `message`, `requestId`, `userId?`, `orderId?`.
- `LOG_LEVEL` điều chỉnh mức log; không log mật khẩu, JWT, `DATABASE_URL`, dữ liệu thẻ.
- `GET /health` là **liveness** bắt buộc, trả `200 {status:"ok"}`; dùng cho Docker HEALTHCHECK và smoke test NFR-04.
- `GET /health/ready` là **readiness** bổ sung: chạy `SELECT 1`, trả `200` hoặc `503`; dùng cho Render health check nếu cấu hình.
- `ConfigModule.forRoot({ isGlobal: true, validate })` với `class-validator`, fail-fast nếu thiếu/sai biến bắt buộc.
- `requestId` sinh ở middleware, trả header `X-Request-Id`, gắn vào log.

## Hệ quả

**Tích cực**

- Không thêm dependency; log parse được, dễ lọc trên Render.
- Health đúng vai trò liveness/readiness; deploy fail sớm khi thiếu env.
- Có correlation cơ bản để điều tra lỗi theo request.

**Tiêu cực**

- Chưa có metrics/tracing, sampling hay log shipping chuyên nghiệp.
- Health check DB có thể bị gọi quá thường xuyên nếu cấu hình sai.
- JSON logger tự viết cần kỷ luật redaction.

**Giảm thiểu**

- Không log object request/response thô; chỉ log field an toàn.
- Cấu hình health check interval hợp lý ở Render.
- Nâng lên Pino/OpenTelemetry khi có nhu cầu thật.
