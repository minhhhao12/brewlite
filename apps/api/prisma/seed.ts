import { PrismaClient } from '@prisma/client';

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
    imageUrl:
      'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
    stock: 50,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'Cà phê đen đá',
    description: 'Cà phê nguyên chất rang mộc, hương thơm và hậu vị sâu.',
    basePrice: 25000,
    imageUrl:
      'https://images.unsplash.com/photo-1618183507099-4fa269f9b0ee?auto=format&fit=crop&w=800&q=80',
    stock: 50,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    name: 'Bạc xỉu',
    description: 'Nhiều sữa, ít cà phê, vị nhẹ nhàng dễ uống.',
    basePrice: 32000,
    imageUrl:
      'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
    stock: 40,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    name: 'Trà sữa trân châu',
    description: 'Trà đen đậm vị kết hợp sữa tươi và trân châu dai giòn.',
    basePrice: 39000,
    imageUrl:
      'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=800&q=80',
    stock: 40,
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    name: 'Trà đào cam sả',
    description: 'Trà đào thơm, cam tươi và sả tạo vị chua ngọt sảng khoái.',
    basePrice: 35000,
    imageUrl:
      'https://images.unsplash.com/photo-1676693420436-7fa448f054eb?auto=format&fit=crop&w=800&q=80',
    stock: 35,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    name: 'Matcha latte',
    description: 'Matcha Nhật Bản xay mịn, sữa tươi và lớp bọt mềm.',
    basePrice: 42000,
    imageUrl:
      'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=800&q=80',
    stock: 30,
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    name: 'Sữa tươi trân châu đường đen',
    description: 'Sữa tươi mát lạnh, trân châu đường đen và sốt caramel.',
    basePrice: 45000,
    imageUrl:
      'https://images.unsplash.com/photo-1624781708944-041f4b7e4d09?auto=format&fit=crop&w=800&q=80',
    stock: 30,
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    name: 'Cacao nóng',
    description: 'Cacao đậm đà, sữa nóng và chút bột quế.',
    basePrice: 30000,
    imageUrl:
      'https://images.unsplash.com/photo-1637572815755-c4b80092dce1?auto=format&fit=crop&w=800&q=80',
    stock: 25,
  },
  {
    id: '11111111-1111-4111-8111-000000000009',
    name: 'Trà xanh chanh dây',
    description: 'Trà xanh thanh mát, chanh dây chua nhẹ và đá mát.',
    basePrice: 33000,
    imageUrl:
      'https://images.unsplash.com/photo-1786783506825-1bdc1d2acd72?auto=format&fit=crop&w=800&q=80',
    stock: 35,
  },
  {
    id: '11111111-1111-4111-8111-000000000010',
    name: 'Cà phê muối',
    description: 'Cà phê rang đậm với lớp kem muối mặn ngọt cân bằng.',
    basePrice: 35000,
    imageUrl:
      'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
    stock: 45,
  },
  {
    id: '11111111-1111-4111-8111-000000000011',
    name: 'Cold brew cam',
    description: 'Cold brew ủ lạnh 18 giờ kết hợp nước cam tươi.',
    basePrice: 38000,
    imageUrl:
      'https://images.unsplash.com/photo-1603048004567-8109c99d4e7d?auto=format&fit=crop&w=800&q=80',
    stock: 20,
  },
  {
    id: '11111111-1111-4111-8111-000000000012',
    name: 'Sữa chua cà phê',
    description: 'Sữa chua mát, cà phê đậm và thạch giòn.',
    basePrice: 36000,
    imageUrl:
      'https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=800&q=80',
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
  await seedPaymentTestData();

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

async function seedPaymentTestData(): Promise<void> {
  const testUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const productId = '11111111-1111-4111-8111-000000000001';

  const orders = [
    {
      orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      orderCode: 'TEST-PAY-001',
    },
    {
      orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      orderCode: 'TEST-PAY-002',
    },
  ];

  // Tạo user kiểm thử. Không dùng tài khoản này để đăng nhập thật.
  await prisma.user.upsert({
    where: { email: 'payment-test@brewlite.local' },
    update: {},
    create: {
      userId: testUserId,
      username: 'payment-test',
      email: 'payment-test@brewlite.local',
      passwordHash: 'NOT_FOR_LOGIN',
      role: 'CUSTOMER',
      isActive: true,
    },
  });

  const product = await prisma.product.findUnique({
    where: { productId },
  });

  if (!product) {
    throw new Error('Không tìm thấy sản phẩm thử nghiệm. Hãy chạy seedProducts() trước.');
  }

  for (const orderData of orders) {
    const existingOrder = await prisma.order.findUnique({
      where: { orderId: orderData.orderId },
    });

    if (existingOrder) {
      console.info(`Giữ nguyên đơn hàng ${existingOrder.orderCode}`);
      continue;
    }

    const quantity = 1;
    const unitPrice = Number(product.basePrice);
    const subtotal = unitPrice * quantity;

    await prisma.order.create({
      data: {
        orderId: orderData.orderId,
        orderCode: orderData.orderCode,
        userId: testUserId,
        subtotal,
        discountAmount: 0,
        totalAmount: subtotal,
        status: 'PENDING',
        items: {
          create: {
            productId,
            productName: product.name,
            quantity,
            unitPrice,
            subtotal,
          },
        },
      },
    });

    console.info(`Đã tạo đơn hàng ${orderData.orderCode}`);
  }
}
