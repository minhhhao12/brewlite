import type { OptionType, Prisma, ProductStatus } from '@prisma/client';

export type ProductWithOptions = Prisma.ProductGetPayload<{
  include: { options: true };
}>;

export type ProductOptionResponse = {
  id: string;
  name: string;
  type: OptionType;
  priceAdjustment: number;
  isAvailable: boolean;
};

export type ProductResponse = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  status: ProductStatus;
  options: ProductOptionResponse[];
};

export function toProductResponse(product: ProductWithOptions): ProductResponse {
  return {
    id: product.productId,
    name: product.name,
    description: product.description,
    price: product.basePrice.toNumber(),
    imageUrl: product.imageUrl,
    stock: product.stock,
    status: product.status,
    options: product.options.map((option) => ({
      id: option.optionId,
      name: option.name,
      type: option.type,
      priceAdjustment: option.priceAdjustment.toNumber(),
      isAvailable: option.isAvailable,
    })),
  };
}
