import { proxyBackendJson } from '@/app/api/_lib/backend';

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyBackendJson(`/api/commander/history${search}`, 12000);
}
