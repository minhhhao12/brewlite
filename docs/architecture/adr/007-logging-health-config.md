# ADR-007: JSON logging, health check và validate cấu hình

- **Trạng thái**: Accepted (đã áp dụng)
- **Ngày**: 2026-10-19
## Bối cảnh
Cần biết container còn sống, DB có sẵn sàng và cấu hình sai phải fail sớm. Log dạng text khó lọc trên Render/GitHub Actions; secret không được lộ qua log.

## Các lựa chọn đã cân nhắc
1. `JsonLogger` tự viết + `/health`, `/health/ready` + `class-validator` validate env.
2. Pino/Nest Terminus + OpenTelemetry.
3. Chỉ dùng Nest `Logger` mặc định, không health check.
4. Health check chỉ trả `ok`, không kiểm tra DB.

## Quyết định
Chọn phương án 1. Log JSON ra stdout; `/health` là liveness; `/health/ready` chạy `SELECT 1` và trả 503 khi DB lỗi; `ConfigModule.forRoot({ validate })` dừng app nếu env sai.

## Hệ quả
- **Tích cực**: không thêm dependency; log parse được; health đúng vai trò; deploy fail sớm khi thiếu `DATABASE_URL`.
- **Tiêu cực**: chưa có request-id/correlation, metrics, tracing; health check DB có thể bị gọi quá thường xuyên; JSON logger tự viết chưa có sampling/redaction.
- **TODO**: thêm request-id và redaction khi có auth/payment thật; không log token, mật khẩu, connection string.
