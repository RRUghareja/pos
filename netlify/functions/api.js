import serverless from 'serverless-http';
import app from '../../backend/src/app.js';

// No basePath: Netlify rewrites `/api/*` to this function while preserving the
// original path on the event, so Express receives `/api/auth/login` directly.
export const handler = serverless(app);
