export async function dispatch(request, env, handleApi, readAsset) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/')) return handleApi(request, env);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const asset = await readAsset(path === '/' ? '/index.html' : path);
  if (!asset) return new Response('Halaman tidak ditemukan.', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : asset.body, {
    headers: {
      'Content-Type': asset.type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}
