import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

type SeedProduct = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  stock: number;
};

type SeedOption = {
  name: string;
  type: 'SIZE' | 'TOPPING';
  priceAdjustment: number;
};

const PRODUCTS: SeedProduct[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    name: 'Cà phê sữa đá',
    description: 'Cà phê phin đậm vị, sữa đặc béo ngậy, đá mát lạnh.',
    basePrice: 29000,
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
    stock: 50,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'Cà phê đen đá',
    description: 'Cà phê nguyên chất rang mộc, hương thơm và hậu vị sâu.',
    basePrice: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
    stock: 50,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    name: 'Bạc xỉu',
    description: 'Nhiều sữa, ít cà phê, vị nhẹ nhàng dễ uống.',
    basePrice: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
    stock: 40,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    name: 'Trà sữa trân châu',
    description: 'Trà đen đậm vị kết hợp sữa tươi và trân châu dai giòn.',
    basePrice: 39000,
    imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=800&q=80',
    stock: 40,
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    name: 'Trà đào cam sả',
    description: 'Trà đào thơm, cam tươi và sả tạo vị chua ngọt sảng khoái.',
    basePrice: 35000,
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
    stock: 35,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    name: 'Matcha latte',
    description: 'Matcha Nhật Bản xay mịn, sữa tươi và lớp bọt mềm.',
    basePrice: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=800&q=80',
    stock: 30,
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    name: 'Sữa tươi trân châu đường đen',
    description: 'Sữa tươi mát lạnh, trân châu đường đen và sốt caramel.',
    basePrice: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=800&q=80',
    stock: 30,
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    name: 'Cacao nóng',
    description: 'Cacao đậm đà, sữa nóng và chút bột quế.',
    basePrice: 30000,
    imageUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=800&q=80',
    stock: 25,
  },
  {
    id: '11111111-1111-4111-8111-000000000009',
    name: 'Trà xanh chanh dây',
    description: 'Trà xanh thanh mát, chanh dây chua nhẹ và đá mát.',
    basePrice: 33000,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
    stock: 35,
  },
  {
    id: '11111111-1111-4111-8111-000000000010',
    name: 'Cà phê muối',
    description: 'Cà phê rang đậm với lớp kem muối mặn ngọt cân bằng.',
    basePrice: 35000,
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
    stock: 45,
  },
  {
    id: '11111111-1111-4111-8111-000000000011',
    name: 'Cold brew cam',
    description: 'Cold brew ủ lạnh 18 giờ kết hợp nước cam tươi.',
    basePrice: 38000,
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
    stock: 20,
  },
  {
    id: '11111111-1111-4111-8111-000000000012',
    name: 'Sữa chua cà phê',
    description: 'Sữa chua mát, cà phê đậm và thạch giòn.',
    basePrice: 36000,
    imageUrl: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=800&q=80',
    stock: 25,
  },
];

const SIZES: SeedOption[] = [
  { name: 'S', type: 'SIZE', priceAdjustment: 0 },
  { name: 'M', type: 'SIZE', priceAdjustment: 5000 },
  { name: 'L', type: 'SIZE', priceAdjustment: 10000 },
];

const TOPPINGS: SeedOption[] = [
  { name: 'Trân châu', type: 'TOPPING', priceAdjustment: 5000 },
  { name: 'Thạch trái cây', type: 'TOPPING', priceAdjustment: 5000 },
  { name: 'Kem cheese', type: 'TOPPING', priceAdjustment: 8000 },
];

function optionId(sequence: number): string {
  return `22222222-2222-4222-8222-${String(sequence).padStart(12, '0')}`;
}

async function seedProducts(): Promise<void> {
  let sequence = 1;

  for (const product of PRODUCTS) {
    // Product dùng productId làm khóa chính, không phải id.
    await prisma.product.upsert({
      where: {
        productId: product.id,
      },
      update: {
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
        stock: product.stock,
        status: 'ACTIVE',
      },
      create: {
        productId: product.id,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
        stock: product.stock,
        status: 'ACTIVE',
      },
    });

    for (const option of [...SIZES, ...TOPPINGS]) {
      await prisma.productOption.upsert({
        where: {
          productId_name_type: {
            productId: product.id,
            name: option.name,
            type: option.type,
          },
        },
        update: {
          priceAdjustment: option.priceAdjustment,
          isAvailable: true,
        },
        create: {
          optionId: optionId(sequence),
          productId: product.id,
          name: option.name,
          type: option.type,
          priceAdjustment: option.priceAdjustment,
          isAvailable: true,
        },
      });

      sequence += 1;
    }
  }
}

async function seedPromotions(): Promise<void> {
  await prisma.promotion.upsert({
    where: {
      code: 'WELCOME10',
    },
    update: {
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 20000,
      minimumOrderAmount: 50000,
      startAt: new Date('2026-01-01T00:00:00.000Z'),
      endAt: new Date('2027-12-31T23:59:59.000Z'),
      status: 'ACTIVE',
    },
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 20000,
      minimumOrderAmount: 50000,
      startAt: new Date('2026-01-01T00:00:00.000Z'),
      endAt: new Date('2027-12-31T23:59:59.000Z'),
      status: 'ACTIVE',
    },
  });
}

async function main(): Promise<void> {
  await seedProducts();
  await seedPromotions();

  const [productCount, optionCount, promotionCount] = await Promise.all([
    prisma.product.count(),
    prisma.productOption.count(),
    prisma.promotion.count(),
  ]);

  console.info(
    `Seed hoàn tất: ${productCount} sản phẩm, ${optionCount} tùy chọn, ${promotionCount} khuyến mãi.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });