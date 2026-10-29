import { vercelHandler } from '../server/vercel';

// Edge functions are bundled by Vercel, so the extensionless imports in server/ and src/lib/ resolve.
export const config = { runtime: 'edge' };

export default vercelHandler;
