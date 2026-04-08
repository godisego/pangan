import { NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '@/utils/constants';

export async function proxyBackendJson(path: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${resolveBackendBaseUrl()}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json(
      { status: 'error', message, path },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
