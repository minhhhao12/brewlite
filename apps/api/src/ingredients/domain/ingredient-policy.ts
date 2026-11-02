/**
 * Luật nguyên liệu (thuần logic, không đụng DB nên dễ test).
 *
 * - Công thức: 1 phần món cần `quantityPerServing` của mỗi nguyên liệu.
 * - Món không có công thức thì không bị ràng buộc nguyên liệu.
 * - Một nguyên liệu thiếu (không đủ cho 1 phần) thì món đó ngừng bán.
 */

export type RecipeLine = {
  ingredientId: string;
  name: string;
  unit: string;
  quantityPerServing: number;
  /** Tồn kho hiện tại của nguyên liệu, cùng đơn vị với `unit`. */
  stock: number;
};

export type IngredientRequirement = {
  ingredientId: string;
  name: string;
  unit: string;
  need: number;
};

/**
 * Số phần tối đa pha được theo nguyên liệu: lấy nguyên liệu "cạn nhất" làm chuẩn.
 * Trả `null` nếu món không có công thức (không bị giới hạn bởi nguyên liệu).
 */
export function maxServings(recipe: readonly RecipeLine[]): number | null {
  if (recipe.length === 0) return null;
  return Math.min(
    ...recipe.map((line) => Math.floor(Math.max(0, line.stock) / line.quantityPerServing)),
  );
}

/** Tên các nguyên liệu không đủ để pha dù chỉ 1 phần (lý do món hết hàng). */
export function missingIngredients(recipe: readonly RecipeLine[]): string[] {
  return recipe.filter((line) => line.stock < line.quantityPerServing).map((line) => line.name);
}

/**
 * Số lượng bán được thực tế: nhỏ hơn giữa tồn kho món và số phần nguyên liệu cho phép.
 */
export function effectiveStock(productStock: number, recipe: readonly RecipeLine[]): number {
  const byIngredients = maxServings(recipe);
  return byIngredients === null ? productStock : Math.min(productStock, byIngredients);
}

/**
 * Gom tổng nguyên liệu cần cho cả đơn. Các món dùng chung một nguyên liệu (ví dụ sữa tươi)
 * được cộng dồn để kiểm tra một lần, tránh đủ cho từng món riêng nhưng thiếu khi cộng lại.
 * Kết quả sắp theo ingredientId để mọi giao dịch khóa dòng cùng một thứ tự (tránh deadlock).
 */
export function aggregateRequirements(
  items: ReadonlyArray<{ productId: string; quantity: number }>,
  recipes: ReadonlyMap<string, readonly RecipeLine[]>,
): IngredientRequirement[] {
  const totals = new Map<string, IngredientRequirement>();

  for (const item of items) {
    for (const line of recipes.get(item.productId) ?? []) {
      const existing = totals.get(line.ingredientId);
      const need = line.quantityPerServing * item.quantity;
      if (existing) {
        existing.need += need;
      } else {
        totals.set(line.ingredientId, {
          ingredientId: line.ingredientId,
          name: line.name,
          unit: line.unit,
          need,
        });
      }
    }
  }

  return [...totals.values()].sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
}
