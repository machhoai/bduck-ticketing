"use client";

// Client Component extracted from ProductCard (D6: Composition Pattern)
// Handles cart interactions while ProductCard stays a Server Component for SEO
import { ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/stores/cart";
import { Button } from "@/components/ui/Button";
import type { ClientProduct } from "@/lib/serializeProduct";

interface AddToCartButtonProps {
  product: ClientProduct;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}

export function AddToCartButton({ product, disabled, variant = "primary", className }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  function handleAddToCart() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (disabled) {
    return (
      <Button variant="secondary" size="sm" disabled className="w-full opacity-40">
        Hết vé
      </Button>
    );
  }

  return (
    <Button
      variant={added ? "secondary" : variant}
      size="md"
      onClick={handleAddToCart}
      className={className || "w-full"}
      aria-label={`Thêm ${product.name} vào giỏ hàng`}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" />
          Đã thêm!
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" />
          Thêm vào giỏ
        </>
      )}
    </Button>
  );
}
