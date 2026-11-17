import { describe, expect, it } from "vitest";
import { assetLinks } from "./assetlinks";

const print = Array.from({ length: 32 }, (_, i) => (i * 7).toString(16).padStart(2, "0")).join(":");

describe("assetLinks", () => {
  it("names the app and its signing key", () => {
    expect(
      assetLinks({
        ANDROID_PACKAGE_NAME: "com.corexlr.demo_school",
        ANDROID_SHA256_FINGERPRINTS: ` ${print.toLowerCase()} `,
      }),
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.corexlr.demo_school",
          sha256_cert_fingerprints: [print.toUpperCase()],
        },
      },
    ]);
  });

  it("is off until both settings are set and valid", () => {
    expect(assetLinks({})).toBeNull();
    expect(assetLinks({ ANDROID_PACKAGE_NAME: "com.corexlr.demo" })).toBeNull();
    expect(
      assetLinks({ ANDROID_PACKAGE_NAME: "not a package", ANDROID_SHA256_FINGERPRINTS: print }),
    ).toBeNull();
    expect(
      assetLinks({
        ANDROID_PACKAGE_NAME: "com.corexlr.demo",
        ANDROID_SHA256_FINGERPRINTS: "AB:CD",
      }),
    ).toBeNull();
  });
});
