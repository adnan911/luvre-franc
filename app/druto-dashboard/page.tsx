import { redirect } from 'next/navigation';

export default function DrutoDashboardPage() {
  redirect(process.env.NEXT_PUBLIC_DRUTO_DASHBOARD_URL ?? 'https://druto-d1-testnet.robobq.workers.dev/dashboard');
}
