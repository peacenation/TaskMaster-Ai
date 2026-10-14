#!/usr/bin/env bash
# Build, verify and collect the signed TaskMaster Android APK (macOS).
#
#   android/build-apk.sh            # release APK, signed with the release key
#   android/build-apk.sh --install  # also install on every connected device
#
# Needs: a JDK 17+ (Android Studio's bundled one is found automatically) and
# the Android SDK (ANDROID_HOME, or ~/Library/Android/sdk). Release signing
# reads ~/.android-release-keys/taskmaster/keystore.properties, or the file
# named by TASKMASTER_KEYSTORE_PROPERTIES. See android/README.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
OUT_DIR="$ROOT/dist/android"

if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "$(/usr/libexec/java_home -v 17+ 2>/dev/null || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate/bin/java" ]; then JAVA_HOME="$candidate"; break; fi
  done
fi
[ -n "${JAVA_HOME:-}" ] || { echo "No JDK 17+ found. Install Android Studio or a JDK, or set JAVA_HOME." >&2; exit 1; }
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found at $ANDROID_HOME. Set ANDROID_HOME." >&2; exit 1; }
[ -f "$ANDROID_DIR/local.properties" ] || echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

KEYSTORE_PROPERTIES="${TASKMASTER_KEYSTORE_PROPERTIES:-$HOME/.android-release-keys/taskmaster/keystore.properties}"
[ -f "$KEYSTORE_PROPERTIES" ] || {
  echo "Release key not found at $KEYSTORE_PROPERTIES." >&2
  echo "Restore it from your backup (never generate a new one for an app already installed)." >&2
  exit 1
}

BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"

echo "== Building release APK"
(cd "$ANDROID_DIR" && ./gradlew --no-daemon assembleRelease)
APK_BUILT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo "== Verifying"
"$BUILD_TOOLS/apksigner" verify --print-certs "$APK_BUILT" | grep -E "Signer: certificate (DN|SHA-256 digest)"
BADGING="$("$BUILD_TOOLS/aapt2" dump badging "$APK_BUILT")"
echo "$BADGING" | grep -E "^package:|^(min|target)SdkVersion|^launchable-activity"
VERSION="$(echo "$BADGING" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)"

mkdir -p "$OUT_DIR"
APK="$OUT_DIR/TaskMaster-$VERSION-release.apk"
cp "$APK_BUILT" "$APK"
(cd "$OUT_DIR" && shasum -a 256 "$(basename "$APK")" > "$(basename "$APK").sha256")

echo "== Output"
echo "APK:    $APK"
echo "Size:   $(du -h "$APK" | cut -f1) ($(stat -f %z "$APK") bytes)"
echo "SHA256: $(cut -d' ' -f1 "$APK.sha256")"

if [ "${1:-}" = "--install" ]; then
  ADB="$ANDROID_HOME/platform-tools/adb"
  for device in $("$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }'); do
    echo "== Installing on $device"
    "$ADB" -s "$device" install -r "$APK"
  done
fi
