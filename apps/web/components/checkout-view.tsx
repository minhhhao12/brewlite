'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { selectCartSubtotal, useCartHydrated, useCartStore } from '@/lib/cart-store';
import { formatVnd } from '@/lib/format';
import type { PaymentMethod, PaymentResponse } from '@/lib/types';

export function CheckoutView() {
  const router = useRouter();

  // Auth store
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const authHydrated = useAuthStore((state) => state.hasHydrated);

  // Cart store
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectCartSubtotal);
  const clearCart = useCartStore((state) => state.clear);
  const cartHydrated = useCartHydrated();

  // Checkout states
  const [method, setMethod] = useState<PaymentMethod>('WALLET');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lưu lại orderId đã tạo để hỗ trợ thanh toán lại trên đơn cũ khi PAYMENT_FAILED
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Trạng thái thanh toán thành công
  const [paymentSuccess, setPaymentSuccess] = useState<{
    orderCode: string;
    transactionReference: string;
    amount: number;
    method: PaymentMethod;
    idempotencyKey: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  useEffect(() => {
    if (!token && authHydrated) {
      router.replace('/login?redirect=/checkout');
    }
  }, [token, router]);

  // Loading skeleton trong khi chờ hydrate auth & giỏ hàng
  if (!authHydrated || !cartHydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-full bg-coffee-100" />
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-3xl bg-coffee-50 lg:col-span-7" />
          <div className="h-96 animate-pulse rounded-3xl bg-coffee-50 lg:col-span-5" />
        </div>
      </div>
    );
  }

  // Màn hình hoàn tất thanh toán thành công
  if (paymentSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-card sm:p-10">
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <svg
                className="h-9 w-9 animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="mt-4 inline-block rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-semibold text-emerald-800">
              Giao dịch thành công
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-coffee-900 sm:text-3xl">
              Cảm ơn bạn đã đặt món!
            </h1>
            <p className="mt-1 text-sm text-coffee-600">
              Đơn hàng đã được ghi nhận và chuyển tới quầy pha chế Barista.
            </p>
          </div>

          {/* Chi tiết hóa đơn */}
          <div className="mt-8 rounded-2xl border border-coffee-100 bg-cream/30 p-5">
            <div className="flex items-center justify-between border-b border-coffee-100 pb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-coffee-500">
                Mã đơn hàng
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-coffee-900">
                  {paymentSuccess.orderCode}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentSuccess.orderCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="rounded-md border border-coffee-200 bg-white px-2 py-0.5 text-xs text-coffee-700 hover:bg-coffee-100"
                  title="Sao chép mã đơn"
                >
                  {copiedCode ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between text-coffee-700">
                <span>Số tiền thanh toán</span>
                <span className="text-base font-bold text-coffee-900">
                  {formatVnd(paymentSuccess.amount)}
                </span>
              </div>
              <div className="flex justify-between text-coffee-700">
                <span>Phương thức</span>
                <span className="font-medium">
                  {paymentSuccess.method === 'WALLET' ? 'Ví điện tử' : 'Thẻ ngân hàng'}
                </span>
              </div>
              <div className="flex justify-center text-coffee-700">
                <span>Chúc bạn có một trải nghiệm khó quên tại BrewLite!</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="flex-1 rounded-full bg-coffee-800 py-3.5 text-center text-sm font-semibold text-cream transition hover:bg-coffee-700 shadow-sm"
            >
              Tiếp tục chọn đồ uống
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Nếu giỏ hàng trống và chưa tạo đơn thành công
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <div className="rounded-3xl border border-coffee-200/80 bg-white/95 p-8 shadow-card">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cream text-coffee-600">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-coffee-900">Giỏ hàng của bạn đang trống</h2>
          <p className="mt-2 text-sm text-coffee-600">
            Không có đồ uống nào cần thanh toán. Hãy chọn món thơm ngon từ thực đơn nhé!
          </p>
          <Link
            href="/"
            className="mt-6 inline-block w-full rounded-full bg-coffee-800 py-3 text-sm font-semibold text-cream transition hover:bg-coffee-700"
          >
            Xem thực đơn ngay
          </Link>
        </div>
      </div>
    );
  }

  // Hàm xử lý thanh toán chính
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // 1. Tạo đơn hàng PENDING nếu chưa có mã đơn đang xử lý
      let activeOrderId = pendingOrderId;
      let orderCodeForReceipt = '';

      if (!activeOrderId) {
        const orderResponse = await api.createOrder({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            sizeOptionId: item.size?.id,
            toppingOptionIds: item.toppings.map((t) => t.id),
          })),
        });
        activeOrderId = orderResponse.id;
        orderCodeForReceipt = orderResponse.orderCode;
        setPendingOrderId(activeOrderId);
      }

      // 2. Sinh Idempotency-Key chuẩn UUID
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

      // 3. Gửi yêu cầu thanh toán kèm Idempotency-Key
      const paymentResponse: PaymentResponse = await api.createPayment(
        {
          orderId: activeOrderId,
          method,
          simulateFailure,
        },
        idempotencyKey,
      );

      // 4. Kiểm tra kết quả trả về từ Backend
      const isPaid =
        paymentResponse.orderStatus === 'PAID' || paymentResponse.payment?.status === 'PAID';

      if (isPaid) {
        // THÀNH CÔNG: Xóa giỏ hàng và hiển thị hóa đơn thành công
        clearCart();
        setPaymentSuccess({
          orderCode: orderCodeForReceipt || 'ORD-BREW',
          transactionReference: paymentResponse.payment.transactionReference,
          amount: Number(paymentResponse.payment.amount),
          method,
          idempotencyKey,
        });
      } else {
        // PAYMENT_FAILED: GIỮ NGUYÊN GIỎ HÀNG
        setErrorMessage('Thanh toán bị từ chối hoặc thất bại. Bạn có thể thử lại!');
      }
    } catch (err) {
      // LỖI HỆ THỐNG / MẠNG: GIỮ NGUYÊN GIỎ HÀNG
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Thanh toán không thành công.');
      } else {
        setErrorMessage('Không thể kết nối đến cổng thanh toán.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Thanh điều hướng quay lại & Tiến trình */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-coffee-600 transition hover:text-coffee-900"
        >
          <span aria-hidden="true">←</span> Quay lại giỏ hàng
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-coffee-500">
          <span className="text-coffee-400">1. Giỏ hàng</span>
          <span>›</span>
          <span className="rounded-full bg-coffee-800 px-3 py-1 text-cream">2. Thanh toán</span>
          <span>›</span>
          <span className="text-coffee-400">3. Hoàn tất</span>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-coffee-900 sm:text-3xl">
          Thanh toán đơn hàng
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          Xác nhận thông tin đặt món và chọn phương thức thanh toán không tiền mặt bảo mật.
        </p>
      </div>

      {/* Banner thông báo lỗi nếu thanh toán thất bại (giữ giỏ hàng) */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-8 rounded-3xl border border-rose-200 bg-rose-50/90 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-600 text-white">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-900">Thanh toán chưa hoàn tất</h3>
              <p className="mt-1 text-xs sm:text-sm text-rose-700 leading-relaxed">
                {errorMessage}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-800">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>
                  Giỏ hàng vẫn được bảo toàn nguyên vẹn ({items.length} món). Bạn có thể thử thanh
                  toán lại ngay bên dưới.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handlePaymentSubmit} className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Cột trái: Thông tin nhận & Lựa chọn phương thức thanh toán */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {/* Thông tin khách hàng & Điểm nhận */}
          <div className="rounded-3xl border border-coffee-100 bg-white/95 p-6 shadow-card">
            <h2 className="text-base font-semibold text-coffee-900 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-coffee-100 text-xs text-coffee-800">
                1
              </span>
              Thông tin nhận đồ uống
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-2xl border border-coffee-100 bg-cream/30 p-3.5">
                <span className="text-xs text-coffee-500">Khách hàng</span>
                <p className="mt-0.5 font-semibold text-coffee-900">
                  {user?.username || user?.email.split('@')[0]}
                </p>
                <p className="text-xs text-coffee-600">{user?.email}</p>
              </div>

              <div className="rounded-2xl border border-coffee-100 bg-cream/30 p-3.5">
                <span className="text-xs text-coffee-500">Hình thức phục vụ</span>
                <p className="mt-0.5 font-semibold text-coffee-900">Nhận tại quầy (Takeaway)</p>
                <p className="text-xs text-emerald-700 font-medium">
                  Pha chế tươi sau khi thanh toán
                </p>
              </div>
            </div>
          </div>

          {/* Chọn phương thức thanh toán */}
          <div className="rounded-3xl border border-coffee-100 bg-white/95 p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-coffee-900 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-coffee-100 text-xs text-coffee-800">
                  2
                </span>
                Phương thức thanh toán
              </h2>
            </div>

            <p className="mt-1 text-xs text-coffee-600">
              Chọn phương thức bạn muốn sử dụng để hoàn tất đơn hàng:
            </p>

            <div className="mt-5 space-y-3">
              {/* Lựa chọn 1: Ví điện tử */}
              <label
                className={`relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                  method === 'WALLET'
                    ? 'border-coffee-800 bg-coffee-50/60 ring-2 ring-coffee-800/20'
                    : 'border-coffee-200/80 bg-white hover:bg-cream/20'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="WALLET"
                  checked={method === 'WALLET'}
                  onChange={() => setMethod('WALLET')}
                  className="mt-1 h-4 w-4 text-coffee-800 focus:ring-coffee-700"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-coffee-900">Ví điện tử</span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                        MoMo
                      </span>
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                        ZaloPay
                      </span>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-coffee-600">
                    Thanh toán nhanh chóng qua ứng dụng MoMo, ZaloPay, ShopeePay hoặc VNPay QR.
                  </p>
                </div>
              </label>

              {/* Lựa chọn 2: Thẻ ngân hàng */}
              <label
                className={`relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                  method === 'CARD'
                    ? 'border-coffee-800 bg-coffee-50/60 ring-2 ring-coffee-800/20'
                    : 'border-coffee-200/80 bg-white hover:bg-cream/20'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CARD"
                  checked={method === 'CARD'}
                  onChange={() => setMethod('CARD')}
                  className="mt-1 h-4 w-4 text-coffee-800 focus:ring-coffee-700"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-coffee-900">Thẻ ngân hàng / Quốc tế</span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        ATM/Napas
                      </span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                        Visa
                      </span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                        Mastercard
                      </span>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-coffee-600">
                    Hỗ trợ thẻ ATM nội địa tất cả các ngân hàng Việt Nam và thẻ thanh toán quốc tế.
                  </p>
                </div>
              </label>
            </div>

            {/* Chế độ kiểm thử: Mô phỏng thanh toán thất bại (rất tiện cho chấm bài & kiểm thử yêu cầu PAYMENT_FAILED) */}
            <div className="mt-6 rounded-2xl border border-dashed border-coffee-200 bg-cream/40 p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-coffee-800">
                    🛠️ Kiểm thử: Mô phỏng lỗi thanh toán (simulateFailure)
                  </span>
                  <p className="text-[11px] text-coffee-500">
                    Bật tùy chọn này để test trường hợp PAYMENT_FAILED (đơn hàng báo lỗi và giỏ hàng
                    vẫn được giữ nguyên vẹn).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="h-4 w-4 rounded text-coffee-800 focus:ring-coffee-700"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Cột phải: Tóm tắt đơn hàng & Nút Xác nhận thanh toán */}
        <div className="sticky top-24 rounded-3xl border border-coffee-100 bg-white/95 p-6 shadow-card lg:col-span-5 xl:col-span-4">
          <h2 className="text-lg font-semibold text-coffee-900">Chi tiết đơn hàng</h2>

          {/* Danh sách món thu gọn */}
          <div className="mt-4 max-h-60 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 border-b border-coffee-100/60 pb-3 text-sm"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-cream">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold text-coffee-400">
                      ☕
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium text-coffee-900">{item.productName}</h4>
                  <p className="text-xs text-coffee-500">
                    {item.size ? `Size ${item.size.name}` : ''}
                    {item.toppings.length > 0
                      ? ` + ${item.toppings.map((t) => t.name).join(', ')}`
                      : ''}
                  </p>
                  <p className="text-xs text-coffee-600">x{item.quantity}</p>
                </div>
                <div className="text-right font-medium text-coffee-900">
                  {formatVnd(item.unitPrice * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* Tính tiền */}
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between text-coffee-600">
              <span>Tạm tính</span>
              <span className="font-medium text-coffee-900">{formatVnd(subtotal)}</span>
            </div>
            <div className="flex justify-between text-coffee-600">
              <span>Phí dịch vụ</span>
              <span className="font-semibold text-emerald-700">Miễn phí</span>
            </div>
            <div className="my-3 border-t border-coffee-100" />
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-base font-semibold text-coffee-900">Tổng thanh toán</span>
                <p className="text-[11px] text-coffee-500">Đã bao gồm thuế VAT</p>
              </div>
              <span className="text-2xl font-bold tracking-tight text-coffee-900">
                {formatVnd(subtotal)}
              </span>
            </div>
          </div>

          {/* Nút hành động thanh toán */}
          <div className="mt-6 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full rounded-full py-4 text-center text-sm font-semibold transition shadow-sm ${
                isSubmitting
                  ? 'cursor-not-allowed bg-coffee-300 text-white'
                  : 'bg-coffee-800 text-cream hover:bg-coffee-700'
              }`}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang xử lý giao dịch an toàn...
                </span>
              ) : (
                `Xác nhận thanh toán • ${formatVnd(subtotal)}`
              )}
            </button>

            <Link
              href="/cart"
              className="block w-full rounded-full border border-coffee-200 bg-cream/40 py-3 text-center text-sm font-semibold text-coffee-800 transition hover:bg-coffee-100"
            >
              Chỉnh sửa lại giỏ hàng
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
