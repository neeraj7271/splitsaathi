import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { BottomSheetModal } from "./BottomSheetModal";
import { InlineNotice } from "./InlineNotice";
import { SettlementDetailAction, SettlementDetailContent } from "./SettlementDetailContent";
import { ThemedText } from "./ThemedText";
import { GroupDetail, SettlementIntent } from "../types/domain";
import { buildGroupDisplayLookups, GroupDisplayLookups } from "../utils/displayNames";
import { buildSettlementDetailViewModel } from "../utils/settlementDisplay";

export type OpenSettlementDetailOptions = {
  settlement?: SettlementIntent;
  intentId?: string;
  groupId?: string;
  lookups?: GroupDisplayLookups;
  title?: string;
  subtitle?: string;
  actions?: SettlementDetailAction[];
};

type SettlementDetailModalContextValue = {
  open: (options: OpenSettlementDetailOptions) => void;
  close: () => void;
  isOpen: boolean;
};

type ActiveSettlementDetailState = OpenSettlementDetailOptions & {
  settlement?: SettlementIntent;
  lookups?: GroupDisplayLookups;
};

const SettlementDetailModalContext = createContext<SettlementDetailModalContextValue | null>(null);

async function resolveSettlementDetail(
  options: OpenSettlementDetailOptions,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<ActiveSettlementDetailState> {
  if (options.settlement) {
    return {
      ...options,
      settlement: options.settlement,
      lookups: options.lookups
    };
  }

  if (!options.intentId) {
    throw new Error("A settlement or intentId is required.");
  }

  const settlement = await apiClient.getSettlementIntent(options.intentId);
  let lookups = options.lookups;
  const groupId = options.groupId ?? settlement.groupId;
  if (!lookups && groupId) {
    const cachedGroup = queryClient.getQueryData<GroupDetail>(["group", groupId]);
    if (cachedGroup) {
      lookups = buildGroupDisplayLookups(cachedGroup);
    }
  }

  return {
    ...options,
    settlement,
    lookups,
    groupId
  };
}

export function SettlementDetailModalProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<ActiveSettlementDetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const close = useCallback(() => {
    setActive(null);
    setError(undefined);
    setLoading(false);
  }, []);

  const open = useCallback(
    (options: OpenSettlementDetailOptions) => {
      setError(undefined);
      if (options.settlement) {
        setActive({
          ...options,
          settlement: options.settlement,
          lookups: options.lookups
        });
        setLoading(false);
        return;
      }

      if (!options.intentId) {
        setError("A settlement or intentId is required.");
        setActive(options);
        setLoading(false);
        return;
      }

      setLoading(true);
      setActive(options);
      void resolveSettlementDetail(options, queryClient)
        .then((resolved) => {
          setActive(resolved);
          setError(undefined);
        })
        .catch((nextError) => {
          setError(nextError instanceof Error ? nextError.message : "Could not load settlement.");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({
      open,
      close,
      isOpen: Boolean(active)
    }),
    [active, close, open]
  );

  const model =
    active?.settlement && !loading && !error
      ? buildSettlementDetailViewModel(active.settlement, active.lookups, {
          title: active.title,
          subtitle: active.subtitle
        })
      : null;

  return (
    <SettlementDetailModalContext.Provider value={value}>
      {children}
      <BottomSheetModal
        visible={Boolean(active)}
        title={model?.title ?? active?.title ?? "Settlement details"}
        subtitle={model?.subtitle ?? active?.subtitle}
        onClose={close}
      >
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ThemedText variant="bodySm" tone="muted" align="center">
              Loading settlement…
            </ThemedText>
          </View>
        ) : null}
        {error ? <InlineNotice title="Could not load settlement" body={error} tone="owe" /> : null}
        {active?.settlement && !loading && !error ? (
          <SettlementDetailContent
            settlement={active.settlement}
            lookups={active.lookups}
            title={active.title}
            subtitle={active.subtitle}
            actions={active.actions}
            onActionPress={(action) => {
              if (action.closeOnPress !== false) {
                close();
              }
            }}
          />
        ) : null}
      </BottomSheetModal>
    </SettlementDetailModalContext.Provider>
  );
}

export function useSettlementDetailModal() {
  const context = useContext(SettlementDetailModalContext);
  if (!context) {
    throw new Error("useSettlementDetailModal must be used within SettlementDetailModalProvider");
  }
  return context;
}

export function useOptionalSettlementDetailModal() {
  return useContext(SettlementDetailModalContext);
}
