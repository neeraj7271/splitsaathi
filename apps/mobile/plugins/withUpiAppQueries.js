const {
  AndroidConfig,
  withAndroidManifest
} = require("@expo/config-plugins");

const UPI_PACKAGES = [
  "com.google.android.apps.nbu.paisa.user",
  "com.phonepe.app",
  "net.one97.paytm",
  "in.org.npci.upiapp",
  "in.amazon.mShop.android.shopping",
  "com.whatsapp"
];

const UPI_SCHEMES = ["upi", "tez", "gpay", "phonepe", "ppe", "paytmmp", "bhim", "amazonpay", "whatsapp"];

/**
 * Ensures Android package visibility queries so Linking.canOpenURL can detect UPI apps.
 */
function withUpiAppQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0] ?? {};
    manifest.queries[0] = queries;

    const existingPackages = new Set(
      (queries.package ?? []).map((row) => row.$?.["android:name"]).filter(Boolean)
    );
    queries.package = [
      ...(queries.package ?? []),
      ...UPI_PACKAGES.filter((name) => !existingPackages.has(name)).map((name) => ({
        $: { "android:name": name }
      }))
    ];

    const existingIntents = queries.intent ?? [];
    const hasScheme = (scheme) =>
      existingIntents.some((intent) =>
        (intent.data ?? []).some((data) => data.$?.["android:scheme"] === scheme)
      );

    queries.intent = [
      ...existingIntents,
      ...UPI_SCHEMES.filter((scheme) => !hasScheme(scheme)).map((scheme) => ({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": scheme } }]
      }))
    ];

    return config;
  });
}

module.exports = withUpiAppQueries;
