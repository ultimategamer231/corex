// Digital Asset Links for the Android app of a School demo (audit round, Block 4). The
// app is the demo website in a Trusted Web Activity; Android opens it full screen, with
// no address bar, only when this file names the app and its signing key.

const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * The assetlinks.json statements from ANDROID_PACKAGE_NAME and
 * ANDROID_SHA256_FINGERPRINTS (comma-separated, from the signing key), or null while
 * they are not set or not valid.
 */
export function assetLinks(env: Record<string, string | undefined>) {
  const name = env.ANDROID_PACKAGE_NAME?.trim();
  const prints = (env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (!name || !PACKAGE.test(name) || prints.length === 0) return null;
  if (!prints.every((p) => FINGERPRINT.test(p))) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: name, sha256_cert_fingerprints: prints },
    },
  ];
}
