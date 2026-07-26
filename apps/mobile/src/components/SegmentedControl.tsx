import React, { useState } from "react";
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CaretRight } from "phosphor-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type OptionIcon = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "bold" | "fill" | "regular";
}>;

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  scrollable: scrollableProp,
  compact = false
}: {
  value: T;
  options: Array<{ label: string; value: T; Icon?: OptionIcon }>;
  onChange: (value: T) => void;
  /** When set, overrides the auto chip layout (defaults to chips when options.length > 3). */
  scrollable?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const scrollable = scrollableProp ?? options.length > 3;
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  function refreshHints(offsetX: number, nextViewport = viewportWidth, nextContent = contentWidth) {
    if (!nextViewport || !nextContent) {
      return;
    }
    setCanScrollLeft(offsetX > 4);
    setCanScrollRight(offsetX + nextViewport < nextContent - 4);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setViewportWidth(layoutMeasurement.width);
    setContentWidth(contentSize.width);
    refreshHints(contentOffset.x, layoutMeasurement.width, contentSize.width);
  }

  function onViewportLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    setViewportWidth(width);
    refreshHints(0, width, contentWidth);
  }

  const segments = options.map((option) => {
    const active = option.value === value;
    const Icon = option.Icon;
    const color = active ? theme.colors.confirmed : theme.colors.inkMuted;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        style={[
          styles.segment,
          compact ? styles.segmentCompact : null,
          scrollable ? styles.chip : styles.flexSegment,
          {
            borderRadius: theme.radius.full,
            backgroundColor: active
              ? scrollable
                ? colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.18 : 0.12)
                : theme.colors.surface
              : scrollable
                ? theme.colors.surface
                : "transparent",
            borderColor: scrollable
              ? active
                ? colorWithAlpha(theme.colors.confirmed, 0.35)
                : theme.colors.hairline
              : active
                ? theme.colors.hairline
                : "transparent",
            ...(active && !scrollable ? theme.cardShadow : null)
          }
        ]}
      >
        {Icon ? <Icon size={compact ? 14 : 16} color={color} weight="duotone" /> : null}
        <ThemedText variant="caption" tone={active ? "confirmed" : "muted"}>
          {option.label}
        </ThemedText>
      </Pressable>
    );
  });

  if (scrollable) {
    const fadeColor = theme.colors.canvas;
    return (
      <View style={styles.scrollWrap} onLayout={onViewportLayout}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(width) => {
            setContentWidth(width);
            refreshHints(0, viewportWidth, width);
          }}
        >
          {segments}
        </ScrollView>

        {canScrollLeft ? (
          <LinearGradient
            pointerEvents="none"
            colors={[fadeColor, colorWithAlpha(fadeColor, 0)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.edgeFade, styles.edgeLeft]}
          />
        ) : null}

        {canScrollRight ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[colorWithAlpha(fadeColor, 0), fadeColor]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.edgeFade, styles.edgeRight]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.scrollHint,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.hairline
                },
                theme.cardShadow
              ]}
            >
              <CaretRight size={14} color={theme.colors.confirmed} weight="bold" />
            </View>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        compact ? styles.wrapCompact : null,
        { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.full }
      ]}
    >
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    flexDirection: "row",
    padding: 4,
    gap: 2
  },
  wrapCompact: {
    minHeight: 40,
    padding: 3
  },
  scrollWrap: {
    position: "relative"
  },
  chipRow: {
    gap: 8,
    paddingRight: 36,
    alignItems: "center"
  },
  segment: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12
  },
  segmentCompact: {
    minHeight: 34,
    paddingHorizontal: 8,
    gap: 4
  },
  flexSegment: {
    flex: 1
  },
  chip: {
    flexGrow: 0
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 28
  },
  edgeLeft: {
    left: 0
  },
  edgeRight: {
    right: 0,
    width: 40
  },
  scrollHint: {
    position: "absolute",
    right: 0,
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
