"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ShoppingCart, Menu, X, User } from "lucide-react";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { CartDrawer } from "@/components/customer/CartDrawer";

interface NavbarClientProps {
  locale: string;
}

export function NavbarClient({ locale }: NavbarClientProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems);
  const hasHydrated = useCartStore((s) => s._hasHydrated);

  useEffect(() => {
    rehydrateCart();
  }, []);

  const cartCount = hasHydrated ? totalItems() : 0;

  return (
    <>
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 font-extrabold text-[#1A1A2E] text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🦆</span>
            <span>
              B.Duck{" "}
              <span className="text-[#F5C842]">Cityfuns</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-600">
            <Link
              href={`/${locale}`}
              className="hover:text-[#1A1A2E] transition-colors"
            >
              Mua vé
            </Link>
            <Link
              href={`/${locale}/orders`}
              className="hover:text-[#1A1A2E] transition-colors"
            >
              Đơn hàng
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Auth */}
            <Link
              href={`/${locale}/auth/login`}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Đăng nhập"
            >
              <User className="h-4 w-4" />
              Đăng nhập
            </Link>

            {/* Cart button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label={`Giỏ hàng (${cartCount} sản phẩm)`}
              id="cart-button"
            >
              <ShoppingCart className="h-5 w-5 text-[#1A1A2E]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#F5C842] text-[#1A1A2E] text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-3 text-sm font-semibold text-gray-600">
            <Link
              href={`/${locale}`}
              onClick={() => setMobileOpen(false)}
              className="py-2 hover:text-[#1A1A2E]"
            >
              Mua vé
            </Link>
            <Link
              href={`/${locale}/orders`}
              onClick={() => setMobileOpen(false)}
              className="py-2 hover:text-[#1A1A2E]"
            >
              Đơn hàng
            </Link>
            <Link
              href={`/${locale}/auth/login`}
              onClick={() => setMobileOpen(false)}
              className="py-2 hover:text-[#1A1A2E]"
            >
              Đăng nhập
            </Link>
          </div>
        )}
      </nav>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        locale={locale}
      />
    </>
  );
}
