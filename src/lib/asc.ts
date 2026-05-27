import jwt from 'jsonwebtoken';

export interface BuildInfo {
  id:           string;
  version:      string;
  buildNumber:  string;
  platform:     string;
  state:        string;
  createdDate:  string;
  uploadedDate: string;
  errors:       any[];
  warnings:     any[];
  infos:        any[];
}

function generateAscToken(): string {
  const keyId      = process.env.ASC_KEY_ID!;
  const issuerId   = process.env.ASC_ISSUER_ID!;
  const privateKey = process.env.ASC_PRIVATE_KEY!.replace(/\\n/g, '\n');

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '20m',
    audience:  'appstoreconnect-v1',
    issuer:    issuerId,
    keyid:     keyId,
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
  });
}

export async function fetchBuildInfo(buildUploadId: string): Promise<BuildInfo | null> {
  try {
    const token = generateAscToken();

    const res = await fetch(
      `https://api.appstoreconnect.apple.com/v1/buildUploads/${buildUploadId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      console.error('[asc] fetch failed:', res.status, await res.text());
      return null;
    }

    const data       = await res.json() as Record<string, any>;
    const attributes = data.data?.attributes;

    if (!attributes) {
      console.warn('[asc] No attributes in response');
      return null;
    }

    return {
      id:           buildUploadId,
      version:      attributes.cfBundleShortVersionString,
      buildNumber:  attributes.cfBundleVersion,
      platform:     attributes.platform,
      state:        attributes.state?.state,
      createdDate:  attributes.createdDate,
      uploadedDate: attributes.uploadedDate,
      errors:       attributes.state?.errors   ?? [],
      warnings:     attributes.state?.warnings ?? [],
      infos:        attributes.state?.infos    ?? [],
    };

  } catch (err) {
    console.error('[asc] Error:', err);
    return null;
  }
}
