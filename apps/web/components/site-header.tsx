'use client';

import Link from 'next/link';
import { selectCartCount, useCartHydrated, useCartStore } from '@/lib/cart-store';

export function SiteHeader() {
  const itemCount = useCartStore(selectCartCount);
  const hasHydrated = useCartHydrated();

  return (
    <header className="sticky top-0 z-40 border-b border-coffee-100/80 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="BrewLite – về trang chủ">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-coffee-800 text-sm font-bold text-cream">
            B
          </span>
          <span className="text-lg font-semibold tracking-tight">BrewLite</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-coffee-700 transition hover:bg-coffee-100 hover:text-coffee-900"
          >
            Menu
          </Link>
          <Link
            href="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-coffee-800 text-cream transition hover:bg-coffee-700"
            aria-label={hasHydrated && itemCount > 0 ? `Giỏ hàng, ${itemCount} món` : 'Giỏ hàng'}
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
            {hasHydrated && itemCount > 0 ? (
              <span
                data-testid="cart-badge"
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold leading-none text-coffee-900 shadow-sm"
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}