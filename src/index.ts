import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import webhookRouter from './routes/webhook';
import configRouter  from './routes/config';
import adminRouter   from './routes/admin';
import openapiSpec   from './lib/openapi';

const app = express();

console.log('[env] APPLE_WEBHOOK_SECRET:', process.env.APPLE_WEBHOOK_SECRET ? 'loaded' : 'MISSING');

app.use((req, _res, next) => {
  console.log(`[request] ${req.method} ${req.path}`);
  next();
});

// NO global express.json() — webhook needs raw body
// other routes that need JSON parsing will add it locally

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use('/api', webhookRouter);
app.use('/api', configRouter);
app.use('/api', adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => console.log(`[dev] http://localhost:${PORT}`));
}
