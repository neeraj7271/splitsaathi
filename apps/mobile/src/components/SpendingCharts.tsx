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
const CHART_W = SCREEN_W - 48; // 24px margin each side

// ─── helpers ────────────────────────────────────────────────────────────────

// ─── Donut chart (category breakdown) ───────────────────────────────────────

const DONUT_R = 72;
const DONUT_STROKE = 22;
const DONUT_CX = CHART_W / 2;
const DONUT_CY = DONUT_R + DONUT_STROKE + 8;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function DonutChart({ slices, palette, total, currencyCode }: { slices: { label: string; total: number }[]; palette: readonly string[]; total: number; currencyCode: string }) {
  const svgH = DONUT_CY + DONUT_R + DONUT_STROKE + 12;
  const paths: { d: string; color: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < slices.length; i++) {
    const sweep = (slices[i].total / total) * 360;
    const endDeg = cursor + sweep;
    paths.push({ d: describeArc(DONUT_CX, DONUT_CY, DONUT_R, cursor, Math.min(endDeg, cursor + sweep - 0.5)), color: palette[i % palette.length] });
    cursor = endDeg;
  }

  return (
    <Svg width={CHART_W} height={svgH}>
      <G>
        {paths.map((p, i) => (
          <Path key={i} d={p.d} stroke={p.color} strokeWidth={DONUT_STROKE} fill="none" strokeLinecap="butt" />
        ))}
      </G>
      <SvgText x={DONUT_CX} y={DONUT_CY - 10} textAnchor="middle" fontSize={11} fill="#888">
        Total
      </SvgText>
      <SvgText x={DONUT_CX} y={DONUT_CY + 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#eee">
        {formatMoney(total, currencyCode)}
      </SvgText>
    </Svg>
  );
}

// ─── Bar chart (monthly) ────────────────────────────────────────────────────

const BAR_H = 140;
const BAR_BOTTOM_MARGIN = 24;

function BarChart({ months, currencyCode, barColor }: { months: { month: string; total: number }[]; currencyCode: string; barColor: string }) {
  if (!months.length) return null;
  const maxTotal = Math.max(...months.map((m) => m.total));
  const barW = Math.min(36, (CHART_W - 16) / months.length - 8);
  const gap = (CHART_W - barW * months.length) / (months.length + 1);
  const svgH = BAR_H + BAR_BOTTOM_MARGIN + 4;

  return (
    <Svg width={CHART_W} height={svgH}>
      {months.map((m, i) => {
        const pct = maxTotal > 0 ? m.total / maxTotal : 0;
        const barHeight = Math.max(4, pct * (BAR_H - 20));
        const x = gap + i * (barW + gap);
        const y = BAR_H - barHeight;
        return (
          <G key={m.month}>
            <Rect x={x} y={y} width={barW} height={barHeight} rx={4} fill={barColor} opacity={0.85 - i * 0.05} />
            <SvgText x={x + barW / 2} y={BAR_H + 14} textAnchor="middle" fontSize={9} fill="#888">
              {m.month}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────

function Legend({ slices, palette, total, currencyCode }: { slices: { label: string; total: number }[]; palette: readonly string[]; total: number; currencyCode: string }) {
  return (
    <View style={styles.legend}>
      {slices.map((s, i) => (
        <View key={s.label} style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: palette[i % palette.length] }]} />
          <View style={styles.legendLabelBlock}>
            <ThemedText variant="bodySm">{s.label}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              {((s.total / total) * 100).toFixed(0)}%
            </ThemedText>
          </View>
          <ThemedText variant="amountSm">{formatMoney(s.total, currencyCode)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function SpendingCharts({ currencyCode, monthly, contributions, settlementMethods, netPositions }: Props) {
  const theme = useTheme();
  const palette = theme.chartPalette;

  const categorySlices = useMemo(
    () => contributions.map((item) => ({ label: item.displayName, total: Number(item.amountMinor) })).filter((item) => item.total > 0),
    [contributions]
  );
  const monthlyData = useMemo(
    () =>
      monthly.map((item) => ({
        month: new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        total: Number(item.amountMinor)
      })),
    [monthly]
  );
  const grandTotal = useMemo(() => categorySlices.reduce((s, c) => s + c.total, 0), [categorySlices]);

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
      {/* Category donut */}
      <ThemedText variant="section" style={styles.chartTitle}>
        Contributions by member
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <DonutChart slices={categorySlices} palette={palette} total={grandTotal} currencyCode={currencyCode} />
        <Legend slices={categorySlices} palette={palette} total={grandTotal} currencyCode={currencyCode} />
      </View>

      {/* Monthly bar chart */}
      {monthlyData.length > 1 ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Monthly Spending
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <BarChart months={monthlyData} currencyCode={currencyCode} barColor={palette[0]} />
          </View>
        </>
      ) : null}
      {settlementMethods.length ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Settlements by method
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {settlementMethods.map((item) => (
              <View key={item.method} style={styles.legendRow}>
                <ThemedText variant="bodySm" style={styles.legendLabelBlock}>{item.method.toUpperCase()} · {item.count} payments</ThemedText>
                <ThemedText variant="amountSm">{formatMoney(Number(item.amountMinor), currencyCode)}</ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {netPositions.length ? (
        <>
          <ThemedText variant="section" style={styles.chartTitle}>
            Net positions
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {netPositions.map((item) => (
              <View key={`${item.participantId}-${item.currencyCode}`} style={styles.legendRow}>
                <ThemedText variant="bodySm" style={styles.legendLabelBlock}>{item.displayName}</ThemedText>
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
  legendLabelBlock: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center" },
});
