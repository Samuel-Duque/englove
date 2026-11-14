import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const DEV_SW_FALLBACK = `// Englove Service Worker (Development Fallback)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
`;

export async function GET(): Promise<Response> {
  let content = DEV_SW_FALLBACK;

  try {
    const swPath = path.resolve(process.cwd(), 'dist/client/sw.js');
    if (fs.existsSync(swPath)) {
      content = fs.readFileSync(swPath, 'utf8');
    }
  } catch {
    content = DEV_SW_FALLBACK;
  }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
