import { proxyBackendJson } from '@/app/api/_lib/backend';

export async function GET() {
  return proxyBackendJson('/api/btc/summary', 4000);
}
