import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarBlank } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { ScreenBackButton } from "../components/ScreenBackButton";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { formatMoney, parseAmountToMinor } from "../utils/money";

export function RecurringScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [reminderDays, setReminderDays] = useState("2");

  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() });
  const groups = groupsQuery.data ?? [];
  const selectedGroupId = navigation.selectedGroupId ?? groups[0]?.id;
  const schedulesQuery = useQuery({
    queryKey: ["recurringSchedules", selectedGroupId],
    queryFn: () => apiClient.listRecurringSchedules(selectedGroupId as string),
    enabled: Boolean(selectedGroupId)
  });
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

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) {
        throw new Error("Select a group first");
      }
      const participants = groupQuery.data?.participants ?? [];
      const payer = participants[0];
      if (!payer) {
        throw new Error("Add at least one participant before creating a recurring bill.");
      }
      const schedule = await apiClient.createRecurringSchedule({
        groupId: selectedGroupId,
        title,
        amountMinor: parseAmountToMinor(amount),
        currencyCode: "INR",
        frequency,
        reminderDaysBefore: Number.parseInt(reminderDays || "2", 10),
        payerParticipantId: payer.id,
        beneficiaryParticipantIds: participants.map((participant) => participant.id)
      });
      await apiClient.createReminderSchedule({
        groupId: selectedGroupId,
        type: "recurring_expense",
        schedule: {
          frequency,
          reminderDaysBefore: Number.parseInt(reminderDays || "2", 10)
        }
      });
      return schedule;
    },
    onSuccess: () => {
      setTitle("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["recurringSchedules", selectedGroupId] });
    }
  });

  return (
    <Screen>
      <ScreenBackButton navigation={navigation} label="Back" />
      <View style={styles.header}>
        <View>
          <ThemedText variant="caption" tone="muted">
            Reminders
          </ThemedText>
          <ThemedText variant="title">Recurring bills</ThemedText>
        </View>
        <CalendarBlank size={28} color={theme.colors.confirmed} weight="duotone" />
      </View>

      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {schedulesQuery.error ? <InlineNotice title="Schedules could not load" body={schedulesQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <SectionHeader title="Create schedule" />
        <DataSurface>
          <View style={styles.formBlock}>
            <InputField label="Bill title" value={title} onChangeText={setTitle} placeholder="Rent, electricity, internet" />
            <InputField label="Expected amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" amount />
            <SegmentedControl value={frequency} options={[{ label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]} onChange={setFrequency} />
            <InputField label="Reminder days before" value={reminderDays} onChangeText={setReminderDays} keyboardType="number-pad" />
            <InlineNotice title="Neutral tone" body="Default reminders say a bill is ready to review, not that someone is late." tone="info" />
            <Button label="Create recurring bill" onPress={() => createSchedule.mutate()} loading={createSchedule.isPending} disabled={!selectedGroupId || !title.trim() || parseAmountToMinor(amount) <= 0 || !groupQuery.data?.participants.length} />
          </View>
        </DataSurface>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Upcoming schedules" />
        {schedulesQuery.data?.length ? (
          <DataSurface>
            {schedulesQuery.data.map((schedule) => (
              <View key={schedule.id} style={[styles.row, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.titleBlock}>
                  <ThemedText variant="bodyMedium">{schedule.title}</ThemedText>
                  <ThemedText variant="bodySm" tone="muted">
                    {schedule.frequency} - next {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleDateString() : "pending"}
                  </ThemedText>
                </View>
                <View style={styles.trailing}>
                  <ThemedText variant="amount">{formatMoney(schedule.amountMinor, schedule.currencyCode)}</ThemedText>
                  <StatusPill state={schedule.state === "active" ? "confirmed" : "pending"} />
                </View>
              </View>
            ))}
          </DataSurface>
        ) : (
          <EmptyState title="No recurring bills" body="Weekly and monthly bills will appear here after the backend accepts a schedule." />
        )}
      </View>

      {createSchedule.error ? <InlineNotice title="Schedule failed" body={createSchedule.error.message} tone="owe" /> : null}
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
    gap: 12,
    padding: 14
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6
  }
});
