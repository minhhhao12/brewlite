'use client';

import { useEffect, useMemo, useState } from 'react';
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

type StatusFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

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
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';

    case 'PREPARING':
    case 'READY':
      return 'bg-blue-50 text-blue-800 border-blue-200';

    case 'CANCELLED':
    case 'PAYMENT_FAILED':
      return 'bg-red-50 text-red-800 border-red-200';

    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'PAID':
      return (
        <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
        </svg>
      );

    case 'PREPARING':
    case 'READY':
      return (
        <svg className="h-3.5 w-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );

    case 'CANCELLED':
    case 'PAYMENT_FAILED':
      return (
        <svg className="h-3.5 w-3.5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );

    default:
      return (
        <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

const ORDER_STEPS = [
  { key: 'PENDING', label: 'Đặt đơn' },
  { key: 'PAID', label: 'Đã thanh toán' },
  { key: 'PREPARING', label: 'Đang pha chế' },
  { key: 'COMPLETED', label: 'Sẵn sàng / Hoàn tất' },
];

function getStepProgressIndex(status: string): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'PAID':
      return 1;
    case 'PREPARING':
      return 2;
    case 'READY':
    case 'COMPLETED':
      return 3;
    default:
      return 0;
  }
}

export default function OrdersPage() {
  const router = useRouter();

  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Expanded cards tracker
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Filter state
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');

  // Copy feedback tracker
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Cancel order modal
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadOrders = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const result = await api.getMyOrders();
      setOrders(result);

      // Mặc định mở rộng chi tiết của đơn hàng đầu tiên (mới nhất) nếu chưa mở đơn nào
      if (result.length > 0) {
        setExpandedOrders((prev) => (prev.size === 0 ? new Set([result[0].id]) : prev));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login?redirect=%2Forders');
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message || 'Không thể tải lịch sử đơn hàng.');
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      router.replace('/login?redirect=%2Forders');
      return;
    }

    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, token, router]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  const toggleOrderExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (expandedOrders.size === filteredOrders.length) {
      setExpandedOrders(new Set());
    } else {
      setExpandedOrders(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;

    setIsCancelling(true);
    try {
      await api.cancelOrder(orderToCancel.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderToCancel.id ? { ...o, status: 'CANCELLED' } : o)),
      );
      setOrderToCancel(null);
      setSuccessNotice(`Đã hủy thành công đơn hàng ${orderToCancel.orderCode || orderToCancel.id}`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (error) {
      if (error instanceof ApiError) {
        alert(error.message || 'Không thể hủy đơn hàng.');
      } else {
        alert('Lỗi hệ thống khi hủy đơn hàng. Vui lòng thử lại.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'PENDING') return order.status === 'PENDING';
      if (activeFilter === 'PROCESSING')
        return ['PAID', 'PREPARING', 'READY'].includes(order.status);
      if (activeFilter === 'COMPLETED') return order.status === 'COMPLETED';
      if (activeFilter === 'CANCELLED')
        return ['CANCELLED', 'PAYMENT_FAILED'].includes(order.status);
      return true;
    });
  }, [orders, activeFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      processing: orders.filter((o) => ['PAID', 'PREPARING', 'READY'].includes(o.status)).length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      cancelled: orders.filter((o) => ['CANCELLED', 'PAYMENT_FAILED'].includes(o.status)).length,
    };
  }, [orders]);

  return (
    <section className="mx-auto min-h-[70vh] max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Toast thông báo thành công */}
      {successNotice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-emerald-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl transition animate-in fade-in slide-in-from-bottom-4"
        >
          <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header trang */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-coffee-100/70 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-coffee-800">
            <span>☕</span>
            <span>BrewLite Member</span>
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-coffee-900 sm:text-4xl">
            Lịch sử &amp; Chi tiết đơn hàng
          </h1>

          <p className="mt-2 text-sm leading-6 text-coffee-600 sm:text-base">
            Theo dõi tiến trình pha chế, danh sách món và chi tiết hóa đơn của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={isRefreshing || loading}
            aria-label="Cập nhật danh sách đơn hàng"
            className="inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white px-4 py-2 text-xs font-semibold text-coffee-800 shadow-sm transition hover:bg-coffee-50 active:scale-95 disabled:opacity-60"
          >
            <svg
              className={`h-4 w-4 text-coffee-600 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? 'Đang cập nhật...' : 'Cập nhật'}</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-coffee-800 px-4 py-2 text-xs font-semibold text-cream shadow-sm transition hover:bg-coffee-700 active:scale-95"
          >
            <span>+ Đặt món mới</span>
          </Link>
        </div>
      </div>

      {/* Tabs lọc trạng thái */}
      {!loading && !errorMessage && orders.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-coffee-200/80 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'ALL'
                  ? 'bg-coffee-800 text-cream shadow-sm'
                  : 'bg-coffee-100/60 text-coffee-700 hover:bg-coffee-200/70'
              }`}
            >
              Tất cả ({counts.all})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('PENDING')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'PENDING'
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'bg-coffee-100/60 text-coffee-700 hover:bg-coffee-200/70'
              }`}
            >
              Chờ thanh toán ({counts.pending})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('PROCESSING')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'PROCESSING'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-coffee-100/60 text-coffee-700 hover:bg-coffee-200/70'
              }`}
            >
              Đang chuẩn bị ({counts.processing})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('COMPLETED')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'COMPLETED'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-coffee-100/60 text-coffee-700 hover:bg-coffee-200/70'
              }`}
            >
              Hoàn thành ({counts.completed})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('CANCELLED')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'CANCELLED'
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'bg-coffee-100/60 text-coffee-700 hover:bg-coffee-200/70'
              }`}
            >
              Đã hủy ({counts.cancelled})
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleAll}
            className="text-xs font-semibold text-coffee-700 hover:text-coffee-900 underline underline-offset-4 transition"
          >
            {expandedOrders.size === filteredOrders.length ? 'Thu gọn tất cả' : 'Mở rộng chi tiết tất cả'}
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="animate-pulse rounded-3xl border border-coffee-200/80 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-coffee-100" />
                  <div className="h-6 w-48 rounded bg-coffee-200" />
                </div>
                <div className="h-7 w-28 rounded-full bg-coffee-100" />
              </div>
              <div className="mt-6 border-t border-coffee-100 pt-4 flex justify-between">
                <div className="h-6 w-36 rounded bg-coffee-100" />
                <div className="h-9 w-28 rounded-full bg-coffee-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && errorMessage && (
        <div
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-semibold text-red-900">Không thể tải đơn hàng</p>
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>

              <button
                type="button"
                onClick={() => void loadOrders()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-2 text-xs font-semibold text-white transition hover:bg-red-800 active:scale-95"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state: hoàn toàn chưa có đơn hàng */}
      {!loading && !errorMessage && orders.length === 0 && (
        <div className="rounded-3xl border border-coffee-200/80 bg-white px-6 py-14 text-center shadow-card">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-amber-50 text-3xl border border-amber-200/60 shadow-inner">
            ☕
          </div>

          <h2 className="mt-5 text-2xl font-bold text-coffee-900">
            Bạn chưa có đơn hàng nào
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-coffee-600">
            Hãy khám phá thực đơn cà phê thơm lừng và chọn món đồ uống yêu thích của bạn ngay hôm nay!
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-coffee-800 px-7 py-3 text-sm font-semibold text-cream shadow-md transition hover:bg-coffee-700 active:scale-95"
          >
            <span>Khám phá thực đơn</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* Empty state theo bộ lọc tab */}
      {!loading && !errorMessage && orders.length > 0 && filteredOrders.length === 0 && (
        <div className="rounded-3xl border border-coffee-200/80 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coffee-100 text-xl text-coffee-600">
            📋
          </div>
          <h2 className="mt-4 text-lg font-bold text-coffee-900">
            Không có đơn hàng nào ở mục này
          </h2>
          <p className="mt-1 text-sm text-coffee-500">
            Hãy chọn mục khác để xem lịch sử đơn hàng của bạn.
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className="mt-4 inline-flex rounded-full bg-coffee-100 px-4 py-2 text-xs font-semibold text-coffee-800 hover:bg-coffee-200 transition"
          >
            Xem tất cả đơn hàng
          </button>
        </div>
      )}

      {/* Danh sách đơn hàng kèm chi tiết */}
      {!loading && !errorMessage && filteredOrders.length > 0 && (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const isCancelled = order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED';
            const canCancel = order.status === 'PENDING' || order.status === 'PAYMENT_FAILED';
            const stepIndex = getStepProgressIndex(order.status);
            const totalItemsCount =
              order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

            return (
              <article
                key={order.id}
                data-testid={`order-card-${order.id}`}
                className="overflow-hidden rounded-3xl border border-coffee-200/90 bg-white shadow-card transition duration-200 hover:border-coffee-300"
              >
                {/* Phần tóm tắt thẻ (Card Header & Summary) */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-coffee-500">
                          Mã đơn hàng
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleCopyCode(order.orderCode || order.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-coffee-100/70 px-2 py-0.5 text-[11px] font-semibold text-coffee-700 hover:bg-coffee-200/80 transition"
                          title="Sao chép mã đơn hàng"
                        >
                          {copiedCode === (order.orderCode || order.id) ? (
                            <>
                              <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-emerald-700">Đã chép!</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3 text-coffee-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>

                      <h2 className="mt-1 break-all text-xl font-bold tracking-tight text-coffee-900">
                        {order.orderCode || order.id}
                      </h2>

                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-coffee-500 sm:text-sm">
                        <svg className="h-4 w-4 text-coffee-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Thời gian đặt: {formatDate(order.createdAt)}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-xs ${getStatusStyle(
                          order.status,
                        )}`}
                      >
                        {getStatusIcon(order.status)}
                        <span>{STATUS_LABELS[order.status] ?? order.status}</span>
                      </span>

                      {/* Hiển thị số lượng món */}
                      <span className="text-xs font-medium text-coffee-500">
                        {totalItemsCount} món trong đơn
                      </span>
                    </div>
                  </div>

                  {/* Thanh tóm tắt nhanh các món khi đang thu gọn */}
                  {!isExpanded && order.items && order.items.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-coffee-50/70 px-4 py-2.5 text-xs text-coffee-700 border border-coffee-100 flex items-center justify-between gap-3">
                      <div className="truncate">
                        <span className="font-semibold text-coffee-800">Các món: </span>
                        <span>
                          {order.items
                            .map((it) => `${it.productName} (x${it.quantity})`)
                            .join(', ')}
                        </span>
                      </div>
                      <span className="shrink-0 text-coffee-500 italic">Nhấn xem chi tiết để xem đầy đủ</span>
                    </div>
                  )}

                  {/* Thanh tổng tiền & Nút toggle chi tiết */}
                  <div className="mt-5 flex flex-col gap-3 border-t border-coffee-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-medium text-coffee-500">
                        Tổng thanh toán
                      </p>
                      <p className="mt-0.5 text-2xl font-extrabold text-coffee-900">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setOrderToCancel(order)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/80 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 active:scale-95"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Hủy đơn</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleOrderExpand(order.id)}
                        aria-expanded={isExpanded}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-xs active:scale-95 ${
                          isExpanded
                            ? 'bg-coffee-100 text-coffee-900 hover:bg-coffee-200'
                            : 'bg-coffee-800 text-cream hover:bg-coffee-700'
                        }`}
                      >
                        <span>{isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết đơn hàng'}</span>
                        <svg
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Phần nội dung chi tiết mở rộng (Order Details Accordion) */}
                {isExpanded && (
                  <div
                    data-testid={`order-details-${order.id}`}
                    className="border-t border-coffee-200/90 bg-cream/35 p-5 sm:p-7 space-y-6 animate-in fade-in duration-200"
                  >
                    {/* 1. Tiến trình trạng thái đơn hàng (Stepper) */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-coffee-600 mb-3 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-coffee-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>Tiến độ thực hiện đơn hàng</span>
                      </h3>

                      {!isCancelled ? (
                        <div className="rounded-2xl border border-coffee-200/70 bg-white p-4 sm:p-5 shadow-xs">
                          <div className="grid grid-cols-4 gap-2 text-center relative">
                            {/* Đường kẻ tiến trình nối các bước */}
                            <div className="absolute top-4 left-6 right-6 h-1 bg-coffee-100 -z-0">
                              <div
                                className="h-full bg-coffee-800 transition-all duration-500"
                                style={{
                                  width: `${(stepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                                }}
                              />
                            </div>

                            {ORDER_STEPS.map((step, idx) => {
                              const isCompleted = idx <= stepIndex;
                              const isCurrent = idx === stepIndex;

                              return (
                                <div key={step.key} className="relative z-10 flex flex-col items-center">
                                  <div
                                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition shadow-xs ${
                                      isCurrent
                                        ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                                        : isCompleted
                                        ? 'bg-coffee-800 text-cream'
                                        : 'bg-coffee-100 text-coffee-400 border border-coffee-200'
                                    }`}
                                  >
                                    {isCompleted && !isCurrent ? (
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      idx + 1
                                    )}
                                  </div>

                                  <p
                                    className={`mt-2 text-xs font-bold leading-tight ${
                                      isCurrent
                                        ? 'text-amber-800'
                                        : isCompleted
                                        ? 'text-coffee-900'
                                        : 'text-coffee-400'
                                    }`}
                                  >
                                    {step.label}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800 flex items-start gap-3">
                          <svg className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-bold text-red-900">
                              {order.status === 'CANCELLED'
                                ? 'Đơn hàng đã được hủy'
                                : 'Giao dịch thanh toán chưa thành công'}
                            </p>
                            <p className="mt-0.5 text-red-700">
                              {order.status === 'CANCELLED'
                                ? 'Đơn hàng này không còn hiệu lực. Mọi số lượng tồn kho và ưu đãi đã được hoàn trả.'
                                : 'Thanh toán thất bại. Bạn có thể tiến hành đặt lại hoặc chọn phương thức thanh toán khác.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Danh sách các món trong chi tiết đơn hàng */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-coffee-600 flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-coffee-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span>Danh sách món đã đặt ({order.items?.length ?? 0} món)</span>
                        </h3>
                        <span className="text-xs text-coffee-500 font-medium">
                          Tổng số lượng: {totalItemsCount}
                        </span>
                      </div>

                      {order.items && order.items.length > 0 ? (
                        <div className="divide-y divide-coffee-100 rounded-2xl border border-coffee-200/80 bg-white overflow-hidden shadow-xs">
                          {order.items.map((item, itemIdx) => (
                            <div
                              key={item.id || itemIdx}
                              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition hover:bg-coffee-50/40"
                            >
                              <div className="flex items-start gap-3.5 min-w-0">
                                {/* Thumbnail sản phẩm hoặc icon đồ uống */}
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-coffee-200/80 bg-coffee-100/60 grid place-items-center">
                                  {item.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.imageUrl}
                                      alt={item.productName}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span className="text-2xl select-none" role="img" aria-label="Đồ uống">
                                      ☕
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <Link
                                    href={`/products/${item.productId}`}
                                    className="text-base font-bold text-coffee-900 hover:text-coffee-600 transition truncate block"
                                  >
                                    {item.productName}
                                  </Link>

                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-coffee-600">
                                    <span className="font-semibold text-coffee-800">
                                      {formatCurrency(item.unitPrice)}
                                    </span>
                                    <span>×</span>
                                    <span className="inline-flex items-center rounded-md bg-coffee-100 px-2 py-0.5 font-bold text-coffee-800">
                                      {item.quantity} ly
                                    </span>
                                  </div>

                                  {/* Hiển thị Tùy chọn Size & Toppings */}
                                  {item.options && item.options.length > 0 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                      {item.options.map((opt) => (
                                        <span
                                          key={opt.id}
                                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                                            opt.optionType === 'SIZE'
                                              ? 'bg-coffee-200/60 text-coffee-800 border border-coffee-300/60'
                                              : 'bg-amber-100 text-amber-800 border border-amber-200/70'
                                          }`}
                                        >
                                          <span>{opt.optionType === 'SIZE' ? `Size ${opt.optionName}` : `+${opt.optionName}`}</span>
                                          {Number(opt.priceAdjustment) > 0 && (
                                            <span className="text-[10px] opacity-80">
                                              (+{formatCurrency(opt.priceAdjustment)})
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Thành tiền của từng món */}
                              <div className="flex items-center justify-between border-t border-dashed border-coffee-100 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                                <span className="text-xs text-coffee-500 sm:hidden">Thành tiền món:</span>
                                <p className="text-base font-extrabold text-coffee-900">
                                  {formatCurrency(item.subtotal)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-coffee-200/70 bg-white p-4 text-center text-xs text-coffee-500 italic">
                          Không có thông tin chi tiết từng món.
                        </div>
                      )}
                    </div>

                    {/* 3. Bảng phân tích chi phí thanh toán (Payment Breakdown) */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-coffee-600 mb-3 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-coffee-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Chi tiết thanh toán &amp; Hóa đơn</span>
                      </h3>

                      <div className="rounded-2xl border border-coffee-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3 text-sm">
                        <div className="flex justify-between text-coffee-600">
                          <span>Tạm tính tiền hàng ({totalItemsCount} món):</span>
                          <span className="font-medium text-coffee-900">
                            {formatCurrency(order.subtotal || order.totalAmount)}
                          </span>
                        </div>

                        {Number(order.discountAmount) > 0 && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span className="flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              <span>
                                Giảm giá khuyến mãi
                                {order.promotion?.code ? ` (${order.promotion.code})` : ''}:
                              </span>
                            </span>
                            <span className="font-bold">-{formatCurrency(order.discountAmount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-coffee-600">
                          <span>Phí phục vụ &amp; đóng gói:</span>
                          <span className="font-medium text-emerald-700">Miễn phí</span>
                        </div>

                        <div className="border-t border-coffee-200/80 pt-3 flex items-baseline justify-between">
                          <div>
                            <span className="text-base font-extrabold text-coffee-900">
                              Tổng thanh toán thực tế:
                            </span>
                            <p className="text-xs text-coffee-500 font-normal">Đã bao gồm thuế GTGT</p>
                          </div>
                          <span className="text-xl sm:text-2xl font-black text-coffee-900">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Hướng dẫn nhận hàng & Nút hành động */}
                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-coffee-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>
                          Quý khách vui lòng lưu lại mã đơn{' '}
                          <strong className="font-bold text-coffee-900">
                            {order.orderCode || order.id}
                          </strong>{' '}
                          để đối chiếu hoặc nhận đồ uống tại quầy bar BrewLite.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleOrderExpand(order.id)}
                          className="inline-flex rounded-full border border-coffee-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-coffee-700 hover:bg-coffee-50 transition"
                        >
                          Thu gọn ↑
                        </button>

                        <Link
                          href="/"
                          className="inline-flex rounded-full bg-coffee-800 px-4 py-1.5 text-xs font-semibold text-cream hover:bg-coffee-700 transition"
                        >
                          Đặt thêm món
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal xác nhận hủy đơn hàng */}
      {orderToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-3xl border border-coffee-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h3 className="text-center text-xl font-bold text-coffee-900">
              Xác nhận hủy đơn hàng?
            </h3>

            <p className="mt-2 text-center text-sm text-coffee-600">
              Bạn có chắc chắn muốn hủy đơn hàng mã{' '}
              <strong className="text-coffee-900 font-semibold">
                {orderToCancel.orderCode || orderToCancel.id}
              </strong>
              ? Số tiền và số lượng đồ uống sẽ được hoàn lại tự động.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={isCancelling}
                className="flex-1 rounded-full border border-coffee-300 bg-white py-2.5 text-sm font-semibold text-coffee-800 hover:bg-coffee-50 transition active:scale-95 disabled:opacity-50"
              >
                Giữ đơn hàng
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                disabled={isCancelling}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Đang hủy...</span>
                  </>
                ) : (
                  <span>Xác nhận hủy đơn</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer link quay về trang chủ */}
      <div className="mt-12 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-coffee-700 underline underline-offset-4 transition hover:text-coffee-900"
        >
          <span>← Quay về trang chủ BrewLite</span>
        </Link>
      </div>
    </section>
  );
}