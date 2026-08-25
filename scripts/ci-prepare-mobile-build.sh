#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

write_google_services() {
  local target="$1"
  if [[ -n "${MOBILE_GOOGLE_SERVICES_JSON:-}" ]]; then
    printf '%s' "$MOBILE_GOOGLE_SERVICES_JSON" > "$target"
    echo "✓ Wrote $(realpath --relative-to="$ROOT_DIR" "$target") from MOBILE_GOOGLE_SERVICES_JSON"
    return 0
  fi

  if [[ -n "${MOBILE_GOOGLE_SERVICES_JSON_B64:-}" ]]; then
    printf '%s' "$MOBILE_GOOGLE_SERVICES_JSON_B64" | base64 -d > "$target"
    echo "✓ Wrote $(realpath --relative-to="$ROOT_DIR" "$target") from MOBILE_GOOGLE_SERVICES_JSON_B64"
    return 0
  fi

  return 1
}

if write_google_services "apps/mobile/google-services.json"; then
  mkdir -p apps/mobile/android/app
  cp apps/mobile/google-services.json apps/mobile/android/app/google-services.json
  echo "✓ Synced google-services.json to android/app/"
elif [[ -f "apps/mobile/google-services.json" ]]; then
  echo "ℹ️ Using existing apps/mobile/google-services.json"
  cp apps/mobile/google-services.json apps/mobile/android/app/google-services.json
elif [[ -f "apps/mobile/android/app/google-services.json" ]]; then
  echo "ℹ️ Using existing apps/mobile/android/app/google-services.json"
else
  echo "❌ google-services.json is required for release builds."
  echo "   Set GitHub secret MOBILE_GOOGLE_SERVICES_JSON (or MOBILE_GOOGLE_SERVICES_JSON_B64)."
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "❌ ANDROID_HOME or ANDROID_SDK_ROOT must be set before building."
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "❌ JAVA_HOME must be set before building."
  exit 1
fi

echo "✓ CI mobile build prerequisites ready"
echo "  JAVA_HOME=${JAVA_HOME}"
echo "  ANDROID_HOME=${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
