"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  TrendingUp, 
  Wallet,
  Activity,
  Layers,
  Copy,
  Check
} from "lucide-react";

export default function DrutoDashboardPage() {
  const [copied, setCopied] = useState(false);

  const merchantAddress = "0xA32c7bbB2fb634bED4DfC812c15AF87a0C727217";

  function handleCopy() {
    navigator.clipboard.writeText(merchantAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const transactions = [
    {
      id: "pi_lf_12345678",
      orderId: "lf-12345678",
      amount: "168.00 USDC",
      status: "Settled",
      network: "Arc Testnet",
      buyer: "0x742d...f44e",
      time: "Just now",
      txHash: "0x39a1c8...f902",
    },
    {
      id: "pi_lf_89201948",
      orderId: "lf-89201948",
      amount: "340.00 USDC",
      status: "Settled",
      network: "Arc Testnet",
      buyer: "0x981b...291a",
      time: "2 hours ago",
      txHash: "0x892a01...bc41",
    },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d0e12",
      color: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "32px 24px"
    }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#9ca3af",
                textDecoration: "none",
                fontSize: "13px",
                backgroundColor: "#161820",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #282b36"
              }}
            >
              <ArrowLeft size={14} /> Back to Storefront
            </Link>
            <span style={{ color: "#4b5563" }}>/</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
                color: "#ffffff"
              }}>
                D
              </div>
              <span style={{ fontWeight: 600, fontSize: "15px" }}>Druto Seller Dashboard</span>
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            color: "#22c55e",
            padding: "6px 12px",
            borderRadius: "20px",
            border: "1px solid rgba(34, 197, 94, 0.25)"
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
            Seller Active: <strong>luvre-main</strong>
          </div>
        </div>

        {/* Overview Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          <div style={{ backgroundColor: "#161820", borderRadius: "14px", padding: "20px", border: "1px solid #282b36" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "13px", marginBottom: "12px" }}>
              <span>Settled Revenue (USDC)</span>
              <TrendingUp size={16} color="#22c55e" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>$508.00</div>
            <div style={{ fontSize: "12px", color: "#38bdf8", marginTop: "6px" }}>Arc Testnet Rail</div>
          </div>

          <div style={{ backgroundColor: "#161820", borderRadius: "14px", padding: "20px", border: "1px solid #282b36" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "13px", marginBottom: "12px" }}>
              <span>Marketplace / Seller</span>
              <Layers size={16} color="#a855f7" />
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff" }}>luvre-franc / luvre-main</div>
            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>Status: Verified Non-Custodial</div>
          </div>

          <div style={{ backgroundColor: "#161820", borderRadius: "14px", padding: "20px", border: "1px solid #282b36" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", fontSize: "13px", marginBottom: "12px" }}>
              <span>Settlement Receiving Wallet</span>
              <Wallet size={16} color="#f59e0b" />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#e5e7eb" }}>{merchantAddress.slice(0, 8)}...{merchantAddress.slice(-6)}</span>
              <button
                onClick={handleCopy}
                style={{ background: "none", border: "none", color: copied ? "#22c55e" : "#9ca3af", cursor: "pointer" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div style={{ fontSize: "12px", color: "#22c55e", marginTop: "6px" }}>✓ Ownership Challenge Verified</div>
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{ backgroundColor: "#161820", borderRadius: "14px", border: "1px solid #282b36", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #282b36", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} color="#6366f1" />
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Arc Testnet Payment Ledger</h3>
            </div>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>Auto-reconciled with signed webhooks</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#13141b", color: "#9ca3af", borderBottom: "1px solid #282b36" }}>
                  <th style={{ padding: "14px 24px" }}>Payment Intent ID</th>
                  <th style={{ padding: "14px 24px" }}>Store Order Reference</th>
                  <th style={{ padding: "14px 24px" }}>Amount</th>
                  <th style={{ padding: "14px 24px" }}>Network</th>
                  <th style={{ padding: "14px 24px" }}>Status</th>
                  <th style={{ padding: "14px 24px" }}>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #222530" }}>
                    <td style={{ padding: "16px 24px", fontFamily: "monospace", color: "#e5e7eb" }}>{tx.id}</td>
                    <td style={{ padding: "16px 24px", fontFamily: "monospace", color: "#9ca3af" }}>{tx.orderId}</td>
                    <td style={{ padding: "16px 24px", fontWeight: 600, color: "#ffffff" }}>{tx.amount}</td>
                    <td style={{ padding: "16px 24px", color: "#38bdf8" }}>{tx.network}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        color: "#22c55e",
                        fontSize: "12px",
                        fontWeight: 500
                      }}>
                        <CheckCircle2 size={12} /> {tx.status}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontFamily: "monospace", color: "#6366f1" }}>
                      <a
                        href={`https://testnet.arcscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#818cf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        {tx.txHash} <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
