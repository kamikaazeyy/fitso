const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_URL_LENGTH = 2048;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_HEADER_SIZE = 16 * 1024;

const mockToday = {
  recovery: 82,
  hrv: 62,
  sleep: 7.4,
  restingHR: 54,
  calories: 2140,
  strain: 7.2,
};

const routes = new Map([
  ['/health', () => ({ status: 'ok' })],
  ['/api/today', () => mockToday],
]);

function send(req, res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(req.method === 'HEAD' ? undefined : payload);
}

function pathnameOf(url) {
  try {
    return new URL(url, 'http://localhost').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

const server = http.createServer({ maxHeaderSize: MAX_HEADER_SIZE }, (req, res) => {
  // Discard any request body: these endpoints never consume one, and an
  // undrained socket keeps buffering data from the client.
  req.resume();

  if (!req.url || req.url.length > MAX_URL_LENGTH) {
    send(req, res, 414, { error: 'URI too long' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    send(req, res, 405, { error: 'Method not allowed' });
    return;
  }

  const pathname = pathnameOf(req.url);
  if (pathname === null) {
    send(req, res, 400, { error: 'Bad request' });
    return;
  }

  const handler = routes.get(pathname);
  if (!handler) {
    send(req, res, 404, { error: 'Not found' });
    return;
  }

  send(req, res, 200, handler());
});

server.maxHeadersCount = 64;
server.headersTimeout = REQUEST_TIMEOUT_MS;
server.requestTimeout = REQUEST_TIMEOUT_MS;

server.listen(PORT, HOST, () => {
  console.log(`Fitso server running on http://${HOST}:${PORT}`);
});
