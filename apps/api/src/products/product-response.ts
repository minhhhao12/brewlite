
import type { OptionType, Prisma, ProductStatus } from '@prisma/client';
import {
  effectiveStock,
  missingIngredients,
  type RecipeLine,
} from '../ingredients/domain/ingredient-policy';

export type ProductWithOptions = Prisma.ProductGetPayload<{
  include: { options: true; ingredients: { include: { ingredient: true } } };
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
  /** Số phần bán được thực tế = min(tồn kho món, số phần pha được theo nguyên liệu). */
  stock: number;
  /** Tên các nguyên liệu không đủ cho 1 phần. */
  missingIngredients: string[];
  status: ProductStatus;
  options: ProductOptionResponse[];
};

export function toRecipe(product: ProductWithOptions): RecipeLine[] {
  return product.ingredients.map((line) => ({
    ingredientId: line.ingredientId,
    name: line.ingredient.name,
    unit: line.ingredient.unit,
    quantityPerServing: Number(line.quantityPerServing),
    stock: Number(line.ingredient.stock),
  }));
}

export function toProductResponse(product: ProductWithOptions): ProductResponse {
  const recipe = toRecipe(product);
  const productStock = Math.max(0, Number(product.stock));
  const ingredientCapacity = effectiveStock(productStock, recipe);
  const availableStock = Math.min(
    productStock,
    Math.max(0, ingredientCapacity),
  );

  return {
    id: product.productId,
    name: product.name,
    description: product.description,
    price: product.basePrice.toNumber(),
    imageUrl: product.imageUrl,
    stock: availableStock,
    missingIngredients: missingIngredients(recipe),
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
