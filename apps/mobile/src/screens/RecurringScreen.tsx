import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Receipt, CurrencyInr, Bell, CaretRight, Buildings, Lightning, WifiHigh } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { EmptyState } from "../components/EmptyState";
import { GroupSelector } from "../components/GroupSelector";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusPill } from "../components/StatusPill";
import { ThemedText } from "../components/ThemedText";
import { colorWithAlpha, useTheme } from "../theme";
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.back() || navigation.go("home")} style={[styles.iconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
          <ArrowLeft size={20} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.titleBlock}>
          <ThemedText variant="caption" tone="confirmed">
            Reminders
          </ThemedText>
          <ThemedText variant="title">Recurring bills</ThemedText>
        </View>
        <Pressable style={[styles.iconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
          <CalendarPlus size={20} color={theme.colors.confirmed} weight="duotone" />
        </Pressable>
      </View>

      <ThemedText variant="bodySm" tone="ink" style={{ marginTop: 8, paddingHorizontal: 4 }}>
        Select group
      </ThemedText>
      {groups.length ? <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={navigation.setSelectedGroupId} /> : null}
      {schedulesQuery.error ? <InlineNotice title="Schedules could not load" body={schedulesQuery.error.message} tone="owe" /> : null}

      <View style={styles.section}>
        <DataSurface>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: colorWithAlpha(theme.colors.confirmed, 0.15) }]}>
              <CalendarPlus size={24} color={theme.colors.confirmed} weight="duotone" />
            </View>
            <View style={styles.cardHeaderText}>
              <ThemedText variant="bodyMedium">Create schedule</ThemedText>
              <ThemedText variant="bodySm" tone="muted">Set up your recurring bill</ThemedText>
            </View>
          </View>
          <View style={styles.formBlock}>
            <InputField label="Bill title" value={title} onChangeText={setTitle} placeholder="e.g. Rent, electricity, internet" Icon={Receipt} />
            <InputField label="Expected amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" Icon={CurrencyInr} />
            <SegmentedControl value={frequency} options={[{ label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }]} onChange={setFrequency} />
            <InputField label="Reminder days before" value={reminderDays} onChangeText={setReminderDays} keyboardType="number-pad" Icon={Bell} />
            <InlineNotice title="Neutral tone" body="Default reminders say a bill is ready to review, not that someone is late." tone="info" />
            <Button label="Create recurring bill" onPress={() => createSchedule.mutate()} loading={createSchedule.isPending} disabled={!selectedGroupId || !title.trim() || parseAmountToMinor(amount) <= 0 || !groupQuery.data?.participants.length} Icon={CalendarPlus} variant="primary" />
          </View>
        </DataSurface>
      </View>

      <View style={styles.section}>
        <View style={styles.upcomingHeader}>
          <ThemedText variant="bodyMedium">Upcoming schedules</ThemedText>
          <Pressable style={styles.viewAllBtn}>
            <ThemedText variant="bodySm" tone="confirmed">View all</ThemedText>
            <CaretRight size={14} color={theme.colors.confirmed} weight="bold" />
          </Pressable>
        </View>

        {schedulesQuery.data?.length ? (
          <View style={styles.scheduleList}>
            {schedulesQuery.data.map((schedule) => {
              const titleLower = schedule.title.toLowerCase();
              let IconComp: React.ElementType = Receipt;
              let tone: keyof typeof theme.colors = "confirmed";

              if (titleLower.includes("rent") || titleLower.includes("house")) {
                IconComp = Buildings;
                tone = "confirmed";
              } else if (titleLower.includes("electric") || titleLower.includes("power")) {
                IconComp = Lightning;
                tone = "info";
              } else if (titleLower.includes("internet") || titleLower.includes("wifi")) {
                IconComp = WifiHigh;
                tone = "pending";
              }

              return (
                <DataSurface key={schedule.id}>
                  <View style={styles.scheduleRow}>
                    <View style={[styles.scheduleIconWrap, { backgroundColor: colorWithAlpha(theme.colors[tone], 0.15) }]}>
                      <IconComp size={24} color={theme.colors[tone]} weight="fill" />
                    </View>
                    <View style={styles.scheduleContent}>
                      <ThemedText variant="bodyMedium">{schedule.title}</ThemedText>
                      <ThemedText variant="bodySm" tone="muted">
                        {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} • Next {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "pending"}
                      </ThemedText>
                    </View>
                    <View style={styles.trailing}>
                      <ThemedText variant="title" style={{ fontSize: 16 }}>{formatMoney(schedule.amountMinor, schedule.currencyCode)}</ThemedText>
                      <StatusPill state={schedule.state === "active" ? "confirmed" : "pending"} />
                    </View>
                    <CaretRight size={16} color={theme.colors.inkMuted} />
                  </View>
                </DataSurface>
              );
            })}
          </View>
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
    alignItems: "center",
    gap: 12,
    marginBottom: 4
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  titleBlock: {
    flex: 1,
    gap: 0
  },
  section: {
    gap: 12,
    marginTop: 16
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 0,
    gap: 12
  },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  cardHeaderText: {
    flex: 1,
    gap: 2
  },
  formBlock: {
    gap: 16,
    padding: 16
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  scheduleList: {
    gap: 12
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14
  },
  scheduleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  scheduleContent: {
    flex: 1,
    gap: 4
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
    marginRight: 4
  }
});
