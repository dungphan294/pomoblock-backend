import { db } from './firebase';
import { BuildInfo } from './asc';

// -----------------------------------------------------------------------
// config/app_versions
// Single document — read by iOS clients on every launch via /api/config
// Only updated when a production release goes READY_FOR_SALE
// -----------------------------------------------------------------------

export async function setCurrentVersion(version: string): Promise<void> {
  await db()
    .collection('config')
    .doc('app_versions')
    .set(
      {
        ios_current_version: version,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
}

export async function setMinVersion(version: string): Promise<void> {
  await db()
    .collection('config')
    .doc('app_versions')
    .set(
      {
        ios_min_version: version,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
}

export async function getVersionConfig(): Promise<{
  ios_current_version: string;
  ios_min_version: string;
}> {
  const snap = await db().collection('config').doc('app_versions').get();
  const data = snap.data();
  return {
    ios_current_version: data?.ios_current_version ?? '0.0.0',
    ios_min_version:     data?.ios_min_version     ?? '0.0.0',
  };
}

// -----------------------------------------------------------------------
// webhook_logs/<auto-id>
// One document per event — full raw payload preserved for audit trail
// Never update or delete — append only
// -----------------------------------------------------------------------

export async function logWebhookEvent(
  eventType: string,
  rawPayload: Record<string, any>,
  processed: boolean,
  note?: string
): Promise<void> {
  await db().collection('webhook_logs').add({
    event_type:  eventType,
    raw_payload: rawPayload,
    processed,
    note:        note ?? null,
    received_at: new Date().toISOString(),
  });
}

// -----------------------------------------------------------------------
// builds/<platform>_<version>_<buildNumber>
// One document per build — full build info from ASC API
// Useful for build history and debugging
// -----------------------------------------------------------------------

export async function saveBuildInfo(build: BuildInfo): Promise<void> {
  await db()
    .collection('builds')
    .doc(`${build.platform}_${build.version}_${build.buildNumber}`)
    .set({
      ...build,
      savedAt: new Date().toISOString(),
    });
}
