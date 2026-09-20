/**
 * Local API server. `npm run dev:api`, then:
 *   curl 'http://localhost:8787/api/pulse?address=555+W+Hastings+St+Vancouver'
 *   curl 'http://localhost:8787/api/pulse?lat=49.2827&lng=-123.1207&radius=600'
 */
import { createServer } from 'node:http';
import { handlePulseRequest } from '../src/server/handler.ts';

const PORT = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname !== '/api/pulse') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Try /api/pulse?address=...' }));
    return;
  }

  const request = new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : [],
    ),
  });

  const response = await handlePulseRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, () => {
  console.log(`MetroPulse API on http://localhost:${PORT}/api/pulse`);
  if (!process.env.TRANSLINK_API_KEY) {
    console.warn('TRANSLINK_API_KEY is unset — the transit card will report as unavailable.');
  }
});
