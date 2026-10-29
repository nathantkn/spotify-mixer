/** Serves /api/* from the Vite dev server with the same handlers Vercel runs. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerEnv } from './core';
import { createServices, handleApi, type Services } from './routes';

let services: Services | null = null;

export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse, env: ServerEnv): Promise<void> {
  services ??= createServices({ env, fetch: (...args) => fetch(...args) });
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(new URL(req.url ?? '/', 'http://localhost'), {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([k, v]) =>
      v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x): [string, string] => [k, x]),
    ),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
  const response = await handleApi(request, services);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
