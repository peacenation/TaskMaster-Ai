# Mobile build configuration

Copy an example to the real name and fill in the publishable key:

    cp env/production.example.json env/production.json

Build with it:

    flutter build appbundle --release --dart-define-from-file=env/production.json   # Android (Play Store)
    flutter build ipa --release --dart-define-from-file=env/production.json         # iOS (App Store, needs Xcode)
    flutter run --dart-define-from-file=env/local.json                              # local, emulator

Only public values belong here: the API URL, the Supabase project URL and
the **publishable** key, which already ship in the website to every browser.
Never put `SUPABASE_SECRET_KEY` or a database URL in an app build; anything
compiled into an app can be extracted from it.

`env/*.json` is gitignored; the `*.example.json` files are committed.

## Google sign-in (optional)

The "Continue with Google" button appears when `GOOGLE_WEB_CLIENT_ID` is set:
the **Web** OAuth client ID that is also entered in Supabase → Authentication
→ Google. Google then issues ID tokens Supabase accepts. Client IDs are
public, not secrets. Also required in Google Cloud (same project):

- **Android:** an OAuth client of type *Android* with package name
  `app.vercel.taskmaster_ai_omega.twa` and the SHA-1 of each key that signs
  the app (release key, debug key for local runs, and the Play App Signing
  key once the app is on the Play Store).
- **iOS:** an OAuth client of type *iOS* (bundle ID from Xcode), its ID in
  `GOOGLE_IOS_CLIENT_ID`, and its *reversed* client ID added as a URL scheme
  in `ios/Runner/Info.plist` (google_sign_in README).
