import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCsv, UploadSimple } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { ExportJob, ImportJob } from "../types/domain";
import { AppNavigation } from "../types/navigation";

export function ImportExportScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [importJob, setImportJob] = useState<ImportJob>();
  const [exportJob, setExportJob] = useState<ExportJob>();
  const [exportType, setExportType] = useState<ExportJob["exportType"]>("full_group_csv");
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const groupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });

  useEffect(() => {
    if (!navigation.selectedGroupId && groups[0]?.id) {
      navigation.setSelectedGroupId(groups[0].id);
    }
  }, [groups, navigation]);

  const importCsv = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) {
        throw new Error("Choose a group before importing CSV data.");
      }
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/*", "application/vnd.ms-excel"], copyToCacheDirectory: true });
      if (result.canceled) {
        throw new Error("No CSV selected");
      }
      const asset = result.assets[0];
      const csv = await fetch(asset.uri).then((response) => response.text());
      const participantNameToId = Object.fromEntries(
        (groupQuery.data?.participants ?? []).map((participant) => [participant.displayName.trim().toLowerCase(), participant.id])
      );

      return apiClient.createSplitwiseImport({
        groupId: selectedGroupId,
        csv,
        participantNameToId,
        defaultCurrencyCode: groupQuery.data?.baseCurrencyCode ?? "INR"
      });
    },
    onSuccess: (job) => setImportJob(job)
  });

  const commitImport = useMutation({
    mutationFn: () => apiClient.commitImport(importJob?.id as string),
    onSuccess: (job) => {
      setImportJob(job);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    }
  });

  const importBankCsv = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId || !groupQuery.data?.participants.length) {
        throw new Error("Choose a group with participants before importing bank CSV data.");
      }
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/*", "application/vnd.ms-excel"], copyToCacheDirectory: true });
      if (result.canceled) {
        throw new Error("No bank CSV selected");
      }
      const asset = result.assets[0];
      const csv = await fetch(asset.uri).then((response) => response.text());
      return apiClient.createBankCsvImport({
        groupId: selectedGroupId,
        csv,
        accountParticipantId: groupQuery.data.participants[0].id,
        counterpartyParticipantId: groupQuery.data.participants[1]?.id,
        defaultCurrencyCode: groupQuery.data.baseCurrencyCode
      });
    },
    onSuccess: setImportJob
  });

  const createExport = useMutation({
    mutationFn: () =>
      apiClient.createExport({
        groupId: selectedGroupId,
        exportType,
        parameters: { includeVoided: true }
      }),
    onSuccess: setExportJob
  });

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Data portability
          </ThemedText>
          <ThemedText variant="title">Splitwise CSV import/export</ThemedText>
        </View>
        <FileCsv size={28} color={theme.colors.confirmed} weight="duotone" />
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Import from Splitwise" />
        <DataSurface>
          <View style={styles.formBlock}>
            <View style={styles.heroRow}>
              <UploadSimple size={24} color={theme.colors.confirmed} weight="duotone" />
              <View style={styles.titleBlock}>
                <ThemedText variant="bodyMedium">Upload CSV</ThemedText>
                <ThemedText variant="bodySm" tone="muted">
                  The backend parses, maps participants, flags duplicates, and commits after review.
                </ThemedText>
              </View>
            </View>
            <Button label="Select Splitwise CSV" onPress={() => importCsv.mutate()} loading={importCsv.isPending} />
            {importJob ? (
              <View style={styles.jobBox}>
                <ThemedText variant="bodyMedium">Import job {importJob.id}</ThemedText>
                <StatusPill state={importJob.state === "completed" || importJob.state === "committed" ? "confirmed" : importJob.state === "failed" ? "rejected" : "pending"} />
                <Button label="Commit reviewed import" variant="secondary" onPress={() => commitImport.mutate()} loading={commitImport.isPending} disabled={importJob.state === "completed" || importJob.state === "committed"} />
              </View>
            ) : null}
          </View>
        </DataSurface>
        {importCsv.error ? <InlineNotice title="Import failed" body={importCsv.error.message} tone="owe" /> : null}
        <DataSurface>
          <View style={styles.formBlock}>
            <ThemedText variant="bodyMedium">Bank CSV import</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              Debit rows are parsed into a review job before any expense is posted.
            </ThemedText>
            <Button label="Select bank CSV" variant="secondary" onPress={() => importBankCsv.mutate()} loading={importBankCsv.isPending} />
          </View>
        </DataSurface>
        {importBankCsv.error ? <InlineNotice title="Bank import failed" body={importBankCsv.error.message} tone="owe" /> : null}
        {commitImport.error ? <InlineNotice title="Commit failed" body={commitImport.error.message} tone="owe" /> : null}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Export group CSV" />
        {selectedGroupId ? (
          <DataSurface>
            <View style={styles.formBlock}>
              <ThemedText variant="bodySm" tone="muted">
                The server owns export rendering and audit-safe file generation.
              </ThemedText>
              <SegmentedControl
                value={exportType}
                options={[
                  { label: "CSV", value: "full_group_csv" },
                  { label: "PDF", value: "group_pdf" },
                  { label: "Tally", value: "tally_csv" },
                  { label: "JSON", value: "data_portability_json" }
                ]}
                onChange={setExportType}
              />
              <Button label="Create export" onPress={() => createExport.mutate()} loading={createExport.isPending} />
              {exportJob ? (
                <View style={styles.jobBox}>
                  <ThemedText variant="bodyMedium">Export job {exportJob.id}</ThemedText>
                  <StatusPill state={exportJob.state === "ready" || exportJob.state === "completed" ? "confirmed" : exportJob.state === "failed" ? "rejected" : "pending"} />
                  {exportJob.fileUrl ? (
                    <ThemedText variant="bodySm" tone="confirmed">
                      {exportJob.fileUrl}
                    </ThemedText>
                  ) : exportJob.data ? (
                    <ThemedText variant="bodySm" tone="confirmed">
                      Export ready in job payload ({exportJob.contentType ?? exportJob.exportType}).
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </View>
          </DataSurface>
        ) : (
          <EmptyState title="No group selected" body="Choose a group before creating an export job." />
        )}
        {createExport.error ? <InlineNotice title="Export failed" body={createExport.error.message} tone="owe" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  section: {
    gap: 12
  },
  formBlock: {
    gap: 14,
    padding: 14
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  jobBox: {
    gap: 10
  }
});
