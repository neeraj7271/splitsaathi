import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BarChart, LineChart } from "react-native-chart-kit";
import Svg, { Circle, G, Path } from "react-native-svg";
import {
  CalendarBlank,
  CaretDown,
  ChartBar,
  Receipt,
  TrendUp,
  Wallet
} from "phosphor-react-native";

import { colorWithAlpha, useTheme } from "../theme";
import {
  ExpenseRow,
  MemberContributionReport,
  MonthlyComparisonReport,
  NetPositionReport,
  SettlementMethodReport
} from "../types/domain";
import { getExpenseCategoryDisplay } from "../utils/expenseCategoryDisplay";
import { formatMoney } from "../utils/money";
import { ThemedText } from "./ThemedText";

export type AnalyticsPeriod = "weekly" | "monthly" | "yearly";

export const ANALYTICS_PERIODS: Array<{ label: string; value: AnalyticsPeriod; days: number }> = [
  { label: "Weekly", value: "weekly", days: 7 },
  { label: "Monthly", value: "monthly", days: 30 },
  { label: "Yearly", value: "yearly", days: 365 }
];

interface Props {
  currencyCode: string;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  monthly: MonthlyComparisonReport[];
  contributions: MemberContributionReport[];
  settlementMethods: SettlementMethodReport[];
  netPositions: NetPositionReport[];
  expenses: ExpenseRow[];
}

const SCREEN_W = Dimensions.get("window").width;
const DEFAULT_CHART_W = Math.max(280, SCREEN_W - 72);
const TREND_H = 220;
const PIE_SIZE = 196;
const PIE_OUTER = 78;
const PIE_INNER = 48;

const ACCENT = {
  teal: "#0D9488",
  purple: "#6366F1",
  orange: "#F59E0B",
  coral: "#F97066",
  blue: "#38BDF8",
  pink: "#EC4899"
};

function minorToMajor(minor: number) {
  return Math.max(0, Number(minor) / 100);
}

function formatCompactInr(major: number) {
  if (major >= 100000) {
    return `₹${(major / 100000).toFixed(1)}L`;
  }
  if (major >= 1000) {
    return `₹${(major / 1000).toFixed(major >= 10000 ? 0 : 1)}k`;
  }
  return `₹${Math.round(major)}`;
}

