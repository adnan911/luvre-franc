export async function orderStore() {
  const [{ createOrderStore }, { orderDatabase }] = await Promise.all([
    import('./orders.mysql'), import('./database'),
  ]);
  return createOrderStore(orderDatabase());
}

export async function getOrder(id: string) { return (await orderStore()).get(id); }
