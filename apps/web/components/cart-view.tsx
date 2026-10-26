'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  MAX_ITEM_QUANTITY,
  selectCartCount,
  selectCartSubtotal,
  useCartHydrated,
  useCartStore,
} from '@/lib/cart-store';
import { formatVnd } from '@/lib/format';
import type { CartItem } from '@/lib/types';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12" aria-busy="true">
      <div className="h-5 w-36 animate-pulse rounded-full bg-coffee-100" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-full bg-coffee-100" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-coffee-100" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex gap-4 rounded-3xl border border-coffee-100 bg-white/70 p-4 sm:p-5"
            >
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-coffee-100 sm:h-24 sm:w-24" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-2/3 animate-pulse rounded-full bg-coffee-100" />
                <div className="h-4 w-1/3 animate-pulse rounded-full bg-coffee-100" />
                <div className="h-8 w-1/2 animate-pulse rounded-full bg-coffee-100" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-coffee-100 bg-white/70 p-6 lg:col-span-5 xl:col-span-4">
          <div className="space-y-4">
            <div className="h-6 w-1/2 animate-pulse rounded-full bg-coffee-100" />
            <div className="h-4 w-full animate-pulse rounded-full bg-coffee-100" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-coffee-100" />
            <div className="h-10 w-full animate-pulse rounded-full bg-coffee-100" />
            <div className="h-12 w-full animate-pulse rounded-full bg-coffee-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 lg:py-24">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-coffee-100/80 text-coffee-700">
        <svg
          aria-hidden="true"
          className="h-12 w-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
          <circle cx="10" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-coffee-900 sm:text-3xl">
        Giỏ hàng của bạn đang trống
      </h1>
      <p className="mt-3 text-sm leading-6 text-coffee-600 sm:text-base">
        Bạn chưa chọn đồ uống nào. Hãy khám phá thực đơn thơm ngon từ BrewLite và thêm món yêu thích
        nhé!
      </p>
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-coffee-800 px-7 py-3.5 text-sm font-semibold text-cream transition hover:bg-coffee-700"
        >
          <span aria-hidden="true">←</span> Khám phá menu ngay
        </Link>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempQty, setTempQty] = useState(String(item.quantity));

  const handleDecrement = () => {
    if (item.quantity <= 1) {
      onRemove(item.key);
    } else {
      onUpdateQuantity(item.key, item.quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (item.quantity < MAX_ITEM_QUANTITY) {
      onUpdateQuantity(item.key, item.quantity + 1);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(tempQty, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdateQuantity(item.key, parsed);
    } else {
      setTempQty(String(item.quantity));
    }
  };

  return (
    <article
      data-testid={`cart-item-${item.key}`}
      className="group rounded-3xl border border-coffee-100 bg-white/90 p-4 shadow-card transition hover:border-coffee-200 sm:p-5"
    >
      <div className="flex gap-4">
        <Link
          href={`/products/${item.productId}`}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-coffee-100 sm:h-24 sm:w-24"
          aria-label={`Xem lại ${item.productName}`}
        >
          <Image
            src={item.imageUrl}
            alt={item.productName}
            fill
            sizes="96px"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </Link>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-coffee-900 sm:text-lg">
                <Link
                  href={`/products/${item.productId}`}
                  className="transition hover:text-coffee-600"
                >
                  {item.productName}
                </Link>
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                {item.size ? (
                  <span className="inline-flex items-center rounded-lg bg-coffee-100 px-2 py-0.5 font-medium text-coffee-800">
                    Size {item.size.name}
                    {item.size.priceAdjustment > 0
                      ? ` (+${formatVnd(item.size.priceAdjustment)})`
                      : ''}
                  </span>
                ) : null}

                {item.toppings && item.toppings.length > 0 ? (
                  item.toppings.map((topping) => (
                    <span
                      key={topping.id}
                      className="inline-flex items-center rounded-lg bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-coffee-700"
                    >
                      +{topping.name} (+{formatVnd(topping.priceAdjustment)})
                    </span>
                  ))
                ) : (
                  <span className="text-coffee-500">Không có topping</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(item.key)}
              title="Xóa món này khỏi giỏ"
              aria-label={`Xóa ${item.productName} khỏi giỏ hàng`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-coffee-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-coffee-100/70 pt-3">
            <div>
              <p className="text-xs text-coffee-500">
                Đơn giá:{' '}
                <span className="font-medium text-coffee-700">{formatVnd(item.unitPrice)}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={item.quantity === 1 ? 'Xóa khỏi giỏ' : 'Giảm số lượng'}
                  className="grid h-8 w-8 place-items-center rounded-full border border-coffee-200 bg-white text-base font-semibold text-coffee-800 transition hover:bg-coffee-100 hover:border-coffee-300 active:scale-95"
                >
                  {item.quantity === 1 ? '🗑' : '−'}
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={isEditing ? tempQty : item.quantity}
                  onFocus={() => {
                    setIsEditing(true);
                    setTempQty(String(item.quantity));
                  }}
                  onChange={(e) => setTempQty(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  aria-label={`Số lượng ${item.productName}`}
                  className="h-8 w-11 rounded-lg border border-coffee-200 bg-white text-center text-sm font-semibold text-coffee-900 focus:border-coffee-800 focus:outline-none focus:ring-1 focus:ring-coffee-800"
                />

                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={item.quantity >= MAX_ITEM_QUANTITY}
                  aria-label="Tăng số lượng"
                  className="grid h-8 w-8 place-items-center rounded-full border border-coffee-200 bg-white text-base font-semibold text-coffee-800 transition hover:bg-coffee-100 hover:border-coffee-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-coffee-500">Thành tiền</span>
              <p className="text-base font-bold text-coffee-900 sm:text-lg">
                {formatVnd(item.unitPrice * item.quantity)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CartView() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const itemCount = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const hasHydrated = useCartHydrated();

  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  if (!hasHydrated) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyCart />;
  }

  const handleClearCart = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ món trong giỏ hàng?')) {
      clear();
    }
  };

  const handleCheckoutClick = () => {
    if (!token) {
      router.push('/login?redirect=/checkout');
    } else {
      router.push('/checkout');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-coffee-600 transition hover:text-coffee-900"
        >
          <span aria-hidden="true">←</span> Tiếp tục chọn món
        </Link>
        <button
          type="button"
          onClick={handleClearCart}
          className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-coffee-700 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Xóa tất cả
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-coffee-900 sm:text-3xl">
          Giỏ hàng của bạn
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          Đang có <span className="font-semibold text-coffee-900">{itemCount}</span> ly đồ uống
          trong giỏ hàng.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Danh sách món */}
        <section
          aria-label="Danh sách món trong giỏ hàng"
          className="space-y-4 lg:col-span-7 xl:col-span-8"
        >
          {items.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </section>

        {/* Tóm tắt đơn hàng & Tổng tiền */}
        <aside
          aria-label="Tóm tắt đơn hàng"
          className="sticky top-24 rounded-3xl border border-coffee-100 bg-white/95 p-6 shadow-card lg:col-span-5 xl:col-span-4"
        >
          <h2 className="text-lg font-semibold text-coffee-900">Tóm tắt đơn hàng</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between text-coffee-600">
              <span>Tổng số lượng</span>
              <span className="font-medium text-coffee-900">{itemCount} ly</span>
            </div>
            <div className="flex items-center justify-between text-coffee-600">
              <span>Tạm tính</span>
              <span className="font-medium text-coffee-900">{formatVnd(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-coffee-600">
              <span>Hình thức nhận</span>
              <span className="font-medium text-coffee-900">Nhận tại quầy</span>
            </div>
            <div className="flex items-center justify-between text-coffee-600">
              <span>Phí dịch vụ</span>
              <span className="font-semibold text-green-700">Miễn phí</span>
            </div>
          </div>

          <div className="my-5 border-t border-coffee-100" />

          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="text-base font-semibold text-coffee-900">Tổng thanh toán</span>
              <p className="text-xs text-coffee-500">Đã bao gồm VAT & tùy chọn</p>
            </div>
            <span
              data-testid="cart-total-price"
              className="text-2xl font-bold tracking-tight text-coffee-900"
            >
              {formatVnd(subtotal)}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleCheckoutClick}
              className="w-full rounded-full bg-coffee-800 py-3.5 text-center text-sm font-semibold text-cream transition hover:bg-coffee-700 shadow-sm"
            >
              Đặt hàng ngay
            </button>

            <Link
              href="/"
              className="block w-full rounded-full border border-coffee-200 bg-cream/40 py-3 text-center text-sm font-semibold text-coffee-800 transition hover:bg-coffee-100"
            >
              Tiếp tục chọn món
            </Link>
          </div>

          {checkoutNotice ? (
            <div
              role="status"
              className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs leading-relaxed text-amber-900"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-amber-600">ℹ</span>
                <span>{checkoutNotice}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-2 border-t border-coffee-100/60 pt-4 text-xs text-coffee-500">
            <p className="flex items-center gap-1.5">
              <span className="text-coffee-600">✓</span> Đồ uống pha tươi ngon sau khi đặt hàng
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-coffee-600">✓</span> Giỏ hàng được tự động lưu lại trên máy
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
