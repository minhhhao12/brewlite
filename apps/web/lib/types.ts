export type OptionType = 'SIZE' | 'TOPPING';

export type ProductOption = {
  id: string;
  name: string;
  type: OptionType;
  priceAdjustment: number;
  isAvailable: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  status: 'ACTIVE' | 'HIDDEN';
  options: ProductOption[];
};

export type CartItem = {
  key: string;
  productId: string;
  productName: string;
  imageUrl: string;
  size: ProductOption | null;
  toppings: ProductOption[];
  quantity: number;
  unitPrice: number;
};
