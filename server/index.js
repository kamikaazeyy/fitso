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

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  } else if (req.url === '/api/today') {
    res.writeHead(200);
    res.end(JSON.stringify(mockToday));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Fitso server running on http://localhost:${PORT}`);
});
