import { getStoredToken } from './auth-store';
import type {
  AuthResponse,
  OptionType,
  Order,
  PaymentMethod,
  PaymentResponse,
  Product,
  ProductOption,
} from './types';
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
type RawOption = {
  id: string;
  name: string;
  type: OptionType;
  priceAdjustment: number | string;
  isAvailable: boolean;
};

type RawProduct = {
  id: string;
  name: string;
  description?: string;
  price?: number | string;
  basePrice?: number | string;
  imageUrl?: string;
  stock?: number;
  status?: 'ACTIVE' | 'HIDDEN';
  options?:
    | ProductOption[]
    | {
        sizes?: RawOption[];
        toppings?: RawOption[];
      };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Tự động gắn JWT Token vào Authorization header nếu đã đăng nhập (CV11 requirement)
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ghi đè hoặc bổ sung headers từ init
  if (init?.headers) {
    const customHeaders = init.headers as Record<string, string>;
    Object.assign(headers, customHeaders);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `API trả về lỗi ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Response lỗi không phải JSON – giữ message mặc định.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  getProducts: async (): Promise<Product[]> => {
    const list = await request<RawProduct[]>('/products');
    return list.map((raw) => {
      let optionsList: ProductOption[] = [];
      if (Array.isArray(raw.options)) {
        optionsList = raw.options;
      } else if (raw.options && typeof raw.options === 'object') {
        const sizes = (raw.options.sizes ?? []).map((s) => ({
          ...s,
          priceAdjustment: Number(s.priceAdjustment),
        }));
        const toppings = (raw.options.toppings ?? []).map((t) => ({
          ...t,
          priceAdjustment: Number(t.priceAdjustment),
        }));
        optionsList = [...sizes, ...toppings];
      }

      return {
        id: raw.id,
        name: raw.name,
        description: raw.description ?? '',
        price: Number(raw.price ?? raw.basePrice ?? 0),
        imageUrl: raw.imageUrl ?? '',
        stock: raw.stock ?? 0,
        status: raw.status ?? 'ACTIVE',
        options: optionsList,
      };
    });
  },

  getProduct: async (id: string): Promise<Product> => {
    const raw = await request<RawProduct>(`/products/${encodeURIComponent(id)}`);
    let optionsList: ProductOption[] = [];
    if (Array.isArray(raw.options)) {
      optionsList = raw.options;
    } else if (raw.options && typeof raw.options === 'object') {
      const sizes = (raw.options.sizes ?? []).map((s) => ({
        ...s,
        priceAdjustment: Number(s.priceAdjustment),
      }));
      const toppings = (raw.options.toppings ?? []).map((t) => ({
        ...t,
        priceAdjustment: Number(t.priceAdjustment),
      }));
      optionsList = [...sizes, ...toppings];
    }

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? '',
      price: Number(raw.price ?? raw.basePrice ?? 0),
      imageUrl: raw.imageUrl ?? '',
      stock: raw.stock ?? 0,
      status: raw.status ?? 'ACTIVE',
      options: optionsList,
    };
  },

  // Xác thực người dùng (CV11 / CV08)
  login: (email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  register: async (email: string, password: string, username?: string): Promise<AuthResponse> => {
    await request<{ id: string; email: string; username: string; role: string }>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    return api.login(email, password);
  },

  // API Đơn hàng cần Token (CV11 / CV16)
  getMyOrders: (): Promise<Order[]> => request<Order[]>('/orders/me'),

  getOrderById: (id: string): Promise<Order> => request<Order>(`/orders/${encodeURIComponent(id)}`),

  cancelOrder: (id: string): Promise<Order> =>
    request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  createOrder: (payload: {
    items: Array<{
      productId: string;
      quantity: number;
      sizeOptionId?: string;
      toppingOptionIds?: string[];
    }>;
    promoCode?: string;
  }): Promise<Order> =>
    request<Order>('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // API Thanh toán đơn hàng có Idempotency-Key 
  createPayment: (
    payload: {
      orderId: string;
      method: PaymentMethod;
      simulateFailure?: boolean;
    },
    idempotencyKey: string,
  ): Promise<PaymentResponse> =>
    request<PaymentResponse>('/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        orderId: payload.orderId,
        method: payload.method,
        simulateFailure: payload.simulateFailure,
        idempotencyKey,
      }),
    }),

  // Kiểm tra mã khuyến mãi và tính trước giảm giá (CV21)
  validatePromotion: (
    code: string,
    subtotal: number,
  ): Promise<{
    valid: boolean;
    code: string;
    discountAmount: number;
    message?: string;
  }> =>
    request('/promotions/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    }),
};

export { API_URL };
