# The School demo as an Android app (APK)

The APK is a small Android app that opens the School demo full screen, with the Corex
icon and no browser address bar (a Trusted Web Activity). It shows the live demo, so
every improvement to the demo reaches the app without a new APK. You make it once with
the free website PWABuilder, then share the file by WhatsApp, Google Drive or email.

The steps use the High School demo, `https://demo-school.corexlr.com`. For the College
demo, use `https://demo-college.corexlr.com` and `com.corexlr.demo_college` instead.

## 1. Make the APK (about 10 minutes)

1. Open <https://www.pwabuilder.com> on a computer.
2. Type `https://demo-school.corexlr.com` and click **Start**. Wait for the report.
3. Click **Package for stores**, then **Android**, then **Generate package**.
4. Fill in the form:
   - **Package ID**: `com.corexlr.demo_school`
   - **App name**: `Corex School Demo`
   - **Short name**: `School Demo`
   - Leave the address, colours and icons as they are.
   - **Signing key**: choose **Create new**. Enter `Corex Digital Solutions` as the name
     and organisation and `LR` as the country. Choose a strong password and write it
     down in your password manager.
5. Click **Download package**. You get a zip file.

## 2. Keep the signing key safe

Open the zip. It contains:

| File                                          | What it is                             | What to do                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-release-signed.apk` (name may vary)      | The app                                | This is the file you share                                                                                                                                      |
| `app-release-bundle.aab`                      | For the Google Play Store              | Not needed now                                                                                                                                                  |
| `signing.keystore` and `signing-key-info.txt` | The signing key and its passwords      | **Secret.** Keep both in a private place (password manager, or a private folder only you can open). Never send them to anyone, and never paste them into a chat |
| `assetlinks.json`                             | Proof that the app belongs to the demo | Used in step 3                                                                                                                                                  |

Android only accepts an update to the app if it is signed with the same key. If the key
is lost, people have to remove the app and install a new one.

## 3. Connect the app to the demo

This makes the app open full screen. Without it, the app still works but shows a thin
address bar at the top.

1. Open `assetlinks.json` from the zip with Notepad. Find:
   - `"package_name"`: `com.corexlr.demo_school`
   - `"sha256_cert_fingerprints"`: a long value like `AB:12:CD:...` (32 pairs). This
     is not secret.
2. In Vercel, open the **corex-demo-school** project, then **Settings**, then
   **Environment Variables**. Add:
   - `ANDROID_PACKAGE_NAME` = `com.corexlr.demo_school`
   - `ANDROID_SHA256_FINGERPRINTS` = the long value from step 1
3. Open **Deployments**, click the three dots on the latest one and choose **Redeploy**.
4. Check: open `https://demo-school.corexlr.com/.well-known/assetlinks.json`. It shows the
   package name and the long value. Before step 2 it says "Not found."

## 4. Share it

1. Send `app-release-signed.apk` by WhatsApp, or upload it to Google Drive and share the
   link.
2. On the phone, tap the file. Android asks to allow installing apps from WhatsApp,
   Drive or the browser: tap **Settings**, allow it, go back and tap **Install**.
3. Google Play Protect may warn that the app is not from the Play Store. Tap **More
   details**, then **Install anyway**. This warning is normal for apps shared as a file.
4. Open **School Demo** from the home screen. Pick a role to sign in, as on the website.

## 5. Later

- **New demo features**: nothing to do; the app shows the live demo.
- **New icon or name**: make the APK again in PWABuilder, but in step 1.4 choose **Use
  mine** for the signing key and give it `signing.keystore` and its passwords. Then share
  the new file; installing it over the old app keeps working.
- **Google Play**: the `.aab` file from the same zip is what the Play Console asks for.
  Publishing there needs a Google Play developer account (one-time US$25).
