'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { selectCartCount, selectCartSubtotal, useCartStore } from '@/lib/cart-store';
import { formatVnd } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function CartPage() {
  const router = useRouter();

  // Cart Store
  const items = useCartStore((state) => state.items);
  const cartHydrated = useCartStore((state) => state.hasHydrated);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const itemCount = useCartStore(selectCartCount);
  const totalAmount = useCartStore(selectCartSubtotal);

  // Auth Store
  const user = useAuthStore((state) => state.user);
  const authHydrated = useAuthStore((state) => state.hasHydrated);

  // Local state
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Order history (to test GET /orders/me with JWT)
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Tải danh sách đơn hàng của người dùng nếu đã đăng nhập
  useEffect(() => {
    if (authHydrated && user) {
      setLoadingOrders(true);
      api
        .getMyOrders()
        .then((orders) => setMyOrders(orders))
        .catch((err) => console.error('Không thể tải lịch sử đơn hàng:', err))
        .finally(() => setLoadingOrders(false));
    }
  }, [authHydrated, user]);

  async function handleCheckout() {
    setOrderError(null);

    // Nếu chưa đăng nhập, chuyển hướng sang trang đăng nhập kèm tham số redirect về /cart
    if (!user) {
      router.push('/login?redirect=/cart');
      return;
    }

    if (items.length === 0) return;

    setIsOrdering(true);
    try {
      const payload = {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          sizeOptionId: item.size?.id,
          toppingOptionIds: item.toppings.map((t) => t.id),
        })),
      };

      // Gọi API POST /orders với Authorization: Bearer <token> tự động đính kèm
      const order = await api.createOrder(payload);
      setPlacedOrder(order);
      clear();

      // Cập nhật lại danh sách đơn hàng
      api.getMyOrders().then((list) => setMyOrders(list)).catch(() => {});
    } catch (err) {
      if (err instanceof ApiError) {
        setOrderError(err.message || 'Không thể tạo đơn hàng.');
      } else {
        setOrderError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsOrdering(false);
    }
  }

  if (!cartHydrated) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="h-8 w-40 animate-pulse rounded bg-coffee-100" />
        <div className="mt-6 space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-coffee-50" />
          <div className="h-24 animate-pulse rounded-2xl bg-coffee-50" />
        </div>
      </main>
    );
  }

  // Màn hình thông báo đặt hàng thành công
  if (placedOrder) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <span className="inline-block rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
          Đặt hàng thành công!
        </span>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-coffee-900">
          Cảm ơn bạn đã đặt món!
        </h1>

        <div className="mt-6 rounded-3xl border border-coffee-200/80 bg-white p-6 shadow-card text-left">
          <div className="flex items-center justify-between border-b border-coffee-100 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-coffee-600">
              Mã đơn hàng
            </span>
            <span className="font-mono text-base font-bold text-coffee-900">
              {placedOrder.orderCode}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-b border-coffee-100 pb-3">
            <span className="text-sm text-coffee-600">Trạng thái</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {placedOrder.status === 'PENDING' ? 'Chờ nhận tại quầy (PENDING)' : placedOrder.status}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-b border-coffee-100 pb-3">
            <span className="text-sm text-coffee-600">Tổng thanh toán</span>
            <span className="text-lg font-bold text-coffee-900">
              {formatVnd(Number(placedOrder.totalAmount))}
            </span>
          </div>

          <p className="mt-4 text-xs text-coffee-600">
            * Đơn hàng đã được ghi nhận trên hệ thống backend BrewLite. Hãy đến quầy lấy đồ uống và cung cấp mã đơn hàng.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <Link
            href="/"
            onClick={() => setPlacedOrder(null)}
            className="rounded-full bg-coffee-800 px-6 py-3 text-sm font-semibold text-cream shadow transition hover:bg-coffee-700"
          >
            Tiếp tục đặt món
          </Link>
          <button
            type="button"
            onClick={() => {
              setPlacedOrder(null);
              setShowHistory(true);
            }}
            className="rounded-full border border-coffee-300 bg-white px-6 py-3 text-sm font-semibold text-coffee-800 transition hover:bg-coffee-50"
          >
            Xem lịch sử đơn hàng
          </button>
        </div>
      </main>
    );
  }

  // Giỏ hàng trống
  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-coffee-100 text-coffee-700">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-8 w-8"
          >
            <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
            <circle cx="10" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-coffee-900">Giỏ hàng đang trống</h1>
        <p className="mt-2 text-coffee-600">Bạn chưa chọn món đồ uống nào vào giỏ.</p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-coffee-800 px-6 py-3 font-semibold text-cream shadow transition hover:bg-coffee-700"
          >
            Khám phá Menu ngay
          </Link>
        </div>

        {/* Lịch sử đơn hàng nếu đã đăng nhập */}
        {authHydrated && user && myOrders.length > 0 && (
          <div className="mt-14 text-left">
            <h2 className="text-lg font-bold text-coffee-900 border-b border-coffee-200 pb-3">
              Lịch sử đơn hàng của bạn ({myOrders.length})
            </h2>
            <div className="mt-4 divide-y divide-coffee-100 rounded-2xl bg-white p-4 shadow-sm">
              {myOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-coffee-900">{order.orderCode}</p>
                    <p className="text-xs text-coffee-500">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-coffee-800">
                      {formatVnd(Number(order.totalAmount))}
                    </span>
                    <span className="ml-2 inline-block rounded-full bg-coffee-100 px-2 py-0.5 text-[11px] font-semibold text-coffee-800">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Banner nhắc đăng nhập nếu chưa đăng nhập (CV11) */}
      {authHydrated && !user && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-white font-bold text-xs">
                !
              </span>
              <div>
                <p className="font-semibold">Bạn chưa đăng nhập</p>
                <p className="text-xs text-amber-700">
                  Đăng nhập để tự động lưu thông tin đơn hàng và tiếp tục đặt món.
                </p>
              </div>
            </div>
            <Link
              href="/login?redirect=/cart"
              className="inline-flex items-center justify-center rounded-full bg-coffee-800 px-4 py-2 text-xs font-semibold text-cream shadow transition hover:bg-coffee-700 self-start sm:self-auto"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      )}

      {/* Header Giỏ hàng */}
      <div className="flex items-center justify-between border-b border-coffee-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-coffee-900 sm:text-3xl">Giỏ hàng</h1>
          <p className="mt-1 text-sm text-coffee-600">Đang có {itemCount} món trong giỏ</p>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          className="text-xs font-semibold text-rose-600 transition hover:underline"
        >
          Xóa toàn bộ
        </button>
      </div>

      {orderError && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium"
        >
          {orderError}
        </div>
      )}

      {/* Danh sách món */}
      <div className="mt-6 divide-y divide-coffee-100 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-coffee-100">
                <Image
                  src={item.imageUrl || '/images/default-cup.png'}
                  alt={item.productName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="font-semibold text-coffee-900">{item.productName}</h3>
                <p className="text-xs text-coffee-600">
                  {item.size ? `Size: ${item.size.name}` : 'Size tiêu chuẩn'}
                  {item.toppings.length > 0
                    ? ` · Topping: ${item.toppings.map((t) => t.name).join(', ')}`
                    : ''}
                </p>
                <p className="mt-1 text-sm font-semibold text-coffee-800">
                  {formatVnd(item.unitPrice)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="flex items-center rounded-full border border-coffee-200 bg-coffee-50 p-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.key, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="grid h-7 w-7 place-items-center rounded-full text-coffee-700 transition hover:bg-white disabled:opacity-40"
                  aria-label="Giảm số lượng"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-semibold text-coffee-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.key, item.quantity + 1)}
                  disabled={item.quantity >= 20}
                  className="grid h-7 w-7 place-items-center rounded-full text-coffee-700 transition hover:bg-white disabled:opacity-40"
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              <div className="text-right sm:w-28">
                <p className="text-sm font-bold text-coffee-900">
                  {formatVnd(item.unitPrice * item.quantity)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="text-xs text-rose-500 hover:text-rose-700"
                aria-label={`Xóa ${item.productName}`}
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tạm tính & Tiến hành Đặt hàng */}
      <div className="mt-8 rounded-2xl bg-cream p-6 border border-coffee-200">
        <div className="flex items-center justify-between text-base">
          <span className="text-coffee-700">Tạm tính giỏ hàng:</span>
          <span className="text-xl font-bold text-coffee-900">{formatVnd(totalAmount)}</span>
        </div>
        <p className="mt-1 text-xs text-coffee-500">
          * Đơn hàng nhận trực tiếp tại quầy (Pick-up), thanh toán không tiền mặt (Cashless).
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-full border border-coffee-300 py-3 text-center text-sm font-semibold text-coffee-800 transition hover:bg-coffee-100"
          >
            ← Chọn thêm món khác
          </Link>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isOrdering}
            className="flex-1 rounded-full bg-coffee-800 py-3 text-center text-sm font-semibold text-cream shadow transition hover:bg-coffee-700 disabled:bg-coffee-400"
          >
            {isOrdering
              ? 'Đang gửi đơn hàng...'
              : user
              ? 'Tiến hành Đặt hàng →'
              : 'Đăng nhập để Đặt hàng →'}
          </button>
        </div>
      </div>

      {/* Lịch sử đơn hàng (hiển thị khi đã đăng nhập) */}
      {authHydrated && user && (
        <div className="mt-12 rounded-2xl border border-coffee-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-coffee-900">
                Lịch sử đơn hàng của bạn ({myOrders.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-semibold text-coffee-700 hover:text-coffee-900 underline"
            >
              {showHistory ? 'Thu gọn' : 'Xem chi tiết'}
            </button>
          </div>

          {showHistory && (
            <div className="mt-4">
              {loadingOrders ? (
                <p className="text-xs text-coffee-500">Đang tải danh sách đơn hàng...</p>
              ) : myOrders.length === 0 ? (
                <p className="text-xs text-coffee-500">Bạn chưa có đơn hàng nào trước đây.</p>
              ) : (
                <div className="divide-y divide-coffee-100">
                  {myOrders.map((ord) => (
                    <div key={ord.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono font-bold text-coffee-900">{ord.orderCode}</span>
                        <p className="text-xs text-coffee-500">
                          {new Date(ord.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-coffee-900">
                          {formatVnd(Number(ord.totalAmount))}
                        </span>
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
