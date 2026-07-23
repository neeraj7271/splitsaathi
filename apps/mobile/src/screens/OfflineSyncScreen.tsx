import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { CloudArrowUp } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ScreenBackButton } from "../components/ScreenBackButton";
import { SectionHeader } from "../components/SectionHeader";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { describeOutboxCommand, flushOutbox, getOutboxStatus, OutboxCommandRecord } from "../offline/outbox";

export function OfflineSyncScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const [rows, setRows] = useState<OutboxCommandRecord[]>([]);
  const [status, setStatus] = useState({ queued: 0, syncing: 0, failed: 0, total: 0 });
  const [syncCursor, setSyncCursor] = useState<string>();

  const refreshStatus = async () => {
    const next = await getOutboxStatus();
    setRows(next.rows);
    setStatus({
      queued: next.queued,
      syncing: next.syncing,
      failed: next.failed,
      total: next.total
    });
  };

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, []);

  const flush = useMutation({
    mutationFn: () => flushOutbox(),
    onSettled: () => refreshStatus()
  });

  const sync = useMutation({
    mutationFn: () => apiClient.getSync(syncCursor),
    onSuccess: (result) => setSyncCursor(String(result.nextCursor))
  });

  return (
    <Screen refreshing={false} onRefresh={() => void refreshStatus()}>
      <ScreenBackButton navigation={navigation} label="Back" />
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Offline queue
          </ThemedText>
          <ThemedText variant="title">Sync status</ThemedText>
        </View>
        <CloudArrowUp size={28} color={theme.colors.confirmed} weight="duotone" />
      </View>

      <DataSurface>
        <View style={styles.metrics}>
          <Metric label="Queued" value={status.queued} />
          <Metric label="Syncing" value={status.syncing} />
          <Metric label="Failed" value={status.failed} />
          <Metric label="Total" value={status.total} />
        </View>
      </DataSurface>

      <View style={styles.actions}>
        <Button label="Sync now" onPress={() => flush.mutate()} loading={flush.isPending} disabled={!status.total} />
        <Button label="Refresh queue" variant="secondary" onPress={() => void refreshStatus()} />
      </View>

      {syncCursor ? <InlineNotice title="Sync cursor" body={syncCursor} tone="confirmed" /> : null}
      {flush.error ? <InlineNotice title="Queue flush failed" body={flush.error.message} tone="owe" /> : null}
      {sync.error ? <InlineNotice title="Sync fetch failed" body={sync.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader title="Waiting to sync" />
        {rows.length ? (
          <DataSurface>
            {rows.map((row) => {
              const detail = describeOutboxCommand(row);
              return (
                <View key={row.id} style={[styles.row, { borderBottomColor: theme.colors.hairline }]}>
                  <View style={styles.titleBlock}>
                    <View style={styles.rowTop}>
                      <ThemedText variant="bodyMedium" style={styles.flex}>
                        {detail.title}
                      </ThemedText>
                      {detail.amountLabel ? <ThemedText variant="amount">{detail.amountLabel}</ThemedText> : null}
                    </View>
                    <ThemedText variant="bodySm" tone="muted">
                      {detail.summary}
                    </ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      Queued {detail.meta}
                    </ThemedText>
                    {row.lastError ? (
                      <ThemedText variant="bodySm" tone="owe">
                        {row.lastError}
                      </ThemedText>
                    ) : null}
                  </View>
                  <StatusPill
                    state={
                      row.status === "failed"
                        ? "rejected"
                        : row.status === "syncing"
                          ? "awaiting_receiver_confirmation"
                          : "pending"
                    }
                  />
                </View>
              );
            })}
          </DataSurface>
        ) : (
          <EmptyState
            title="Queue is clear"
            body="When you're offline, new expenses are saved here and sync automatically once the network is back."
          />
        )}
      </View>

      <Button
        label="Fetch server sync cursor"
        variant="ghost"
        onPress={() => sync.mutate()}
        loading={sync.isPending}
      />
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <ThemedText variant="amount" align="center">
        {value}
      </ThemedText>
      <ThemedText variant="caption" tone="muted" align="center">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  metrics: {
    flexDirection: "row",
    padding: 14
  },
  metric: {
    flex: 1,
    gap: 4
  },
  actions: {
    gap: 10
  },
  section: {
    gap: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  flex: {
    flex: 1
  },
  titleBlock: {
    flex: 1,
    gap: 4
  }
});
