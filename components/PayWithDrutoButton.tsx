"use client";

import { ArrowUpRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

type CartLine = { productId: string; name: string; quantity: number; unitPrice: number };

type Props = {
  orderId: string;
  itemName: string;
  amount: number;
  buyerEmail: string;
  marketplaceId: string;
  sellerId: string;
  items: CartLine[];
  shippingAddress: { name: string; line1: string; city: string; postalCode: string; country: string };
};

type PaymentSession = {
  id: string;
  checkoutUrl: string;
  displayAmount: string;
  asset: "USDC";
  network: "arc-testnet";
  merchantAddress: string;
  expiresAt: string;
};

export function PayWithDrutoButton({ orderId, itemName, amount, buyerEmail,   marketplaceId, sellerId, items, shippingAddress }: Props) {
  const [status, setStatus] = useState<"ready" | "loading" | "error" | "success">("ready");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<PaymentSession | null>(null);

  async function startPayment() {
    setStatus("loading");
    setMessage("Creating a secure payment session…");
    setSession(null);
    try {
      const response = await fetch("/api/druto/create-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemName,
          amount,
          buyerEmail,
          marketplaceId,
          sellerId,
          items,
          shippingAddress,
          returnUrl: `${window.location.origin}/orders/${encodeURIComponent(orderId)}/paid`,
        }),
      });
      const payload = await response.json() as PaymentSession & { error?: string };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error ?? "Druto could not create the checkout session.");
      setSession(payload);
      setStatus("success");
      setMessage("Payment session ready. Redirecting to Druto for wallet or QR payment…");
      // The hosted Druto page owns wallet connection and QR presentation.
      // Keep the browser redirect here so one Pay with Druto click completes
      // the handoff without exposing API credentials or receiving-wallet logic.
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start payment. Please try again.");
    }
  }

  function openCheckout() {
    if (!session) return;
    window.location.assign(session.checkoutUrl);
  }

  return (
    <div className="druto-pay-shell">
      {status === "ready" && (
        <button className="primary-button full-button" type="button" onClick={() => void startPayment()}>
          <span>Pay with Druto</span><ArrowUpRight size={15} />
        </button>
      )}
      {status === "loading" && (
        <button className="primary-button full-button" type="button" disabled aria-busy="true">
          <LoaderCircle className="spinning-icon" size={15} /><span>Preparing secure checkout</span>
        </button>
      )}
      {status === "success" && session && (
        <>
          <button className="primary-button full-button" type="button" onClick={openCheckout}>
            <Check size={15} /><span>Continue to wallet / QR</span><ArrowUpRight size={15} />
          </button>
          <div className="status-box success" role="status">
            <p><strong>{message}</strong><br />{session.displayAmount} {session.asset} · Arc Testnet</p>
          </div>
        </>
      )}
      {status === "error" && (
        <>
          <div className="status-box error" role="alert"><p>{message}</p></div>
          <button className="secondary-button retry-button" type="button" onClick={() => void startPayment()}>Try again</button>
        </>
      )}
      {status !== "error" && <p className="checkout-trust"><ShieldCheck size={13} /> Non-custodial checkout · Druto verifies onchain settlement</p>}
    </div>
  );
}
