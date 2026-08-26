import { describe, expect, it } from "vitest";
import { calculateCartTotal, getProduct, products } from "./catalog";

describe("Luvre Franc catalog", () => {
  it("contains a curated catalog with stable product IDs", () => {
    expect(products.length).toBeGreaterThanOrEqual(6);
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
    expect(getProduct("atelier-overcoat")?.name).toBe("The Atelier Overcoat");
  });

  it("calculates trusted totals from product IDs and quantities", () => {
    expect(calculateCartTotal([
      { productId: "atelier-overcoat", quantity: 1 },
      { productId: "monument-shirt", quantity: 2 },
    ])).toBe(296);
  });

  it("ignores unknown products and clamps quantities", () => {
    expect(calculateCartTotal([
      { productId: "unknown", quantity: 2 },
      { productId: "meridian-knit", quantity: 99 },
      { productId: "port-trouser", quantity: -4 },
    ])).toBe(840);
  });
});
