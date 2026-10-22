'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem, Product, ProductOption } from './types';

export const MAX_ITEM_QUANTITY = 20;

type CartState = {
  items: CartItem[];
  hasHydrated: boolean;
  addItem: (
    product: Product,
    size: ProductOption | null,
    toppings: ProductOption[],
    quantity?: number,
  ) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
};

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

function calculateUnitPrice(
  product: Product,
  size: ProductOption | null,
  toppings: ProductOption[],
): number {
  return (
    product.price +
    (size?.priceAdjustment ?? 0) +
    toppings.reduce((sum, topping) => sum + topping.priceAdjustment, 0)
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,

      addItem: (product, size, toppings, quantity = 1) =>
        set((state) => {
          const toppingIds = toppings.map((topping) => topping.id).sort();
          const key = [product.id, size?.id ?? 'no-size', ...toppingIds].join(':');
          const existing = state.items.find((item) => item.key === key);
          const safeQuantity = clampQuantity(quantity);

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.key === key
                  ? {
                      ...item,
                      quantity: Math.min(MAX_ITEM_QUANTITY, item.quantity + safeQuantity),
                    }
                  : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                key,
                productId: product.id,
                productName: product.name,
                imageUrl: product.imageUrl,
                size,
                toppings,
                quantity: safeQuantity,
                unitPrice: calculateUnitPrice(product, size, toppings),
              },
            ],
          };
        }),

      updateQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.key !== key)
              : state.items.map((item) =>
                  item.key === key ? { ...item, quantity: clampQuantity(quantity) } : item,
                ),
        })),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((item) => item.key !== key),
        })),

      clear: () => set({ items: [] }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'brewlite-cart',
      version: 1,
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export const selectCartCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

/**
 * Hook để kiểm tra xem store đã được hydrate trên client chưa.
 * Giúp tránh hydration mismatch giữa SSR và Client (đặc biệt khi có dữ liệu trong localStorage).
 */
export function useCartHydrated(): boolean {
  const [mounted, setMounted] = useState(false);
  const storeHydrated = useCartStore((state) => state.hasHydrated);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    mounted &&
    (storeHydrated ||
      (typeof useCartStore.persist !== 'undefined' && useCartStore.persist.hasHydrated()))
  );
}
