export const runtime = "nodejs";

// Synthetic signed payment events belong in isolated tests, never a public route.
export async function POST(_request: Request) {
  return Response.json({ error: "Payment simulation endpoint has been removed" }, { status: 410 });
}
