
'use client';

import Link from 'next/link';
import { selectCartCount, useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';

export function SiteHeader() {
  const itemCount = useCartStore(selectCartCount);
  const cartHydrated = useCartStore((state) => state.hasHydrated);

  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const authHydrated = useAuthStore((state) => state.hasHydrated);

  return (
    <header className="sticky top-0 z-40 border-b border-coffee-100/80 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="BrewLite – về trang chủ"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-coffee-800 text-sm font-bold text-cream">
            B
          </span>
          <span className="text-lg font-semibold tracking-tight">
            BrewLite
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2 text-sm font-medium">

          <Link
            href="/"
            className="rounded-full px-3 py-2 text-coffee-700 transition hover:bg-coffee-100 hover:text-coffee-900"
          >
            Menu
          </Link>

          {/* Order history */}
          {authHydrated && user && (
            <Link
              href="/orders"
              className="rounded-full px-3 py-2 text-coffee-700 transition hover:bg-coffee-100 hover:text-coffee-900"
            >
              Lịch sử đơn hàng
            </Link>
          )}

          {/* Authentication */}
          {authHydrated && user ? (
            <div className="flex items-center gap-2">

              {/* User information + Loyalty points */}
              <div
                className="flex items-center gap-2 rounded-full border border-coffee-200 bg-coffee-100/70 px-3 py-1.5"
                aria-label={`Tài khoản ${user.username || user.email.split('@')[0]}, ${user.loyaltyPoints ?? 0} điểm tích lũy`}
              >
                {/* Username */}
                <span className="max-w-24 truncate text-xs font-semibold text-coffee-800">
                  {user.username || user.email.split('@')[0]}
                </span>

                {/* Divider */}
                <span className="h-4 w-px bg-coffee-300" />

                {/* Loyalty points */}
                <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-3.5 w-3.5 text-amber-500"
                  >
                    <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5z" />
                  </svg>

                  {(user.loyaltyPoints ?? 0).toLocaleString('vi-VN')}
                </span>
              </div>

              {/* Logout */}
              <button
                type="button"
                onClick={() => clearAuth()}
                className="rounded-full px-2.5 py-1.5 text-xs text-coffee-600 transition hover:bg-coffee-100 hover:text-coffee-900"
              >
                Đăng xuất
              </button>
            </div>
          ) : authHydrated ? (
            <Link
              href="/login"
              className="rounded-full bg-coffee-100 px-3.5 py-1.5 text-xs font-semibold text-coffee-800 transition hover:bg-coffee-200"
            >
              Đăng nhập
            </Link>
          ) : null}

          {/* Cart */}
          <Link
            href="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-coffee-800 text-cream transition hover:bg-coffee-700"
            aria-label={
              cartHydrated && itemCount > 0
                ? `Giỏ hàng, ${itemCount} món`
                : 'Giỏ hàng'
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
              <circle cx="10" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>

            {cartHydrated && itemCount > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold leading-none text-coffee-900 shadow-sm"
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
