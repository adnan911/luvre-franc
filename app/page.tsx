"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { products, type Product } from "../lib/catalog";
import { PayWithDrutoButton } from "../components/PayWithDrutoButton";

type CartLine = { productId: string; quantity: number };

type Customer = { name: string; email: string; line1: string; city: string; postalCode: string; country: string };

const initialCustomer: Customer = { name: "", email: "", line1: "", city: "", postalCode: "", country: "" };
const marketplaceId = process.env.NEXT_PUBLIC_DRUTO_MARKETPLACE_ID ?? "luvre-franc";
const sellerId = process.env.NEXT_PUBLIC_DRUTO_SELLER_ID ?? "luvre-main";
const sellerDashboardUrl = process.env.NEXT_PUBLIC_DRUTO_DASHBOARD_URL ?? "https://druto-platform.manus.space/dashboard";

function formatUsdc(value: number) {
  return `${value.toFixed(2)} USDC`;
}

export default function HomePage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState(initialCustomer);
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("luvre-franc-cart");
      if (saved) setCart(JSON.parse(saved) as CartLine[]);
    } catch { /* A fresh cart is the safe fallback. */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("luvre-franc-cart", JSON.stringify(cart));
  }, [cart]);

  const cartDetails = useMemo(() => cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ ...product, quantity: line.quantity, lineTotal: product.price * line.quantity }] : [];
  }), [cart]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartDetails.reduce((sum, line) => sum + line.lineTotal, 0);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => line.productId === product.id ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line);
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    setCart((current) => current.map((line) => line.productId === productId ? { ...line, quantity: Math.max(0, Math.min(10, nextQuantity)) } : line).filter((line) => line.quantity > 0));
  }

  function beginCheckout() {
    if (!cart.length) return;
    setOrderId(`lf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  const isCustomerValid = customer.name.trim().length > 1 && /^\S+@\S+\.\S+$/.test(customer.email) && customer.line1.trim().length > 2 && customer.city.trim().length > 1 && customer.postalCode.trim().length > 2 && customer.country.trim().length > 1;
  const orderContextItems = cartDetails.map((line) => ({ productId: line.id, name: line.name, seller: sellerId, unitPrice: line.price, quantity: line.quantity }));

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="container nav">
          <a className="brand" href="#top" aria-label="Luvre Franc home">luvre <span>franc</span></a>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="#collection">Collection</a>
            <a href="#principles">Our approach</a>
            <a href="#objects">Objects</a>
          </nav>
          <div className="nav-actions">
            <a className="nav-action" href={sellerDashboardUrl}>Seller access</a>
            <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
              <ShoppingBag size={14} /><span>Cart</span><span className="cart-count">({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Luvre Franc / Studio 01</span>
          <h1 className="display hero-title">A wardrobe for <em>the long way around.</em></h1>
          <p className="hero-subtitle">Modern menswear and daily objects, considered in the quiet space between utility and desire.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#collection">Explore the collection <ArrowDown size={14} /></a>
            <a className="secondary-button" href="#principles">Our approach</a>
          </div>
          <div className="hero-note"><strong>Arc Testnet / USDC</strong>Pay securely with your wallet or QR through Druto. Non-custodial by design.</div>
        </div>
        <div className="hero-media" aria-label="Luvre Franc editorial campaign image" role="img" />
      </section>

      <div className="ticker"><div className="container ticker-inner"><span>Small runs · considered materials · no noise</span><span>Pay with Druto on Arc Testnet</span><span className="mono">LF / 2026</span></div></div>

      <section className="section" id="collection">
        <div className="container">
          <div className="section-heading"><div><span className="eyebrow">The collection</span><h2 className="display">Pieces with a point of view.</h2></div><p>Curated garments and daily objects for the daily rotation. Add to bag, then pay in Arc Testnet USDC at checkout.</p></div>
          <div className="product-grid">
            {products.map((product) => <article className="product-card" key={product.id}>
              <div className={`product-image tone-${product.tone}`}><img src={product.image} alt={product.name} />{product.badge && <span className="product-badge">{product.badge}</span>}</div>
              <div className="product-meta"><div><div className="product-name">{product.name}</div><div className="product-category">{product.category}</div></div><div className="product-price">{formatUsdc(product.price)}</div></div>
              <p className="product-description">{product.description}</p>
              <button className="product-quick-add" type="button" onClick={() => addToCart(product)}><span>Add to bag</span><Plus size={14} /></button>
            </article>)}
          </div>
        </div>
      </section>

      <section className="manifesto" id="principles"><div className="container manifesto-layout"><div><span className="eyebrow">The Luvre Franc principle</span><h2 className="display">Good design should feel inevitable.</h2></div><div className="manifesto-copy"><p>We make clothes and objects for people who notice the weight of a button, the fall of a trouser, the way a bag settles after a year of use.</p><p>No seasonal theatre. No disposable urgency. Just a compact system of pieces that gets better the more you live in it.</p><div className="manifesto-rule" /><p className="mono">01 / Make less, make it matter.</p></div></div></section>

      <section className="detail-band" id="objects"><div className="container detail-grid"><div className="detail-image" role="img" aria-label="Field Leather Tote editorial still life" /><div className="detail-copy"><span className="eyebrow">Object study / 01</span><h2 className="display">The objects earn their place.</h2><p>Our accessories are designed as companions rather than accents: tactile, useful, and quietly present.</p><ul className="detail-list"><li><span>Materials</span><span>Full-grain leather / brushed brass</span></li><li><span>Use</span><span>Workday / weekend / elsewhere</span></li><li><span>Payment</span><span>Arc Testnet USDC via Druto</span></li></ul></div></div></section>

      <footer className="footer"><div className="container"><div className="footer-top"><div><a className="brand" href="#top">luvre <span>franc</span></a><p className="footer-copy">A quiet system of menswear and daily objects. Built for the long way around.</p></div><div className="footer-links"><div><strong>Explore</strong><a href="#collection">Collection</a><a href="#principles">Our approach</a></div><div><strong>Payment</strong><span>USDC on Arc Testnet</span><a href={sellerDashboardUrl}>Seller access</a></div></div></div><div className="footer-bottom"><span>© 2026 Luvre Franc Studio</span><span>Public demo · Testnet only · No production funds</span><a href="https://arcscan.app" target="_blank" rel="noreferrer">View Arcscan ↗</a></div></div></footer>

      {cartOpen && <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="cart-drawer" aria-label="Shopping cart"><div className="drawer-head"><h2>Your bag <span className="mono">({cartCount})</span></h2><button className="close-button" type="button" onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={18} /></button></div>{cartDetails.length === 0 ? <div className="cart-lines"><div className="empty-cart"><strong>Your bag is quiet.</strong>Add a piece from the collection to begin.</div></div> : <><div className="cart-lines">{cartDetails.map((line) => <div className={`cart-line tone-${line.tone}`} key={line.id}><img src={line.image} alt="" /><div><div className="cart-line-name">{line.name}</div><div className="cart-line-detail">{line.category}<br />{formatUsdc(line.price)} each</div><div className="quantity-row"><button type="button" onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label={`Decrease ${line.name} quantity`}><Minus size={11} /></button><span>{line.quantity}</span><button type="button" onClick={() => updateQuantity(line.id, line.quantity + 1)} aria-label={`Increase ${line.name} quantity`}><Plus size={11} /></button></div></div><div><div className="cart-line-price">{formatUsdc(line.lineTotal)}</div><button className="remove-link" type="button" onClick={() => updateQuantity(line.id, 0)}>Remove</button></div></div>)}</div><div className="drawer-footer"><div className="total-row"><span>Subtotal</span><strong>{formatUsdc(cartTotal)}</strong></div><button className="primary-button full-button" type="button" onClick={beginCheckout}>Continue to checkout <ArrowRight size={14} /></button></div></>}</aside></div>}

      {checkoutOpen && <div className="checkout-overlay" role="presentation"><div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><div className="checkout-panel"><div className="summary-head"><span className="eyebrow">Checkout / {orderId.slice(-6)}</span><button className="close-button" type="button" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={18} /></button></div><h2 className="checkout-title" id="checkout-title">A considered purchase.</h2><p className="checkout-subtitle">Enter your delivery details. We will create a server-side Druto Payment Intent using this order total, then open wallet or QR checkout on Arc Testnet.</p><div className="field-grid"><div className="field"><label htmlFor="name">Full name</label><input id="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" /></div><div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" /></div><div className="field"><label htmlFor="line1">Address</label><input id="line1" value={customer.line1} onChange={(event) => setCustomer({ ...customer, line1: event.target.value })} autoComplete="street-address" /></div><div className="field"><label htmlFor="city">City / postal code</label><div className="two-field-row"><input id="city" value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} autoComplete="address-level2" /><input id="postalCode" value={customer.postalCode} onChange={(event) => setCustomer({ ...customer, postalCode: event.target.value })} autoComplete="postal-code" /></div></div><div className="field"><label htmlFor="country">Country</label><input id="country" value={customer.country} onChange={(event) => setCustomer({ ...customer, country: event.target.value })} autoComplete="country-name" /></div></div><div className="network-note"><strong>Arc Testnet · USDC only</strong>This is a public testnet storefront. Confirm the network, amount, and receiving wallet in your wallet before signing.</div>{isCustomerValid && <PayWithDrutoButton orderId={orderId} itemName={cartDetails.length === 1 ? cartDetails[0].name : `${cartDetails[0]?.name} + ${cartDetails.length - 1} more`} amount={cartTotal} buyerEmail={customer.email} marketplaceId={marketplaceId} sellerId={sellerId} items={orderContextItems} shippingAddress={customer} />}</div><div className="checkout-panel"><div className="checkout-summary"><div className="summary-head"><h3>Order summary</h3><span className="mono">{cartCount} item{cartCount === 1 ? "" : "s"}</span></div>{cartDetails.map((line) => <div className="summary-item" key={line.id}><div>{line.name}<small>{line.quantity} × {formatUsdc(line.price)}</small></div><span>{formatUsdc(line.lineTotal)}</span></div>)}<div className="summary-total"><span>Total</span><strong>{formatUsdc(cartTotal)}</strong></div><p className="checkout-subtitle summary-footnote"><Check size={13} /> Your card details never touch Luvre Franc. Druto routes the non-custodial wallet or QR payment and reports verified settlement back to the seller dashboard.</p></div></div></div></div>}
    </main>
  );
}
