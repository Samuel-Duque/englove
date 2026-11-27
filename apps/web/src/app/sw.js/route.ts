import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// SEC-03 (Decisión 135, SPEC-09 RF-7): el fallback nunca activa skipWaiting() ni clients.claim()
// automáticos; solo cede el control tras la confirmación manual SKIP_WAITING de PwaUpdateBanner.
const DEV_SW_FALLBACK = `// Upward English Service Worker (Development Fallback)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
