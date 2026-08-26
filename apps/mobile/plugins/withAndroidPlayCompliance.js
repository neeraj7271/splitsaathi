const { withAndroidManifest } = require("@expo/config-plugins");

const REMOVE_PERMISSIONS = [
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.RECORD_AUDIO",
  "android.permission.WRITE_CONTACTS"
];

/**
 * Strip permissions that Play review flags but Expo/native modules may merge in.
 */
function withAndroidPlayCompliance(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!Array.isArray(manifest["uses-permission"])) {
      return config;
    }

    manifest["uses-permission"] = manifest["uses-permission"].filter((item) => {
      const name = item.$?.["android:name"];
      return !REMOVE_PERMISSIONS.includes(name);
    });

    if (manifest.application?.[0]?.$) {
      manifest.application[0].$["android:usesCleartextTraffic"] = "false";
    }

    return config;
  });
}

module.exports = withAndroidPlayCompliance;
