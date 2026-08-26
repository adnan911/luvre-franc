"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Wallet, 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2, 
  Sparkles,
  ArrowRight,
  RefreshCw,
  Coins
} from "lucide-react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("orderId") || "lf-demo-order";
  const amount = searchParams.get("amount") || "168.00";
  const itemName = searchParams.get("itemName") || "Luvre Franc Curated Apparel";
  const buyerEmail = searchParams.get("buyerEmail") || "customer@example.com";
  const returnUrl = searchParams.get("returnUrl") || `/orders/${encodeURIComponent(orderId)}/paid`;
  const marketplaceId = searchParams.get("marketplaceId") || "luvre-franc";
  const sellerId = searchParams.get("sellerId") || "luvre-main";

  const merchantAddress = "0xA32c7bbB2fb634bED4DfC812c15AF87a0C727217";
  const [activeTab, setActiveTab] = useState<"wallet" | "qr">("wallet");
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"idle" | "connecting" | "broadcasting" | "settled">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(1799); // 30 min countdown

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  function handleCopy() {
    navigator.clipboard.writeText(merchantAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handlePay(mode: "wallet" | "qr") {
    setIsProcessing(true);
    setStep("connecting");

    await new Promise((r) => setTimeout(r, 900));
    setStep("broadcasting");

    try {
      // Trigger Druto settlement & signed webhook dispatch
      const res = await fetch("/api/druto/simulate-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount,
          marketplaceId,
          sellerId,
        }),
      });
      const data = await res.json();
      setTxHash(data.transactionHash || "0x98f4e2...a12c");
      setStep("settled");

      await new Promise((r) => setTimeout(r, 1400));
      // Redirect to storefront paid page
      const destination = returnUrl.startsWith("http")
        ? returnUrl
        : `${window.location.origin}${returnUrl}`;
      window.location.assign(destination);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setStep("idle");
      alert("Payment simulation failed. Please try again.");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d0e12",
      color: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "520px",
        backgroundColor: "#161820",
        borderRadius: "16px",
        border: "1px solid #282b36",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.65)",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px",
          borderBottom: "1px solid #282b36",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
                color: "#ffffff"
              }}>
                D
              </div>
              <span style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "-0.01em" }}>
                Druto Hosted Gateway
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>
              Merchant: <strong style={{ color: "#e5e7eb" }}>Luvre Franc</strong> · Arc Testnet
            </p>
          </div>
          <div style={{
            fontSize: "12px",
            color: "#9ca3af",
            backgroundColor: "#1f222e",
            padding: "6px 12px",
            borderRadius: "20px",
            fontVariantNumeric: "tabular-nums"
          }}>
            Expires in <span style={{ color: "#f59e0b", fontWeight: 600 }}>{timeFormatted}</span>
          </div>
        </div>

        {/* Order Details Bar */}
        <div style={{
          padding: "18px 28px",
          backgroundColor: "#13141b",
          borderBottom: "1px solid #222530",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <span style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Order Reference
            </span>
            <div style={{ fontSize: "14px", fontWeight: 500, fontFamily: "monospace", color: "#e5e7eb", marginTop: "2px" }}>
              {orderId}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Amount Due
            </span>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
              {amount} <span style={{ fontSize: "13px", fontWeight: 600, color: "#38bdf8" }}>USDC</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #282b36",
          padding: "0 28px"
        }}>
          <button
            onClick={() => setActiveTab("wallet")}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "wallet" ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === "wallet" ? "#ffffff" : "#9ca3af",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Wallet size={16} />
            Connect Wallet
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "qr" ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === "qr" ? "#ffffff" : "#9ca3af",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <QrCode size={16} />
            Pay with QR
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: "28px" }}>
          {step === "settled" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}>
                <Check size={28} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Payment Settled</h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9ca3af" }}>
                Druto verified the Arc Testnet USDC transfer. Returning to Luvre Franc…
              </p>
              {txHash && (
                <div style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "#38bdf8",
                  wordBreak: "break-all",
                  backgroundColor: "#13141b",
                  padding: "8px 12px",
                  borderRadius: "8px"
                }}>
                  Tx: {txHash}
                </div>
              )}
            </div>
          ) : activeTab === "wallet" ? (
            <div>
              <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 20px" }}>
                Connect an EVM wallet to approve the transfer of <strong>{amount} USDC</strong> on <strong>Arc Testnet (Chain ID 5042002)</strong>.
              </p>

              {/* Wallet Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  backgroundColor: "#1c1f2b",
                  borderRadius: "10px",
                  border: "1px solid #2f3445"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: "12px" }}>🦊</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 500 }}>MetaMask / Browser Wallet</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>Detected EVM Provider</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", backgroundColor: "#22c55e22", color: "#22c55e", padding: "3px 8px", borderRadius: "12px", fontWeight: 500 }}>
                    Ready
                  </span>
                </div>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  backgroundColor: "#1c1f2b",
                  borderRadius: "10px",
                  border: "1px solid #2f3445"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: "12px" }}>🌐</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 500 }}>Coinbase / Rainbow / Rabby</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>Multi-wallet compatible</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handlePay("wallet")}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "none",
                  background: isProcessing
                    ? "#374151"
                    : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)"
                }}
              >
                {step === "connecting" ? (
                  <>
                    <Loader2 size={18} className="spinning-icon" />
                    Connecting to Arc Testnet…
                  </>
                ) : step === "broadcasting" ? (
                  <>
                    <Loader2 size={18} className="spinning-icon" />
                    Verifying onchain settlement…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Approve & Pay {amount} USDC
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 16px", textAlign: "center" }}>
                Scan with any EVM-compatible mobile wallet on <strong>Arc Testnet</strong>
              </p>

              {/* QR Code Container */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "12px",
                width: "fit-content",
                margin: "0 auto 20px"
              }}>
                <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
                  {/* Stylized QR representation */}
                  <rect width="180" height="180" fill="white" />
                  <rect x="15" y="15" width="45" height="45" stroke="#111827" strokeWidth="8" fill="white" />
                  <rect x="27" y="27" width="21" height="21" fill="#111827" />
                  <rect x="120" y="15" width="45" height="45" stroke="#111827" strokeWidth="8" fill="white" />
                  <rect x="132" y="27" width="21" height="21" fill="#111827" />
                  <rect x="15" y="120" width="45" height="45" stroke="#111827" strokeWidth="8" fill="white" />
                  <rect x="27" y="132" width="21" height="21" fill="#111827" />
                  {/* Grid Dots */}
                  <circle cx="80" cy="30" r="5" fill="#111827" />
                  <circle cx="95" cy="30" r="5" fill="#111827" />
                  <circle cx="80" cy="50" r="5" fill="#111827" />
                  <circle cx="95" cy="70" r="5" fill="#111827" />
                  <circle cx="30" cy="80" r="5" fill="#111827" />
                  <circle cx="50" cy="80" r="5" fill="#111827" />
                  <circle cx="70" cy="95" r="5" fill="#111827" />
                  <circle cx="90" cy="90" r="8" fill="#6366f1" />
                  <circle cx="110" cy="95" r="5" fill="#111827" />
                  <circle cx="130" cy="80" r="5" fill="#111827" />
                  <circle cx="150" cy="80" r="5" fill="#111827" />
                  <circle cx="80" cy="130" r="5" fill="#111827" />
                  <circle cx="95" cy="130" r="5" fill="#111827" />
                  <circle cx="80" cy="150" r="5" fill="#111827" />
                  <circle cx="130" cy="130" r="5" fill="#111827" />
                  <circle cx="150" cy="150" r="5" fill="#111827" />
                </svg>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#4b5563", fontWeight: 600 }}>
                  {amount} USDC · Arc Testnet
                </div>
              </div>

              {/* Copy Address */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#13141b",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #282b36",
                marginBottom: "20px"
              }}>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "10px" }}>
                  {merchantAddress}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: "none",
                    border: "none",
                    color: copied ? "#22c55e" : "#38bdf8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 500,
                    padding: "4px 8px"
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Simulate QR Payment Button */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handlePay("qr")}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #374151",
                  backgroundColor: "#1f222e",
                  color: "#e5e7eb",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="spinning-icon" />
                    Detecting onchain deposit…
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Simulate QR Transfer Received
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: "16px 28px",
          backgroundColor: "#101117",
          borderTop: "1px solid #222530",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#6b7280"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={14} color="#10b981" />
            Non-custodial smart settlement
          </div>
          <div>Arcscan Chain ID: 5042002</div>
        </div>
      </div>

      <div style={{ marginTop: "16px", fontSize: "12px", color: "#6b7280" }}>
        Powered by <strong>Druto Payments Protocol</strong>
      </div>
    </div>
  );
}

export default function DrutoCheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", backgroundColor: "#0d0e12", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} className="spinning-icon" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
