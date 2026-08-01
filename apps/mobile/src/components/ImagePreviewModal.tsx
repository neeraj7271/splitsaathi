import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { X } from "phosphor-react-native";

import { useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

export type ImagePreviewModalProps = {
  visible: boolean;
  uri?: string;
  title?: string;
  onClose: () => void;
};

export function ImagePreviewModal({ visible, uri, title = "Preview", onClose }: ImagePreviewModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
          <View style={styles.header}>
            <ThemedText variant="bodyMedium">{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close preview">
              <X size={22} color={theme.colors.ink} weight="bold" />
            </Pressable>
          </View>
          {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 14, 20, 0.72)"
  },
  card: {
    zIndex: 1,
    padding: 16,
    gap: 14,
    maxHeight: "88%"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  image: {
    width: "100%",
    height: 420,
    backgroundColor: "#0B0E14"
  }
});
