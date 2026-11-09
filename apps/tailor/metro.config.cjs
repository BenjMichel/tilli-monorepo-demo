const { getDefaultConfig } = require('expo/metro-config');

// The API has no CORS: in development, the app reaches it through /api on Metro's own origin,
// on the web as on a phone, like the Vite proxy of the site and the admin.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';

const config = getDefaultConfig(__dirname);

config.server.enhanceMiddleware = (metroMiddleware) => async (request, response, next) => {
  if (!request.url?.startsWith('/api/')) return metroMiddleware(request, response, next);
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const upstream = await fetch(`${API_URL}${request.url.slice('/api'.length)}`, {
      method: request.method,
      headers: request.headers['content-type'] ? { 'content-type': request.headers['content-type'] } : {},
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    });
    response.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) response.setHeader('content-type', contentType);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: 'API_UNREACHABLE', message: `No API at ${API_URL}` }));
  }
};

module.exports = config;
