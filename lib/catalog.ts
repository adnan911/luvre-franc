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
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80",
    tone: "ivory",
  },
  {
    id: "port-trouser",
    name: "Port Pleated Trouser",
    category: "Trousers",
    price: 96,
    description: "A relaxed pleat and long line for everyday movement.",
    details: "Italian-milled twill · High rise · Wide leg · Dry clean",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80",
    tone: "espresso",
  },
  {
    id: "monument-shirt",
    name: "Monument Oxford",
    category: "Shirting",
    price: 64,
    description: "The everyday Oxford, sharpened with a quiet blue stripe.",
    details: "Organic cotton · Button-down collar · Mother-of-pearl buttons",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    tone: "leather",
  },
  {
    id: "northline-belt",
    name: "Northline Belt",
    category: "Accessories",
    price: 42,
    description: "A simple leather belt with a considered brushed buckle.",
    details: "Vegetable-tanned leather · Brushed brass · 35mm width",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
    tone: "leather",
  },
  {
    id: "canvas-coaster-set",
    name: "Atelier Canvas Coaster Set",
    category: "Living & Studio",
    price: 2,
    description: "Heavyweight natural canvas coasters with stitched edge detailing.",
    details: "Set of 4 · 100% unbleached cotton canvas · Machine washable",
    image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
    tone: "ivory",
  },
  {
    id: "mercer-rib-sock",
    name: "Mercer Ribbed Cotton Sock",
    category: "Essentials",
    price: 3,
    description: "Breathable combed cotton socks with mid-calf ribbed support.",
    details: "Combed organic cotton · Reinforced heel & toe · Made in Portugal",
    image: "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=800&q=80",
    tone: "charcoal",
  },
  {
    id: "solid-brass-keyring",
    name: "Solid Brass Key Ring",
    category: "Hardware",
    price: 4,
    description: "Turned solid brass split ring with subtle laser hallmark.",
    details: "Solid unfinished brass · 30mm diameter · Develops natural patina",
    image: "https://images.unsplash.com/photo-1614350292329-87a412ba77ff?auto=format&fit=crop&w=800&q=80",
    tone: "leather",
    badge: "Essential",
  },
  {
    id: "paracord-key-lanyard",
    name: "Braided Utility Lanyard",
    category: "Accessories",
    price: 5,
    description: "High-tensile braided utility cord with matte black steel carabiner.",
    details: "Braided nylon cord · Stainless steel hardware · 48cm length",
    image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80",
    tone: "blue",
  },
  {
    id: "cedar-garment-block",
    name: "Aromatic Cedar Wardrobe Block",
    category: "Care & Storage",
    price: 5,
    description: "Natural aromatic cedarwood block with brushed metal hanging hook.",
    details: "100% Red Cedar · Natural moth repellent · Sand lightly to renew",
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    tone: "espresso",
  },
  {
    id: "woven-linen-handkerchief",
    name: "Woven Linen Pocket Square",
    category: "Accessories",
    price: 6,
    description: "Crisp washed linen pocket square finished with hand-rolled hems.",
    details: "100% French linen · 33x33 cm · Hand-rolled edge · Dry clean",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
    tone: "blue",
  },
  {
    id: "horn-button-set",
    name: "Natural Horn Button Set",
    category: "Hardware",
    price: 7,
    description: "Matte finished genuine buffalo horn buttons for tailoring repair.",
    details: "Set of 6 · Genuine water buffalo horn · Matte satin finish",
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80",
    tone: "charcoal",
  },
  {
    id: "studio-linen-notebook",
    name: "Studio Linen Notebook",
    category: "Paper & Objects",
    price: 8,
    description: "Hardcover ruled journal wrapped in natural archival bookcloth.",
    details: "160 pages · 120gsm acid-free paper · Ribbon marker · Lay-flat binding",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    tone: "ivory",
    badge: "Studio",
  },
  {
    id: "minimalist-canvas-cap",
    name: "Low Profile Canvas Cap",
    category: "Headwear",
    price: 9,
    description: "Unstructured six-panel cap crafted from washed cotton twill.",
    details: "100% Washed cotton twill · Brass slider clasp · One size",
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80",
    tone: "espresso",
  },
  {
    id: "leather-balm-tin",
    name: "Beeswax Leather Balm",
    category: "Care & Storage",
    price: 10,
    description: "Hand-poured all-natural conditioner to nourish and protect fine leather.",
    details: "Organic beeswax & jojoba oil · 60ml aluminum tin · Made in small batches",
    image: "https://images.unsplash.com/photo-1608248597359-bb5eb4fb48aa?auto=format&fit=crop&w=800&q=80",
    tone: "leather",
    badge: "Crafted",
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
