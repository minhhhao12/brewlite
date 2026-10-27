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

export type UserRole = 'CUSTOMER' | 'STAFF';

export type User = {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  loyaltyPoints?: number;
};

export type AuthResponse = {
  accessToken: string;
  tokenType?: string;
  user: User;
};

export type OrderItemOption = {
  id: string;
  orderItemId: string;
  optionName: string;
  optionType: OptionType;
  priceAdjustment: number | string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  imageUrl?: string;
  options?: OrderItemOption[];
};

export type Order = {
  id: string;
  orderCode: string;
  userId: string;
  subtotal: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  status: string;
  createdAt: string;
  items?: OrderItem[];
  promotion?: {
    code?: string;
    description?: string;
  } | null;
};

export type PaymentMethod = 'WALLET' | 'CARD';

export type Payment = {
  id: string;
  orderId: string;
  userId: string;
  idempotencyKey: string;
  amount: number | string;
  method: PaymentMethod;
  status: 'INITIATED' | 'PAID' | 'FAILED';
  transactionReference: string;
  createdAt?: string;
};

export type PaymentResponse = {
  payment: Payment;
  orderStatus: string;
  reused: boolean;
};
