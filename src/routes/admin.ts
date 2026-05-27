import { Router, Request, Response } from 'express';
import express from 'express';
import { setMinVersion, getVersionConfig } from '../lib/db';
import semver from 'semver';

const router = Router();

router.use(express.json());

function requireAdminSecret(req: Request, res: Response, next: any): void {
  const auth   = req.headers.authorization;
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'ADMIN_SECRET not configured' });
    return;
  }

  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

router.post('/admin/set-min-version', requireAdminSecret, async (req: Request, res: Response) => {
  const { version } = req.body as { version?: string };

  if (!version || !semver.coerce(version)) {
    return res.status(400).json({ error: 'Invalid or missing version' });
  }

  try {
    await setMinVersion(version);
    console.log(`[admin] ios_min_version → ${version}`);
    return res.status(200).json({ ios_min_version: version });
  } catch (err) {
    console.error('[admin] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/version-status', requireAdminSecret, async (_req: Request, res: Response) => {
  try {
    const config = await getVersionConfig();
    return res.status(200).json(config);
  } catch (err) {
    console.error('[admin] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
