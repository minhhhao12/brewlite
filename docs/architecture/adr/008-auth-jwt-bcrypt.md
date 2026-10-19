# ADR-008: Xác thực bằng JWT + Bcrypt

- **Trạng thái**: Accepted (kế hoạch Sprint 2; chưa có code)
- **Ngày**: 2026-10-19
## Bối cảnh
FR-04/NFR-02 yêu cầu đăng ký/đăng nhập, bảo vệ `POST /orders`, `POST /payments`, `GET /orders/me`; mật khẩu không lưu plaintext; role lấy từ DB.

## Các lựa chọn đã cân nhắc
1. JWT stateless + Bcrypt, guard NestJS.
2. Session cookie server-side.
3. OAuth2/OIDC qua provider ngoài.
4. Magic link/OTP.

## Quyết định
Chọn phương án 1. `POST /auth/register` băm Bcrypt (salt rounds ≥ 10); `POST /auth/login` trả JWT chứa `userId`, `email`, `role`; `JwtAuthGuard` + `RolesGuard` bảo vệ route. `JWT_SECRET` validate tối thiểu 32 ký tự.

## Hệ quả
- **Tích cực**: đơn giản, phù hợp REST/PWA; không cần lưu session; role lấy từ DB nên không tin client.
- **Tiêu cực**: token hết hạn không thu hồi ngay; cần chiến lược refresh/rotation; XSS có thể đánh cắp token nếu lưu localStorage.
- **Giảm thiểu**: expiry ngắn (`JWT_EXPIRES_IN=1h`), không log token, cân nhắc httpOnly cookie nếu đổi mô hình; chưa triển khai trong skeleton.
