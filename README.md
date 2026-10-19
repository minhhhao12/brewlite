# BrewLite

BrewLite là ứng dụng đặt đồ uống theo hướng **mobile-first / PWA**: khách hàng xem menu, chọn size/topping, đặt đơn, thanh toán không tiền mặt và theo dõi trạng thái đơn để nhận tại quầy.

**Công nghệ dự kiến:** Next.js (React, TypeScript) · NestJS · PostgreSQL (Prisma) · Docker · GitHub Actions.

## Tài liệu

| Nhóm | Tài liệu |
| :--- | :--- |
| Yêu cầu (Task 1) | [`context-and-scope.md`](./docs/requirements/context-and-scope.md), [`srs.md`](./docs/requirements/srs.md), [`use-case-checkout.md`](./docs/requirements/use-case-checkout.md) |
| Mô hình hóa (Task 2) | [`activity-checkout.puml`](./docs/diagrams/activity-checkout.puml), [`sequence-checkout.puml`](./docs/diagrams/sequence-checkout.puml), [`class-diagram.puml`](./docs/diagrams/class-diagram.puml) |
| Kiến trúc (Task 3) | [`architecture.md`](./docs/architecture/architecture.md), [`ADR`](./docs/architecture/adr/README.md), [`deployment.md`](./docs/deployment.md), [`deployment.puml`](./docs/diagrams/deployment.puml), [`deployment.svg`](./docs/diagrams/deployment.svg) |
| Kế hoạch (Task 4–5) | [`backlog.md`](./docs/backlog.md) – backlog, phân công, Definition of Done và checklist nghiệm thu |
| Truy vết | [`traceability-matrix.md`](./docs/traceability-matrix.md) |

## Trạng thái

- **Task 1–2:** hoàn thành tài liệu yêu cầu, use case và Activity/Sequence/Class diagram.
- **Task 3:** hoàn thành thiết kế kiến trúc, bộ ADR và deployment diagram.
- **Task 4–5:** mã nguồn `apps/web`, `apps/api`, CI/CD và production sẽ được hiện thực tiếp theo kiến trúc đã chốt.

Hướng dẫn chạy local, test, build, deploy và rollback sẽ được bổ sung ở Task 4.1 và Task 5.4.
