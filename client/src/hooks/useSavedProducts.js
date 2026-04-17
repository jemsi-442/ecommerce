import { useContext } from "react";
import { SavedProductsContext } from "../context/SavedProductsContext";

export const useSavedProducts = () => {
  const ctx = useContext(SavedProductsContext);
  if (!ctx) {
    throw new Error("useSavedProducts must be used within SavedProductsProvider");
  }
  return ctx;
};
