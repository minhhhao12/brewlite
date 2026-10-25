'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { Order } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng nhận hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Không xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'PAID':
      return 'bg-emerald-100 text-emerald-800';

    case 'PREPARING':
    case 'READY':
      return 'bg-blue-100 text-blue-800';

    case 'CANCELLED':
    case 'PAYMENT_FAILED':
      return 'bg-red-100 text-red-800';

    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export default function OrdersPage() {
  const router = useRouter();

  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      router.replace('/login?redirect=%2Forders');
      return;
    }

    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await api.getMyOrders();

        if (!cancelled) {
          setOrders(result);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          setErrorMessage(
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          );
        } else if (error instanceof ApiError) {
          setErrorMessage(error.message || 'Không thể tải lịch sử đơn hàng.');
        } else {
          setErrorMessage(
            'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token, router]);

  return (
    <section className="mx-auto min-h-[60vh] max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-coffee-600">
          BrewLite
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-coffee-900 sm:text-4xl">
          Lịch sử đơn hàng
        </h1>

        <p className="mt-3 text-sm leading-6 text-coffee-600 sm:text-base">
          Theo dõi mã đơn hàng, trạng thái và thông tin các lần đặt món của bạn.
        </p>
      </div>

      {loading && (
        <div
          role="status"
          className="rounded-3xl border border-coffee-200 bg-white p-8 text-center text-coffee-600 shadow-sm"
        >
          Đang tải lịch sử đơn hàng...
        </div>
      )}

      {!loading && errorMessage && (
        <div
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800"
        >
          <p className="font-semibold">Không thể tải đơn hàng</p>
          <p className="mt-2 text-sm">{errorMessage}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      {!loading && !errorMessage && orders.length === 0 && (
        <div className="rounded-3xl border border-coffee-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-2xl">
            ☕
          </div>

          <h2 className="mt-5 text-xl font-bold text-coffee-900">
            Bạn chưa có đơn hàng nào
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-coffee-600">
            Hãy khám phá thực đơn và chọn món đồ uống yêu thích của bạn.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-coffee-800 px-6 py-3 text-sm font-semibold text-cream transition hover:bg-coffee-700"
          >
            Về trang chủ
          </Link>
        </div>
      )}

      {!loading && !errorMessage && orders.length > 0 && (
        <div className="space-y-5">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-3xl border border-coffee-200/80 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-coffee-500">
                    Mã đơn hàng
                  </p>

                  <h2 className="mt-1 break-all text-lg font-bold text-coffee-900">
                    {order.orderCode || order.id}
                  </h2>

                  <p className="mt-2 text-sm text-coffee-500">
                    Ngày đặt: {formatDate(order.createdAt)}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-3.5 py-2 text-xs font-semibold ${getStatusStyle(order.status)}`}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-coffee-100 pt-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-coffee-500">Tổng thanh toán</p>

                  <p className="mt-1 text-xl font-bold text-coffee-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>

                <Link
                  href="/"
                  className="inline-flex w-fit items-center justify-center rounded-full border border-coffee-300 px-5 py-2.5 text-sm font-semibold text-coffee-800 transition hover:bg-coffee-50"
                >
                  Về trang chủ
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-coffee-700 underline underline-offset-4 transition hover:text-coffee-900"
        >
          ← Quay về trang chủ
        </Link>
      </div>
    </section>
  );
}