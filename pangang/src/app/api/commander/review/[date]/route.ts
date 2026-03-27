import { proxyBackendJson } from '@/app/api/_lib/backend';

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> }
) {
  const { date } = await context.params;
  return proxyBackendJson(`/api/commander/review/${date}`, 5000);
}
