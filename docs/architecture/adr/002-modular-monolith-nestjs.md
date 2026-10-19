# ADR-002: Modular monolith với NestJS

- **Trạng thái**: Accepted (module khung đã có, nghiệp vụ TODO Sprint 2)
- **Ngày**: 2026-10-19

## Bối cảnh
BrewLite có các domain auth, users, products, orders, payments, promotions, loyalty. Quy mô đồ án nhỏ, nhưng cần ranh giới rõ để dễ đọc, dễ test và có thể tách sau này.

## Các lựa chọn đã cân nhắc
1. Một NestJS API chia module theo domain (modular monolith).
2. Microservices: web, auth, order, payment, notification riêng.
3. Một codebase không chia module, controller gọi Prisma trực tiếp.

## Quyết định
Chọn phương án 1. Mỗi domain là một `@Module` trong `apps/api/src/<domain>/`; controller → service → repository; `Order` state machine là nguồn transition duy nhất. Không dùng message queue hay service discovery.

## Hệ quả
- **Tích cực**: transaction ACID trong một DB; deploy một container; debug và trace đơn giản; ranh giới module đủ rõ cho Sprint 2.
- **Tiêu cực**: một API là single point of failure; không scale độc lập payment/order; dễ vi phạm ranh giới nếu service import chéo.
- **Kiểm soát**: review dependency giữa module; chỉ gọi qua public service/interface; tách service khi có nhu cầu tải thật.
