const { createServer, handleRequest, mockToday } = require('../index');

function request(server, path) {
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}${path}`);
}

describe('handleRequest', () => {
  function invoke(url) {
    const res = {
      headers: {},
      statusCode: undefined,
      body: '',
      setHeader(name, value) {
        this.headers[name] = value;
      },
      writeHead(status) {
        this.statusCode = status;
      },
      end(chunk) {
        this.body = chunk;
      },
    };
    handleRequest({ url }, res);
    return res;
  }

  it('always sets a JSON content type', () => {
    expect(invoke('/health').headers['Content-Type']).toBe('application/json');
    expect(invoke('/nope').headers['Content-Type']).toBe('application/json');
  });

  it('returns ok for /health', () => {
    const res = invoke('/health');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('returns the mock metrics for /api/today', () => {
    const res = invoke('/api/today');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(mockToday);
  });

  it('returns 404 for unknown routes', () => {
    const res = invoke('/api/unknown');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('does not treat prefixes or query strings as known routes', () => {
    expect(invoke('/health?verbose=1').statusCode).toBe(404);
    expect(invoke('/api/today/extra').statusCode).toBe(404);
  });
});

describe('createServer', () => {
  let server;

  beforeAll(async () => {
    server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves /health over HTTP', async () => {
    const response = await request(server, '/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('serves /api/today over HTTP', async () => {
    const response = await request(server, '/api/today');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockToday);
    expect(Object.keys(body).sort()).toEqual([
      'calories',
      'hrv',
      'recovery',
      'restingHR',
      'sleep',
      'strain',
    ]);
  });

  it('responds 404 for unknown paths over HTTP', async () => {
    const response = await request(server, '/missing');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });
});
