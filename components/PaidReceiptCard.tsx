"use client";

import { CheckCircle2, ExternalLink, Printer, Store } from "lucide-react";

type Props = {
  orderId: string;
  order?: {
    id: string;
    amount: number;
    status: string;
    paymentIntentId?: string;
    transactionHash?: string;
    createdAt?: string;
    customerEmail?: string;
  } | null;
  marketplaceUrl?: string;
  marketplaceName?: string;
};

export function PaidReceiptCard({
  orderId,
  order,
  marketplaceUrl = "/",
  marketplaceName = "Return to Marketplace",
}: Props) {
  const isPaid = order?.status === "PAID" || !order?.status || order?.status === "SETTLED";
  const txHash = order?.transactionHash;
  const explorerUrl = txHash ? `https://explorer.testnet.arc.io/tx/${txHash}` : null;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="receipt-wrapper">
      {/* Verified Payment Receipt Card (Printed up to transaction line) */}
      <div className="receipt-card" id="printable-receipt">
        <div className="receipt-card-header">
          <div className="receipt-badge-row">
            <span className="receipt-status-badge">
              <CheckCircle2 size={14} className="receipt-check-icon" />
              {isPaid ? "Payment Verified" : "Verification in Progress"}
            </span>
            <span className="receipt-network-tag">Arc Testnet · USDC</span>
          </div>
          <h2 className="receipt-title">Transaction Receipt</h2>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-details-list">
          <div className="receipt-row">
            <span className="receipt-label">Order Reference</span>
            <span className="receipt-value mono">{orderId}</span>
          </div>

          {order?.paymentIntentId && (
            <div className="receipt-row">
              <span className="receipt-label">Payment Intent</span>
              <span className="receipt-value mono">{order.paymentIntentId}</span>
            </div>
          )}

          <div className="receipt-row">
            <span className="receipt-label">Amount Paid</span>
            <span className="receipt-value receipt-amount mono">
              ${(order?.amount ?? 0).toFixed(2)} USDC
            </span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Settlement Status</span>
            <span className="receipt-value receipt-status-text">
              {isPaid ? "Confirmed Onchain" : "Pending Confirmation"}
            </span>
          </div>

          {txHash && (
            <div className="receipt-row receipt-tx-row">
              <span className="receipt-label">Transaction Hash</span>
              <span className="receipt-value mono">
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="receipt-explorer-link"
                    title={txHash}
                  >
                    <span>{txHash.slice(0, 10)}…{txHash.slice(-8)}</span>
                    <ExternalLink size={12} className="no-print" />
                  </a>
                ) : (
                  <span>{txHash}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: Save/Print on top, Return to Marketplace directly below */}
      <div className="receipt-actions no-print">
        <button
          type="button"
          className="secondary-button receipt-action-button print-button"
          onClick={handlePrint}
        >
          <Printer size={15} />
          <span>Save or print receipt</span>
        </button>

        <a
          href={marketplaceUrl}
          className="primary-button receipt-action-button return-button"
        >
          <Store size={15} />
          <span>{marketplaceName}</span>
        </a>
      </div>
    </div>
  );
}
