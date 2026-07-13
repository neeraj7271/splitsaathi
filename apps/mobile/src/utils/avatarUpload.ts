import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";

async function compressImage(uri: string) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
}

export async function pickAndCompressAvatar() {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
    multiple: false
  });

  if (picked.canceled || !picked.assets[0]) {
    return null;
  }

  const asset = picked.assets[0];
  const manipulated = await compressImage(asset.uri);

  return {
    uri: manipulated.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    name: asset.name ?? "avatar.jpg"
  };
}

// Camera capture requires a dev build or expo-camera screen — gallery pick covers Expo Go.
export async function captureAndCompressAvatar() {
  return pickAndCompressAvatar();
}
