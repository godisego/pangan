import { proxyBackendJson } from '@/app/api/_lib/backend';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyBackendJson(`/api/stock/chain/${encodeURIComponent(name)}`, 6000);
}
