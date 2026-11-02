import {
  aggregateRequirements,
  effectiveStock,
  maxServings,
  missingIngredients,
  type RecipeLine,
} from './ingredient-policy';

const milk = (stock: number, perServing = 150): RecipeLine => ({
  ingredientId: 'ing-milk',
  name: 'Sữa tươi',
  unit: 'ml',
  quantityPerServing: perServing,
  stock,
});

const matcha = (stock: number): RecipeLine => ({
  ingredientId: 'ing-matcha',
  name: 'Bột matcha',
  unit: 'g',
  quantityPerServing: 5,
  stock,
});

describe('ingredient-policy', () => {
  describe('maxServings', () => {
    it('món không có công thức thì không bị giới hạn (null)', () => {
      expect(maxServings([])).toBeNull();
    });

    it('lấy nguyên liệu cạn nhất làm chuẩn', () => {
      // sữa đủ 4 phần (600/150), matcha đủ 2 phần (10/5) => 2 phần
      expect(maxServings([milk(600), matcha(10)])).toBe(2);
    });

    it('trả 0 khi một nguyên liệu không đủ cho 1 phần', () => {
      expect(maxServings([milk(149), matcha(100)])).toBe(0);
    });

    it('tồn kho âm (dữ liệu lỗi) vẫn coi là 0, không ra số âm', () => {
      expect(maxServings([milk(-5)])).toBe(0);
    });
  });

  describe('missingIngredients', () => {
    it('chỉ liệt kê nguyên liệu không đủ cho 1 phần', () => {
      expect(missingIngredients([milk(100), matcha(50)])).toEqual(['Sữa tươi']);
    });

    it('đủ hết thì danh sách rỗng', () => {
      expect(missingIngredients([milk(150), matcha(5)])).toEqual([]);
    });

    it('hết hẳn một nguyên liệu (stock = 0) vẫn bị liệt kê', () => {
      expect(missingIngredients([milk(0)])).toEqual(['Sữa tươi']);
    });
  });

  describe('effectiveStock', () => {
    it('không có công thức thì bằng tồn kho món', () => {
      expect(effectiveStock(30, [])).toBe(30);
    });

    it('lấy số nhỏ hơn giữa tồn kho món và số phần nguyên liệu cho phép', () => {
      expect(effectiveStock(30, [milk(600)])).toBe(4);
      expect(effectiveStock(3, [milk(6000)])).toBe(3);
    });

    it('nguyên liệu hết thì bán được 0 dù món còn kho', () => {
      expect(effectiveStock(30, [milk(0)])).toBe(0);
    });
  });

  describe('aggregateRequirements', () => {
    const recipes = new Map<string, RecipeLine[]>([
      ['p-matcha', [milk(1000), matcha(100)]],
      ['p-latte', [milk(1000, 200)]],
    ]);

    it('nhân công thức với số lượng đặt', () => {
      const result = aggregateRequirements([{ productId: 'p-matcha', quantity: 2 }], recipes);
      expect(result).toEqual([
        { ingredientId: 'ing-matcha', name: 'Bột matcha', unit: 'g', need: 10 },
        { ingredientId: 'ing-milk', name: 'Sữa tươi', unit: 'ml', need: 300 },
      ]);
    });

    it('cộng dồn nguyên liệu dùng chung giữa các món trong cùng đơn', () => {
      const result = aggregateRequirements(
        [
          { productId: 'p-matcha', quantity: 1 }, // sữa 150
          { productId: 'p-latte', quantity: 2 }, // sữa 400
        ],
        recipes,
      );
      expect(result.find((r) => r.ingredientId === 'ing-milk')?.need).toBe(550);
    });

    it('món không có công thức thì không sinh yêu cầu nguyên liệu', () => {
      expect(
        aggregateRequirements([{ productId: 'p-khong-cong-thuc', quantity: 5 }], recipes),
      ).toEqual([]);
    });

    it('sắp xếp theo ingredientId để khóa dòng cùng thứ tự', () => {
      const ids = aggregateRequirements([{ productId: 'p-matcha', quantity: 1 }], recipes).map(
        (r) => r.ingredientId,
      );
      expect(ids).toEqual([...ids].sort());
    });
  });
});
