import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { fetchBuildInfo } from '../lib/asc';
import { saveBuildInfo, setCurrentVersion, logWebhookEvent } from '../lib/db';

const router = Router();

router.post(
  '/webhook/apple',
  (req, res, next) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      (req as any).rawBody = raw;
      next();
    });
  },
  async (req: Request, res: Response) => {

    res.status(200).json({ received: true });

    try {
      const rawBody   = (req as any).rawBody as string;
      const signature = req.headers['x-apple-signature'] as string | undefined;
      const secret    = process.env.APPLE_WEBHOOK_SECRET;

      if (!signature || !secret) {
        console.warn('[webhook] Missing signature or secret');
        return;
      }

      const receivedHex = signature.replace('hmacsha256=', '');
      const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const valid =
        Buffer.from(receivedHex, 'hex').length === Buffer.from(expectedHex, 'hex').length &&
        crypto.timingSafeEqual(
          Buffer.from(receivedHex, 'hex'),
          Buffer.from(expectedHex, 'hex')
        );

      if (!valid) {
        console.warn('[webhook] Invalid signature — ignored');
        return;
      }

      const payload  = JSON.parse(rawBody);
      const dataType = payload.data?.type as string;

      console.log('[webhook] Event:', dataType);

      // ---------------------------------------------------------------
      // Event 1: build finished processing
      // ---------------------------------------------------------------
      if (dataType === 'buildUploadStateUpdated') {
        const newState      = payload.data?.attributes?.newState;
        const buildUploadId = payload.data?.relationships?.instance?.data?.id;

        if (newState === 'COMPLETE' && buildUploadId) {
          const buildInfo = await fetchBuildInfo(buildUploadId);

          if (buildInfo) {
            await saveBuildInfo(buildInfo);
            await logWebhookEvent(dataType, payload, true, `Build ${buildInfo.version} (${buildInfo.buildNumber}) saved`);
            console.log(`[webhook] Build saved: ${buildInfo.version} (${buildInfo.buildNumber})`);
          } else {
            await logWebhookEvent(dataType, payload, false, 'fetchBuildInfo returned null');
          }
        } else {
          await logWebhookEvent(dataType, payload, false, `Ignored state: ${newState}`);
        }
      }

      // ---------------------------------------------------------------
      // Event 2: App Store version state changed
      // ---------------------------------------------------------------
      else if (dataType === 'appStoreVersionAppVersionStateUpdated') {
        const state   = payload.data?.attributes?.newState;
        const version = payload.data?.attributes?.versionString;
        const platform = payload.data?.attributes?.platform;

        if (state === 'READY_FOR_SALE' && platform === 'IOS' && typeof version === 'string') {
          await setCurrentVersion(version);
          await logWebhookEvent(dataType, payload, true, `ios_current_version → ${version}`);
          console.log(`[webhook] ✅ ios_current_version → ${version}`);
        } else {
          await logWebhookEvent(dataType, payload, false, `State: ${state} — no action`);
          console.log(`[webhook] App version state: ${state} — no action`);
        }
      }

      // ---------------------------------------------------------------
      // Event 3: TestFlight build status changed — log only
      // ---------------------------------------------------------------
      else if (dataType === 'buildBetaDetailExternalBuildStateUpdated') {
        const state   = payload.data?.attributes?.newState;
        const version = payload.data?.attributes?.versionString;
        await logWebhookEvent(dataType, payload, true, `TestFlight: ${version} → ${state}`);
        console.log(`[webhook] TestFlight: ${version} → ${state}`);
      }

      // ---------------------------------------------------------------
      // Event 4: Crash feedback — log only
      // ---------------------------------------------------------------
      else if (dataType === 'crashFeedbackCreated') {
        await logWebhookEvent(dataType, payload, true, 'Crash feedback received');
        console.log('[webhook] Crash feedback received');
      }

      // ---------------------------------------------------------------
      // Event 5: Screenshot feedback — log only
      // ---------------------------------------------------------------
      else if (dataType === 'screenshotFeedbackCreated') {
        await logWebhookEvent(dataType, payload, true, 'Screenshot feedback received');
        console.log('[webhook] Screenshot feedback received');
      }

      // ---------------------------------------------------------------
      // Everything else — log raw for visibility
      // ---------------------------------------------------------------
      else {
        await logWebhookEvent(dataType ?? 'unknown', payload, false, 'Unhandled event type');
        console.log(`[webhook] Unhandled event: ${dataType}`);
      }

    } catch (err) {
      console.error('[webhook] Error:', err);
    }
  }
);

export default router;