function hexToRgba(hex: string, opacity = 1) {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function polarToXY(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad)
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
) {
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

function CategoryDonut({
  slices,
  totalLabel,
  totalValue,
  muted,
  ink
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  totalLabel: string;
  totalValue: string;
  muted: string;
  ink: string;
}) {
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const paths =
    total > 0
      ? slices.map((slice) => {
          const sweep = (slice.value / total) * 360;
          const start = cursor;
          cursor += sweep;
          return {
            key: slice.label,
            color: slice.color,
            d: describeDonutSlice(cx, cy, PIE_OUTER, PIE_INNER, start, cursor)
          };
        })
      : [];

  return (
    <View style={styles.donutWrap}>
      <Svg width={PIE_SIZE} height={PIE_SIZE}>
        <Circle cx={cx} cy={cy} r={PIE_OUTER} fill="none" stroke={muted} strokeWidth={1} opacity={0.2} />
        <G>
          {paths.map((path) => (
            <Path key={path.key} d={path.d} fill={path.color} />
          ))}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <ThemedText variant="caption" tone="muted" align="center">
          {totalLabel}
        </ThemedText>
        <ThemedText variant="bodySm" align="center" numberOfLines={1} style={{ color: ink }}>
          {totalValue}
        </ThemedText>
      </View>
    </View>
  );
}

function StatMiniCard({
  label,
  value,
  tint,
  Icon
}: {
  label: string;
  value: string;
  tint: string;
  Icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
          ...theme.cardShadow
        }
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: colorWithAlpha(tint, theme.mode === "dark" ? 0.22 : 0.12) }]}>
        <Icon size={16} color={tint} weight="duotone" />
      </View>
      <ThemedText variant="caption" tone="muted">
        {label}
      </ThemedText>
      <ThemedText variant="bodyMedium" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function ProgressBarRow({
  label,
  amountMinor,
  currencyCode,
  total,
  color,
  Icon
}: {
  label: string;
  amountMinor: number;
  currencyCode: string;
  total: number;
  color: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
}) {
  const theme = useTheme();
  const pct = total > 0 ? Math.min(100, (amountMinor / total) * 100) : 0;

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHead}>
        <View style={styles.progressLabelWrap}>
          {Icon ? (
            <View style={[styles.progressIcon, { backgroundColor: colorWithAlpha(color, theme.mode === "dark" ? 0.22 : 0.12) }]}>
              <Icon size={14} color={color} weight="duotone" />
            </View>
          ) : (
            <View style={[styles.progressDot, { backgroundColor: color }]} />
          )}
          <ThemedText variant="bodySm" numberOfLines={1} style={styles.progressLabel}>
            {label}
          </ThemedText>
        </View>
        <ThemedText variant="caption" tone="muted">
          {formatMoney(amountMinor, currencyCode)} · {pct.toFixed(0)}%
        </ThemedText>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colorWithAlpha(color, theme.mode === "dark" ? 0.18 : 0.1) }]}>
        <View style={[styles.progressFill, { width: `${Math.max(4, pct)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function SpendingCharts({
  currencyCode,
  period,
  onPeriodChange,
  monthly,
  contributions,
  settlementMethods,
  netPositions,
  expenses
}: Props) {
  const theme = useTheme();
  const palette = theme.chartPalette;
  const [selectedPoint, setSelectedPoint] = useState<{ index: number; value: number } | null>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_W);

  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expense.state !== "voided"),
    [expenses]
  );

  const totalSpendMinor = useMemo(
    () => activeExpenses.reduce((sum, expense) => sum + expense.totalAmountMinor, 0),
    [activeExpenses]
  );
  const expenseCount = activeExpenses.length;
  const averageMinor = expenseCount ? Math.round(totalSpendMinor / expenseCount) : 0;

  const previousWindowSpend = useMemo(() => {
    if (monthly.length < 2) {
      return null;
    }
    const current = Number(monthly[monthly.length - 1]?.amountMinor ?? 0);
    const previous = Number(monthly[monthly.length - 2]?.amountMinor ?? 0);
    if (previous <= 0) {
      return null;
    }
    return Math.round(((current - previous) / previous) * 100);
  }, [monthly]);

  const categoryBuckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of activeExpenses) {
      const key = expense.category?.trim() || "Other";
      map.set(key, (map.get(key) ?? 0) + expense.totalAmountMinor);
    }
    return [...map.entries()]
      .map(([label, value], index) => {
        const display = getExpenseCategoryDisplay(label === "Other" ? undefined : label);
        return {
          label: label === "Other" ? "Other" : display.label,
          value,
          color: display.tint || palette[index % palette.length],
          Icon: display.Icon
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [activeExpenses, palette]);

  const contributionRows = useMemo(
    () =>
      contributions
        .map((item, index) => ({
          label: item.displayName,
          value: Number(item.amountMinor),
          color: palette[index % palette.length]
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [contributions, palette]
  );
  const contributionTotal = useMemo(() => contributionRows.reduce((sum, row) => sum + row.value, 0), [contributionRows]);

  const trendData = useMemo(() => {
    if (period === "yearly" || period === "monthly") {
      const rows = monthly.map((item) => ({
        label:
          period === "yearly"
            ? new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short" })
            : new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: minorToMajor(Number(item.amountMinor))
      }));
      if (rows.length) {
        return rows;
      }
    }

    const byDay = new Map<string, number>();
    for (const expense of activeExpenses) {
      const key = expense.expenseDate.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + expense.totalAmountMinor);
    }
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!days.length) {
      return [{ label: "—", value: 0 }];
    }
    return days.slice(-7).map(([date, minor]) => ({
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }),
      value: minorToMajor(minor)
    }));
  }, [activeExpenses, monthly, period]);

  const trendLabels = trendData.map((row) => row.label);
  const trendValues = trendData.map((row) => row.value);
  const safeTrendValues = trendValues.length ? trendValues : [0];

  const methodBars = useMemo(
    () =>
      settlementMethods
        .map((item, index) => ({
          label: item.method.toUpperCase(),
          value: Number(item.amountMinor),
          color: palette[index % palette.length]
        }))
        .filter((item) => item.value > 0),
    [settlementMethods, palette]
  );

  const periodLabel = ANALYTICS_PERIODS.find((item) => item.value === period)?.label ?? "Monthly";

  const chartConfig = useMemo(
    () => ({
      backgroundColor: theme.colors.surface,
      backgroundGradientFrom: theme.colors.surface,
      backgroundGradientTo: theme.colors.surface,
      backgroundGradientFromOpacity: 1,
      backgroundGradientToOpacity: 1,
      decimalPlaces: 0,
      color: (opacity = 1) => hexToRgba(ACCENT.purple, opacity),
      labelColor: () => theme.colors.inkMuted,
      propsForBackgroundLines: {
        stroke: theme.colors.hairline,
        strokeDasharray: "4"
      },
      propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: ACCENT.purple
      },
      fillShadowGradientFrom: ACCENT.purple,
      fillShadowGradientTo: ACCENT.purple,
      fillShadowGradientFromOpacity: 0.28,
      fillShadowGradientToOpacity: 0.02,
      barPercentage: 0.55,
      barRadius: 8
    }),
    [theme.colors.hairline, theme.colors.inkMuted, theme.colors.surface]
  );

  const hasData =
    activeExpenses.length > 0 ||
    monthly.length > 0 ||
    contributions.length > 0 ||
    settlementMethods.length > 0 ||
    netPositions.length > 0;

  if (!hasData) {
    return (
      <View style={styles.emptyWrap}>
        <ThemedText variant="bodySm" tone="muted" align="center">
          No report data for this date range. Try a wider range or add expenses.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const next = Math.floor(event.nativeEvent.layout.width);
        if (next > 0 && Math.abs(next - chartWidth) > 2) {
          setChartWidth(next);
        }
      }}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <ThemedText variant="section">Expenses Analytics</ThemedText>
          <ThemedText variant="bodySm" tone="muted">
            Track your spending, smarter
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            const index = ANALYTICS_PERIODS.findIndex((item) => item.value === period);
            const next = ANALYTICS_PERIODS[(index + 1) % ANALYTICS_PERIODS.length];
            onPeriodChange(next.value);
          }}
          style={[
            styles.periodChip,
            {
              backgroundColor: colorWithAlpha(ACCENT.teal, theme.mode === "dark" ? 0.2 : 0.12),
              borderColor: colorWithAlpha(ACCENT.teal, 0.28)
            }
          ]}
        >
          <CalendarBlank size={14} color={ACCENT.teal} weight="duotone" />
          <ThemedText variant="caption" style={{ color: ACCENT.teal }}>
            {periodLabel}
          </ThemedText>
          <CaretDown size={12} color={ACCENT.teal} weight="bold" />
        </Pressable>
      </View>

      <LinearGradient
        colors={theme.mode === "dark" ? ["#0F766E", "#115E59"] : ["#14B8A6", "#0D9488"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroCard, theme.cardShadow]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Wallet size={18} color="#FFFFFF" weight="fill" />
          </View>
          <ThemedText variant="caption" style={styles.heroLabel}>
            Total Spend
          </ThemedText>
        </View>
        <ThemedText variant="title" style={styles.heroAmount}>
          {formatMoney(totalSpendMinor, currencyCode)}
        </ThemedText>
        {previousWindowSpend != null ? (
          <View style={styles.trendBadge}>
            <TrendUp size={12} color="#ECFDF5" weight="bold" />
            <ThemedText variant="caption" style={styles.trendBadgeText}>
              {previousWindowSpend >= 0 ? "+" : ""}
              {previousWindowSpend}% vs last period
            </ThemedText>
          </View>
        ) : (
          <ThemedText variant="caption" style={styles.heroSub}>
            Across {expenseCount} expense{expenseCount === 1 ? "" : "s"} in this range
          </ThemedText>
        )}
      </LinearGradient>

      <View style={styles.statsRow}>
        <StatMiniCard label="Expenses" value={String(expenseCount)} tint={ACCENT.purple} Icon={Receipt} />
        <StatMiniCard
          label="Average"
          value={formatMoney(averageMinor, currencyCode)}
          tint={ACCENT.orange}
          Icon={ChartBar}
        />
        <StatMiniCard
          label="Highest"
          value={formatMoney(
            activeExpenses.reduce((max, expense) => Math.max(max, expense.totalAmountMinor), 0),
            currencyCode
          )}
          tint={ACCENT.coral}
          Icon={TrendUp}
        />
      </View>

      <View style={[styles.segmentWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
        {ANALYTICS_PERIODS.map((option) => {
          const active = option.value === period;
          return (
            <Pressable
              key={option.value}
              onPress={() => onPeriodChange(option.value)}
              style={[
                styles.segmentItem,
                active
                  ? {
                      backgroundColor: ACCENT.purple,
                      ...theme.cardShadow
                    }
                  : null
              ]}
            >
              <ThemedText variant="caption" style={{ color: active ? "#FFFFFF" : theme.colors.inkMuted, fontWeight: "600" }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}>
        <ThemedText variant="bodyMedium" style={styles.cardTitle}>
          Spending Trend
        </ThemedText>
        <View style={styles.chartClipSafe}>
          <LineChart
            data={{
              labels: trendLabels.length ? trendLabels : ["—"],
              datasets: [{ data: safeTrendValues.length ? safeTrendValues : [0] }]
            }}
            width={chartWidth}
            height={TREND_H}
            chartConfig={chartConfig}
            bezier
            withInnerLines
            withOuterLines={false}
            withShadow
            fromZero
            yAxisLabel="₹"
            yAxisSuffix=""
            formatYLabel={(value) => {
              const num = Number(value);
              if (Number.isNaN(num)) {
                return value;
              }
              return num >= 1000 ? `${Math.round(num / 1000)}k` : `${Math.round(num)}`;
            }}
            onDataPointClick={({ index, value }) => setSelectedPoint({ index, value })}
            decorator={() => {
              if (!selectedPoint || !trendLabels[selectedPoint.index]) {
                return null;
              }
              return (
                <View style={styles.tooltipAnchor} pointerEvents="none">
                  <View style={[styles.tooltip, { backgroundColor: ACCENT.purple }]}>
                    <ThemedText variant="caption" style={styles.tooltipText}>
                      {trendLabels[selectedPoint.index]} · {formatCompactInr(selectedPoint.value)}
                    </ThemedText>
                  </View>
                </View>
              );
            }}
            style={styles.chart}
          />
        </View>
      </View>

      {categoryBuckets.length ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}>
          <ThemedText variant="bodyMedium" style={styles.cardTitle}>
            Category Breakdown
          </ThemedText>
          <View style={styles.donutBlock}>
            <CategoryDonut
              slices={categoryBuckets.slice(0, 6)}
              totalLabel="Total"
              totalValue={formatCompactInr(minorToMajor(totalSpendMinor))}
              muted={theme.colors.inkMuted}
              ink={theme.colors.ink}
            />
            <View style={styles.bottomLegend}>
              {categoryBuckets.slice(0, 5).map((bucket) => {
                const pct = totalSpendMinor > 0 ? ((bucket.value / totalSpendMinor) * 100).toFixed(0) : "0";
                return (
                  <View key={bucket.label} style={styles.bottomLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: bucket.color }]} />
                    <ThemedText variant="caption" numberOfLines={1} style={styles.bottomLegendLabel}>
                      {bucket.label}
                    </ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {pct}%
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {categoryBuckets.length ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}>
          <ThemedText variant="bodyMedium" style={styles.cardTitle}>
            Top Categories
          </ThemedText>
          <View style={styles.stack}>
            {categoryBuckets.slice(0, 5).map((bucket) => (
              <ProgressBarRow
                key={bucket.label}
                label={bucket.label}
                amountMinor={bucket.value}
                currencyCode={currencyCode}
                total={totalSpendMinor}
                color={bucket.color}
                Icon={bucket.Icon}
              />
            ))}
          </View>
        </View>
      ) : null}

      {contributionRows.length ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}>
          <ThemedText variant="bodyMedium" style={styles.cardTitle}>
            Spending by Member
          </ThemedText>
          <View style={styles.stack}>
            {contributionRows.slice(0, 6).map((row) => (
              <ProgressBarRow
                key={row.label}
                label={row.label}
                amountMinor={row.value}
                currencyCode={currencyCode}
                total={contributionTotal || 1}
                color={row.color}
              />
            ))}
          </View>
        </View>
      ) : null}

      {methodBars.length > 1 ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }, theme.cardShadow]}>
          <ThemedText variant="bodyMedium" style={styles.cardTitle}>
            Settlements by Method
          </ThemedText>
          <View style={styles.chartClipSafe}>
            <BarChart
              data={{
                labels: methodBars.map((item) => item.label),
                datasets: [
                  {
                    data: methodBars.map((item) => minorToMajor(item.value)),
                    colors: methodBars.map((item) => (opacity: number) => hexToRgba(item.color, opacity))
                  }
                ]
              }}
              width={chartWidth}
              height={210}
              chartConfig={chartConfig}
              yAxisLabel="₹"
              yAxisSuffix=""
              fromZero
              withCustomBarColorFromData
              flatColor
              showValuesOnTopOfBars
              style={styles.chart}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 24,
    width: "100%"
  },
  emptyWrap: {
    paddingVertical: 48,
    paddingHorizontal: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    gap: 8,
    overflow: "hidden"
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  heroLabel: {
    color: "rgba(255,255,255,0.88)"
  },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34
  },
  heroSub: {
    color: "rgba(255,255,255,0.82)"
  },
  trendBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  trendBadgeText: {
    color: "#ECFDF5"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 9
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    overflow: "visible"
  },
  cardTitle: {
    marginBottom: 10
  },
  chartClipSafe: {
    width: "100%",
    alignItems: "center",
    overflow: "visible"
  },
  chart: {
    borderRadius: 12,
    alignSelf: "center"
  },
  tooltipAnchor: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center"
  },
  tooltip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  tooltipText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  donutBlock: {
    alignItems: "center",
    gap: 16,
    width: "100%"
  },
  donutWrap: {
    width: PIE_SIZE,
    height: PIE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  bottomLegend: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10
  },
  bottomLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "46%"
  },
  bottomLegendLabel: {
    flexShrink: 1
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  stack: {
    gap: 12
  },
  progressRow: {
    gap: 6
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  progressLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0
  },
  progressIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  progressLabel: {
    flex: 1
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999
  }
});
