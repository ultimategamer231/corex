// The Android app of the demo (docs/apk.md): the app link file Android reads before it
// opens the demo full screen, served without signing in.
import { expect, test } from "@playwright/test";

test("the Android app link file names the app and its signing key", async ({ request }) => {
  const response = await request.get("/.well-known/assetlinks.json");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const [statement] = (await response.json()) as {
    relation: string[];
    target: { package_name: string; sha256_cert_fingerprints: string[] };
  }[];
  expect(statement?.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
  expect(statement?.target.package_name).toBe("com.corexlr.demo_college");
  expect(statement?.target.sha256_cert_fingerprints).toHaveLength(1);
});

test("the web app manifest is ready for packaging", async ({ request }) => {
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as {
    id: string;
    display: string;
    icons: { sizes: string }[];
  };
  expect(manifest.id).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
});
