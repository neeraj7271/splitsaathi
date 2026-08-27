/**
 * Single source of truth for Google Sign-In Web OAuth client ID.
 *
 * Must match production API env: GOOGLE_OAUTH_CLIENT_ID
 * Must be type "Web application" in Google Cloud Console (NOT Android).
 * Android OAuth clients (package + SHA-1) live in the SAME Google Cloud project.
 *
 * After changing this value: rebuild APK/AAB and redeploy API.
 */
module.exports = {
  webClientId:
    process.env.GOOGLE_OAUTH_WEB_CLIENT_ID ||
    '1062818938455-p72of8nn0f55afi7svsmfoj8um28qspc.apps.googleusercontent.com'
};
