export interface OrderItem {
  productId: string;
  name: string;
  seller?: string;
  unitPrice: number;
  quantity: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Order {
  id: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  items: OrderItem[];
  customerEmail: string;
  shippingAddress?: ShippingAddress;
  paymentIntentId?: string;
  transactionHash?: string;
  paidAt?: string;
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __ordersStore: Map<string, Order> | undefined;
}

const ordersStore = globalThis.__ordersStore ?? new Map<string, Order>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__ordersStore = ordersStore;
}

export function createOrder(order: Omit<Order, "status" | "createdAt">): Order {
  if (ordersStore.has(order.id)) throw new Error("Order already exists");
  const newOrder: Order = {
    ...order,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  ordersStore.set(order.id, newOrder);
  return newOrder;
}

export function getOrder(orderId: string): Order | undefined {
  return ordersStore.get(orderId);
}

export function markOrderPaid(
  orderId: string,
  details?: {
    paymentIntentId?: string;
    transactionHash?: string;
    paidAt?: string;
  }
): Order | undefined {
  const existing = ordersStore.get(orderId);
  if (existing) {
    if (existing.status === "PAID") {
      if (details?.paymentIntentId !== existing.paymentIntentId || details?.transactionHash !== existing.transactionHash) {
        throw new Error("Order is already paid with a different settlement");
      }
      return existing;
    }
    existing.status = "PAID";
    if (details?.paymentIntentId) existing.paymentIntentId = details.paymentIntentId;
    if (details?.transactionHash) existing.transactionHash = details.transactionHash;
    existing.paidAt = details?.paidAt || new Date().toISOString();
    ordersStore.set(orderId, existing);
    return existing;
  }
  
  return undefined;
}

export function listOrders(): Order[] {
  return Array.from(ordersStore.values());
}
