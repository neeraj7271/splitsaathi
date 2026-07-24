import * as ImagePicker from "expo-image-picker";

/** Ask for photo library access only when still undetermined; reuse grants silently. */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted || current.status === "granted") {
    return true;
  }

  // Permanently denied — opening Settings is the only path; don't loop prompts.
  if (current.canAskAgain === false) {
    return false;
  }

  // First ask (or Android still allowing a soft re-ask after soft deny).
  if (current.status === "undetermined" || current.canAskAgain) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return Boolean(requested.granted || requested.status === "granted");
  }

  return false;
}
