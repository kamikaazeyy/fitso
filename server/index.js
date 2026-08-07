const http = require('http');

const PORT = process.env.PORT || 3000;

const mockToday = {
  recovery: 82,
  hrv: 62,
  sleep: 7.4,
  restingHR: 54,
  calories: 2140,
  strain: 7.2,
};

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  res.on('error', (err) => {
    console.error(`Response error for ${req.method} ${req.url}:`, err);
  });

  req.on('error', (err) => {
    console.error(`Request error for ${req.method} ${req.url}:`, err);
    sendJson(res, 400, { error: 'Bad request' });
  });

  try {
    if (req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
    } else if (req.url === '/api/today') {
      sendJson(res, 200, mockToday);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    console.error(`Unhandled error while handling ${req.method} ${req.url}:`, err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.on('error', (err) => {
  console.error('Fitso server error:', err);
  process.exitCode = 1;
  server.close();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exitCode = 1;
  server.close(() => process.exit(1));
});

server.listen(PORT, () => {
  console.log(`Fitso server running on http://localhost:${PORT}`);
});
