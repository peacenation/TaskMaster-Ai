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
