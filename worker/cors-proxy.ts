// Minimal Cloudflare Worker CORS proxy. Deploy this separately, then set VITE_PROXY_ORIGIN to the worker URL.
// SECURITY: Optionally restrict allowed origins/targets below.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')
    if (!target) {
      return new Response('Missing url param', { status: 400 })
    }

    // Optional: lock down target host
    const allowedHosts = ['character-service.dndbeyond.com']
    try {
      const t = new URL(target)
      if (!allowedHosts.includes(t.hostname)) {
        return new Response('Target not allowed', { status: 403 })
      }
    } catch {
      return new Response('Bad target URL', { status: 400 })
    }

    const upstream = await fetch(target, { method: 'GET' })
    const headers = new Headers(upstream.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type')
    // Remove any restrictive CORS headers from upstream
    headers.delete('content-security-policy')
    headers.delete('content-security-policy-report-only')
    headers.delete('clear-site-data')

    const body = await upstream.arrayBuffer()
    return new Response(body, { status: upstream.status, headers })
  }
}