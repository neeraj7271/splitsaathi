import { Share } from "react-native";

export async function copyText(value: string): Promise<boolean> {
  try {
    const clipboard = await import("expo-clipboard");
    await clipboard.setStringAsync(value);
    return true;
  } catch {
    try {
      await Share.share({ message: value });
      return true;
    } catch {
      return false;
    }
  }
}
