/** A fetch double that routes by "METHOD host/path" and records every call. */
export type Route = (url: URL, init: RequestInit) => unknown | Response;

export function fakeFetch(routes: Record<string, Route>) {
  const calls: { key: string; url: URL; init: RequestInit }[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const key = `${init.method ?? 'GET'} ${url.host}${url.pathname}`;
    calls.push({ key, url, init });
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ error: `no fake for ${key}` }), { status: 599 });
    const out = await route(url, init);
    return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
