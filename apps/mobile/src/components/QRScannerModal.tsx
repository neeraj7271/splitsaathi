import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View, Alert } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Camera, QrCode, X } from "phosphor-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { InlineNotice } from "./InlineNotice";
import { InputField } from "./InputField";
import { ThemedText } from "./ThemedText";

export interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined?: (groupId: string) => void;
}

export function QRScannerModal({ visible, onClose, onJoined }: QRScannerModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualInput, setManualInput] = useState("");
  const [errorText, setErrorText] = useState<string>();
  const [scanned, setScanned] = useState(false);
  const isWeb = Platform.OS === "web";

  const claimInviteMutation = useMutation({
    mutationFn: (tokenOrUrl: string) => apiClient.claimInvite(tokenOrUrl),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["group", group.id] });
      void queryClient.invalidateQueries({ queryKey: ["settlementSuggestions", group.id] });
      void queryClient.invalidateQueries({ queryKey: ["balances", group.id] });
      Alert.alert("Success", `You have successfully joined ${group.name}!`);
      onClose();
      if (onJoined) {
        onJoined(group.id);
      }
    },
    onError: (err) => {
      setErrorText(err instanceof Error ? err.message : "Could not join group from this QR code.");
      setScanned(false);
    }
  });

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned || claimInviteMutation.isPending) return;
    setScanned(true);
    setErrorText(undefined);
    claimInviteMutation.mutate(result.data);
  };

  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      setErrorText("Please enter a valid invite code or URL.");
      return;
    }
    setErrorText(undefined);
    claimInviteMutation.mutate(trimmed);
  };

  const handleModalClose = () => {
    setScanned(false);
    setErrorText(undefined);
    setManualInput("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleModalClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <QrCode size={24} color={theme.colors.info} weight="duotone" />
            <ThemedText variant="title">Scan QR to Join</ThemedText>
          </View>
          <Pressable onPress={handleModalClose} style={[styles.closeBtn, { backgroundColor: theme.colors.surface }]}>
            <X size={20} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {errorText ? <InlineNotice title="Could not join" body={errorText} tone="owe" /> : null}

          {!isWeb ? (
            !permission?.granted ? (
              <View style={[styles.permissionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
                <Camera size={44} color={theme.colors.info} weight="duotone" />
                <ThemedText variant="bodyMedium" align="center">
                  Camera permission is required to scan group QR codes.
                </ThemedText>
                <Button label="Grant Camera Access" onPress={requestPermission} variant="primary" />
              </View>
            ) : (
              <View style={[styles.cameraContainer, { borderColor: theme.colors.info }]}>
                <CameraView
                  style={styles.camera}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                {claimInviteMutation.isPending ? (
                  <View style={styles.loadingOverlay}>
                    <ThemedText variant="body" style={{ color: "#FFFFFF" }}>
                      Joining group...
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            )
          ) : null}

          <View style={styles.manualSection}>
            <ThemedText variant="caption" tone="muted">
              Or enter invite link / code manually:
            </ThemedText>
            <InputField
              label="Invite Link or Code"
              value={manualInput}
              onChangeText={(text) => {
                setManualInput(text);
                setErrorText(undefined);
              }}
              placeholder="https://.../join/... or token"
              autoCapitalize="none"
            />
            <Button
              label={claimInviteMutation.isPending ? "Joining..." : "Join with Code"}
              onPress={handleManualSubmit}
              loading={claimInviteMutation.isPending}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 54 : 24,
    paddingHorizontal: 20
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    flex: 1,
    gap: 20
  },
  permissionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 16
  },
  cameraContainer: {
    width: "100%",
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2
  },
  camera: {
    flex: 1
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  manualSection: {
    gap: 10,
    marginTop: 10
  }
});
