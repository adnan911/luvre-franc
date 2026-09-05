"use client";

import { ArrowUpRight, LoaderCircle, ShieldCheck } from "lucide-react";
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

export function PayWithDrutoButton({ orderId, itemName, amount, buyerEmail, marketplaceId, sellerId, items, shippingAddress }: Props) {
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  async function handlePay() {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/druto/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount,
          itemName,
          buyerEmail,
          marketplaceId,
          sellerId,
          items,
          shippingAddress,
          returnUrl: `${window.location.origin}/orders/${encodeURIComponent(orderId)}/paid`,
        }),
      });

      const { redirectUrl, checkoutUrl, error } = await response.json();
      const targetUrl = redirectUrl || checkoutUrl;

      if (error || !response.ok || !targetUrl) {
        throw new Error(error || "Payment initiation failed. Please try again.");
      }

      // Redirect buyer directly to Hosted Druto Checkout
      window.location.href = targetUrl;
    } catch (error: any) {
      setStatus("error");
      const msg = error instanceof Error ? error.message : "Payment initiation failed. Please try again.";
      setErrorMessage(msg);
      alert("Payment initiation failed: " + msg);
    }
  }

  return (
    <div className="druto-pay-shell">
      {status === "ready" && (
        <button className="primary-button full-button" type="button" onClick={() => void handlePay()}>
          <span>Pay ${amount.toFixed(2)} USDC with Druto</span>
          <ArrowUpRight size={15} />
        </button>
      )}

      {status === "loading" && (
        <button className="primary-button full-button" type="button" disabled aria-busy="true">
          <LoaderCircle className="spinning-icon" size={15} />
          <span>Redirecting to Druto Checkout…</span>
        </button>
      )}

      {status === "error" && (
        <>
          <div className="status-box error" role="alert">
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button retry-button" type="button" onClick={() => void handlePay()}>
            Try again
          </button>
        </>
      )}

      {status !== "error" && (
        <p className="checkout-trust">
          <ShieldCheck size={13} /> Non-custodial checkout · Druto verifies onchain settlement
        </p>
      )}
    </div>
  );
}
