/** Entry for the Vercel functions in api/. One service set per instance, so caches survive between requests. */
import { createServices, handleApi, type Services } from './routes';

let services: Services | null = null;

export function vercelHandler(request: Request): Promise<Response> {
  services ??= createServices({ env: process.env, fetch: (...args) => fetch(...args) });
  return handleApi(request, services);
}
