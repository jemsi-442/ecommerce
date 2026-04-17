import { createContext, useEffect, useMemo, useState } from "react";

export const CartContext = createContext();

const CART_STORAGE_KEY = "ecommerce_cart";

const makeCartItemId = (productId, variantId) =>
  `${productId}:${variantId || "default"}`;

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    setCart((prev) => {
      const itemId = makeCartItemId(product.productId, product.variant?._id);
      const existing = prev.find((p) => p.id === itemId);

      if (existing) {
        return prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                qty: Math.min(item.qty + (product.qty || 1), item.stock || 999999),
              }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          id: itemId,
          qty: product.qty || 1,
        },
      ];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const updateQty = (id, qty) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const safeQty = Math.max(1, Math.min(qty, item.stock || 999999));
        return { ...item, qty: safeQty };
      })
    );
  };

  const clearCart = () => setCart([]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQty, clearCart, cartCount }}
    >
      {children}
    </CartContext.Provider>
  );
};
