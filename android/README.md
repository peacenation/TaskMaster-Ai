# TaskMaster for Android

A Trusted Web Activity (TWA): a small native app that opens the deployed PWA
(`https://taskmaster-ai-omega.vercel.app`) full-screen in Chrome. Every
feature runs in the web app, so there is no separate Android code to keep in
sync. It needs a connection, like the website does; offline it shows the
PWA's offline page.

## Build

```bash
android/build-apk.sh            # → dist/android/TaskMaster-<version>-release.apk (+ .sha256)
android/build-apk.sh --install  # also installs on connected devices (adb)
```

Needs a JDK 17+ (Android Studio's bundled one is found automatically) and the
Android SDK at `ANDROID_HOME` or `~/Library/Android/sdk`.

## Release key

Signed with the key in `~/.android-release-keys/taskmaster/` (`release.jks`
and `keystore.properties`), kept outside the repo. **Back both files up
somewhere safe.** Android only installs an update signed with the same key, so
losing it means users must uninstall and reinstall. Use
`TASKMASTER_KEYSTORE_PROPERTIES=/path/to/keystore.properties` to point at it
elsewhere.

## Releasing an update

Bump `versionCode` (and `versionName`) in `app/build.gradle.kts`, then build.

## Full-screen (no address bar)

Chrome hides its address bar only when the site's
`/.well-known/assetlinks.json` (in `public/`) lists this package and the
signing key's SHA-256 fingerprint. Changing the domain or key means updating
both that file and `siteHost` in `app/build.gradle.kts`.
