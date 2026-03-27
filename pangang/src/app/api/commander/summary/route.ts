import { proxyBackendJson } from '@/app/api/_lib/backend';

export async function GET() {
  return proxyBackendJson('/api/commander/summary', 5000);
}
