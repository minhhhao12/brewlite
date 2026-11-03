import { Prisma } from '@prisma/client';
import { toProductResponse, type ProductWithOptions } from './product-response';

function product(
  stock: number,
  ingredients: Array<{ name: string; stock: number; perServing: number }>,
): ProductWithOptions {
  return {
    productId: 'p1',
    name: 'Matcha latte',
    description: '',
    basePrice: new Prisma.Decimal(42000),
    imageUrl: '',
    stock,
    version: 0,
    status: 'ACTIVE',
    options: [],
    ingredients: ingredients.map((line, index) => ({
      productId: 'p1',
      ingredientId: `i${index}`,
      quantityPerServing: line.perServing,
      ingredient: { ingredientId: `i${index}`, name: line.name, unit: 'g', stock: line.stock },
    })),
  } as unknown as ProductWithOptions;
}

describe('toProductResponse: món ngừng bán khi thiếu nguyên liệu', () => {
  it('món không có công thức giữ nguyên tồn kho và không thiếu gì', () => {
    const res = toProductResponse(product(30, []));
    expect(res.stock).toBe(30);
    expect(res.missingIngredients).toEqual([]);
  });

  it('đủ nguyên liệu: số bán được bị chặn bởi nguyên liệu cạn nhất', () => {
    // matcha 100g/5g = 20 phần, sữa 3000ml/150ml = 20 phần, tồn kho món 30 => 20
    const res = toProductResponse(
      product(30, [
        { name: 'Bột matcha', stock: 100, perServing: 5 },
        { name: 'Sữa tươi', stock: 3000, perServing: 150 },
      ]),
    );
    expect(res.stock).toBe(20);
    expect(res.missingIngredients).toEqual([]);
  });

  it('một nguyên liệu hết thì stock = 0 và nêu rõ nguyên liệu nào thiếu', () => {
    const res = toProductResponse(
      product(30, [
        { name: 'Bột matcha', stock: 0, perServing: 5 },
        { name: 'Sữa tươi', stock: 3000, perServing: 150 },
      ]),
    );
    expect(res.stock).toBe(0);
    expect(res.missingIngredients).toEqual(['Bột matcha']);
  });

  it('nguyên liệu dồi dào thì tồn kho món vẫn là giới hạn', () => {
    const res = toProductResponse(
      product(3, [{ name: 'Sữa tươi', stock: 99999, perServing: 150 }]),
    );
    expect(res.stock).toBe(3);
  });
});
