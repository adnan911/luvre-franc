export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  details: string;
  image: string;
  tone: string;
  badge?: string;
};

export const products: Product[] = [
  {
    id: "atelier-overcoat",
    name: "The Atelier Overcoat",
    category: "Outerwear",
    price: 168,
    description: "A generous, clean-lined coat cut from dense charcoal wool.",
    details: "Relaxed tailoring · Italian wool blend · Horn buttons · Dry clean",
    image: "/hero-campaign.jpg",
    tone: "charcoal",
    badge: "Signature",
  },
  {
    id: "meridian-knit",
    name: "Meridian Knit",
    category: "Knitwear",
    price: 84,
    description: "A warm ivory knit with a softly structured shoulder.",
    details: "Heavyweight cotton · Ribbed finish · Dropped shoulder · Machine wash",
    image: "/hero-campaign.jpg",
    tone: "ivory",
  },
  {
    id: "port-trouser",
    name: "Port Pleated Trouser",
    category: "Trousers",
    price: 96,
    description: "A relaxed pleat and long line for everyday movement.",
    details: "Italian-milled twill · High rise · Wide leg · Dry clean",
    image: "/hero-campaign.jpg",
    tone: "espresso",
  },
  {
    id: "monument-shirt",
    name: "Monument Oxford",
    category: "Shirting",
    price: 64,
    description: "The everyday Oxford, sharpened with a quiet blue stripe.",
    details: "Organic cotton · Button-down collar · Mother-of-pearl buttons",
    image: "/hero-campaign.jpg",
    tone: "blue",
    badge: "New season",
  },
  {
    id: "field-leather-tote",
    name: "Field Leather Tote",
    category: "Accessories",
    price: 118,
    description: "A structured carryall that softens with every trip.",
    details: "Full-grain leather · Cotton twill lining · Interior pocket",
    image: "/hero-campaign.jpg",
    tone: "leather",
  },
  {
    id: "northline-belt",
    name: "Northline Belt",
    category: "Accessories",
    price: 42,
    description: "A simple leather belt with a considered brushed buckle.",
    details: "Vegetable-tanned leather · Brushed brass · 35mm width",
    image: "/hero-campaign.jpg",
    tone: "leather",
  },
];

export const currencyLabel = "USDC";

export function getProduct(productId: string) {
  return products.find((product) => product.id === productId);
}

export function calculateCartTotal(lines: Array<{ productId: string; quantity: number }>) {
  return lines.reduce((sum, line) => {
    const product = getProduct(line.productId);
    if (!product) return sum;
    const quantity = Math.max(0, Math.min(10, Math.floor(line.quantity)));
    return sum + product.price * quantity;
  }, 0);
}
