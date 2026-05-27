import { Router, Request, Response } from 'express';
import { getVersionConfig } from '../lib/db';
import semver from 'semver';

const router = Router();

router.get('/config', async (req: Request, res: Response) => {
  const clientVersion = req.query.version as string | undefined;

  if (!clientVersion) {
    return res.status(400).json({ error: 'Missing required query param: version' });
  }

  try {
    const { ios_current_version, ios_min_version } = await getVersionConfig();

    let update_required: 'force' | 'flexible' | 'none' = 'none';

    const coercedClient  = semver.coerce(clientVersion);
    const coercedMin     = semver.coerce(ios_min_version);
    const coercedCurrent = semver.coerce(ios_current_version);

    if (coercedClient && coercedMin && semver.lt(coercedClient, coercedMin)) {
      update_required = 'force';
    } else if (coercedClient && coercedCurrent && semver.lt(coercedClient, coercedCurrent)) {
      update_required = 'flexible';
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return res.status(200).json({
      update_required,
      ios_current_version,
      ios_min_version,
    });

  } catch (err) {
    console.error('[config] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
