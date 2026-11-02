# Nguyên liệu ràng buộc món (tính năng bổ sung)

Món chỉ bán được khi **mọi nguyên liệu trong công thức đều còn đủ cho ít nhất 1 phần**. Nguyên liệu nào hết thì món dùng nguyên liệu đó tự ngừng bán, nhập lại nguyên liệu thì món tự bán lại.

## Dữ liệu

| Bảng | Ý nghĩa |
| :-- | :-- |
| `Ingredient` | Nguyên liệu: tên, đơn vị (`g`, `ml`, `quả`...), tồn kho `stock`. |
| `ProductIngredient` | Công thức: 1 phần món cần `quantityPerServing` của nguyên liệu nào. |
| `OrderIngredientUsage` | Lượng nguyên liệu đã trừ cho từng đơn, dùng để hoàn đúng khi hủy. |

Món không có dòng công thức nào thì không bị ràng buộc nguyên liệu (giữ nguyên hành vi cũ).

## Luật nghiệp vụ

- **Hiển thị menu** (`GET /products`, `GET /products/:id`): `stock` là số phần bán được thực tế, bằng số nhỏ hơn giữa tồn kho món và số phần nguyên liệu cho phép. Trường mới `missingIngredients` liệt kê nguyên liệu đang thiếu. `stock = 0` thì giao diện hiện "Hết hàng" và chặn thêm vào giỏ.
- **Đặt đơn** (`POST /orders`): cùng một giao dịch với trừ kho món, cộng dồn nguyên liệu cần cho cả đơn (các món dùng chung nguyên liệu được cộng lại) rồi trừ bằng điều kiện nguyên tử `stock >= cần`. Thiếu một nguyên liệu thì cả đơn bị từ chối (400), không trừ gì (rollback).
- **Đặt đồng thời**: điều kiện `stock >= cần` nằm ngay trong câu lệnh cập nhật nên nhiều đơn cùng đặt thì chỉ đơn nào còn đủ nguyên liệu mới qua, tồn kho nguyên liệu không bao giờ âm (cùng nguyên lý với CV18).
- **Hủy đơn** (`POST /orders/:id/cancel`): hoàn đúng lượng nguyên liệu đã ghi trong `OrderIngredientUsage`, kể cả khi công thức bị sửa sau khi đặt. Hủy lặp lại vẫn bị Order State Machine chặn nên không hoàn hai lần.

## API cho nhân viên (role `STAFF`)

| Phương thức | Đường dẫn | Chức năng |
| :-- | :-- | :-- |
| `GET` | `/ingredients` | Xem kho nguyên liệu và món nào dùng nguyên liệu đó |
| `PATCH` | `/ingredients/:id/stock` | Nhập thêm hoặc kiểm kê: body `{ "stock": 500 }` (số nguyên từ 0) |

Khách hàng gọi hai API này nhận 403.

## Giới hạn hiện tại

- Công thức tính theo **món**, chưa nhân theo size (ly L dùng cùng lượng với ly S) và chưa tính topping.
- Chưa có API tạo/sửa công thức; công thức mẫu nằm trong `apps/api/prisma/seed.ts`.
- `PATCH /orders/:id/status` sang `CANCELLED` (nhân viên) chưa hoàn kho, cả kho món lẫn nguyên liệu. Chỉ `POST /orders/:id/cancel` hoàn kho.

## Kiểm thử

- `ingredient-policy.spec.ts`: luật thuần (số phần pha được, nguyên liệu thiếu, cộng dồn).
- `orders.ingredients.e2e.spec.ts`: trừ nguyên liệu, rollback khi thiếu, nguyên liệu dùng chung, đặt đồng thời không âm kho, hoàn khi hủy.
- `product-response.spec.ts`, `ingredients.controller.spec.ts`: hiển thị món hết nguyên liệu, chỉ STAFF được quản lý kho.
