import React, { useMemo } from "react";
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";

import { useTheme } from "../theme";
import { MemberContributionReport, MonthlyComparisonReport, NetPositionReport, SettlementMethodReport } from "../types/domain";
import { formatMoney } from "../utils/money";
import { ThemedText } from "./ThemedText";

interface Props {
  currencyCode: string;
  monthly: MonthlyComparisonReport[];
  contributions: MemberContributionReport[];
  settlementMethods: SettlementMethodReport[];
  netPositions: NetPositionReport[];
}

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = Math.max(280, SCREEN_W - 48);

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeDonutSlice(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const sweep = Math.max(0.01, endDeg - startDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = polarToXY(cx, cy, outerR, startDeg);
  const outerEnd = polarToXY(cx, cy, outerR, startDeg + sweep);
  const innerStart = polarToXY(cx, cy, innerR, startDeg + sweep);
  const innerEnd = polarToXY(cx, cy, innerR, startDeg);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z"
  ].join(" ");
}

function DonutChart({
  slices,
  total,
  currencyCode,
  ink,
  muted
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
  currencyCode: string;
  ink: string;
  muted: string;
}) {
  const cx = CHART_W / 2;
  const cy = 108;
  const outerR = 78;
  const innerR = 48;
  let cursor = 0;
  const paths = slices.map((slice) => {
    const sweep = total > 0 ? (slice.value / total) * 360 : 0;
    const start = cursor;
    cursor += sweep;
    return { d: describeDonutSlice(cx, cy, outerR, innerR, start, cursor), color: slice.color };
  });

  return (
    <Svg width={CHART_W} height={216}>
      <Circle cx={cx} cy={cy} r={outerR} fill="none" stroke={muted} strokeWidth={1} opacity={0.25} />
      {paths.map((path, index) => (
        <Path key={index} d={path.d} fill={path.color} />
      ))}
      <SvgText x={cx} y={cy - 8} textAnchor="middle" fontSize={11} fill={muted}>
        Total
      </SvgText>
      <SvgText x={cx} y={cy + 14} textAnchor="middle" fontSize={15} fontWeight="700" fill={ink}>
        {formatMoney(total, currencyCode)}
      </SvgText>
    </Svg>
  );
}

function BarChart({
  rows,
  barColor,
  muted,
  ink,
  valueKey
}: {
  rows: { label: string; value: number }[];
  barColor: string;
  muted: string;
  ink: string;
  valueKey?: string;
}) {
  if (!rows.length) {
    return null;
  }
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const chartH = 150;
  const bottom = 28;
  const barW = Math.min(34, (CHART_W - 24) / rows.length - 10);
  const gap = (CHART_W - barW * rows.length) / (rows.length + 1);

  return (
    <Svg width={CHART_W} height={chartH + bottom + 8}>
      {rows.map((row, index) => {
        const height = Math.max(4, (Math.abs(row.value) / max) * (chartH - 18));
        const x = gap + index * (barW + gap);
        const y = chartH - height;
        return (
          <G key={`${row.label}-${index}`}>
            <Rect x={x} y={y} width={barW} height={height} rx={6} fill={barColor} opacity={0.9} />
            <SvgText x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill={muted}>
              {row.label}
            </SvgText>
            {valueKey ? (
              <SvgText x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={9} fill={ink}>
                {Math.round(row.value / 100)}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

function Legend({
  slices,
  total,
  currencyCode
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
  currencyCode: string;
}) {
  return (
    <View style={styles.legend}>
      {slices.map((slice) => (
        <View key={slice.label} style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
          <View style={styles.legendLabelBlock}>
            <ThemedText variant="bodySm">{slice.label}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              {total > 0 ? `${((slice.value / total) * 100).toFixed(0)}%` : "0%"}
            </ThemedText>
          </View>
          <ThemedText variant="amountSm">{formatMoney(slice.value, currencyCode)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

export function SpendingCharts({ currencyCode, monthly, contributions, settlementMethods, netPositions }: Props) {
  const theme = useTheme();
  const palette = theme.chartPalette;

  const contributionSlices = useMemo(
    () =>
      contributions
        .map((item, index) => ({
          label: item.displayName,
          value: Number(item.amountMinor),
          color: palette[index % palette.length]
        }))
        .filter((item) => item.value > 0),
    [contributions, palette]
  );

  const monthlyData = useMemo(
    () =>
      monthly.map((item) => ({
        label: new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short" }),
        value: Number(item.amountMinor)
      })),
    [monthly]
  );

  const methodSlices = useMemo(
    () =>
      settlementMethods
        .map((item, index) => ({
          label: `${item.method.toUpperCase()} · ${item.count}`,
          value: Number(item.amountMinor),
          color: palette[index % palette.length]
        }))
        .filter((item) => item.value > 0),
    [settlementMethods, palette]
  );

  const netRows = useMemo(
    () =>
      netPositions.map((item) => ({
        label: item.displayName.length > 8 ? `${item.displayName.slice(0, 7)}…` : item.displayName,
        value: Number(item.amountMinor)
      })),
    [netPositions]
  );

  const contributionTotal = useMemo(() => contributionSlices.reduce((sum, item) => sum + item.value, 0), [contributionSlices]);
  const methodTotal = useMemo(() => methodSlices.reduce((sum, item) => sum + item.value, 0), [methodSlices]);

  if (!monthly.length && !contributions.length && !settlementMethods.length && !netPositions.length) {
    return (
      <View style={styles.emptyWrap}>
        <ThemedText variant="bodySm" tone="muted" align="center">
          No report data for this date range. Try a wider range or add expenses.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {contributionSlices.length ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Contributions by member
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <DonutChart
              slices={contributionSlices}
              total={contributionTotal}
              currencyCode={currencyCode}
              ink={theme.colors.ink}
              muted={theme.colors.inkMuted}
            />
            <Legend slices={contributionSlices} total={contributionTotal} currencyCode={currencyCode} />
          </View>
        </>
      ) : null}

      {monthlyData.length > 1 ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Monthly spending
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <BarChart rows={monthlyData} barColor={palette[0]} muted={theme.colors.inkMuted} ink={theme.colors.ink} />
          </View>
        </>
      ) : null}

      {methodSlices.length ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Settlements by method
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <DonutChart
              slices={methodSlices}
              total={methodTotal}
              currencyCode={currencyCode}
              ink={theme.colors.ink}
              muted={theme.colors.inkMuted}
            />
            <Legend slices={methodSlices} total={methodTotal} currencyCode={currencyCode} />
          </View>
        </>
      ) : null}

      {netRows.length ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Net positions
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <BarChart rows={netRows} barColor={palette[1]} muted={theme.colors.inkMuted} ink={theme.colors.ink} />
          </View>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, marginTop: 8 }]}>
            {netPositions.map((item) => (
              <View key={`${item.participantId}-${item.currencyCode}`} style={styles.legendRow}>
                <ThemedText variant="bodySm" style={styles.legendLabelBlock}>
                  {item.displayName}
                </ThemedText>
                <ThemedText variant="amountSm">{formatMoney(Number(item.amountMinor), item.currencyCode)}</ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingBottom: 32 },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 24 },
  chartTitle: { marginBottom: 8, marginTop: 16 },
  card: { borderRadius: 16, padding: 16, overflow: "hidden" },
  legend: { marginTop: 12, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabelBlock: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }
});
