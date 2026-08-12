import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { groupEntriesByMonth } from "../../lib/entry-utils";
import type { JournalEntryListItem } from "../../lib/types";
import { cx } from "../../lib/theme";
import { PillButton } from "../common/ui";
import { AnimatedDrawer } from "./AnimatedShell";

type Props = {
  visible: boolean;
  entries: JournalEntryListItem[];
  loading: boolean;
  selectedId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onNewEntry: () => void;
  onSelect: (entry: JournalEntryListItem) => void;
  onDelete: (entry: JournalEntryListItem) => void;
};

export function EntriesDrawer({
  visible,
  entries,
  loading,
  selectedId,
  onClose,
  onRefresh,
  onNewEntry,
  onSelect,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => groupEntriesByMonth(entries), [entries]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCollapsed(new Set(groups.slice(1).map((g) => g.key)));
    setConfirmDeleteId(null);
  }, [visible, groups.map((g) => g.key).join("|")]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <AnimatedDrawer visible={visible} onClose={onClose} side="left" maxWidth={320}>
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
      >
        <View className="flex-row items-center justify-between border-b border-paper-line px-[18px] py-3.5">
          <Text className="font-display text-lg text-ink-900">Entries</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            className="h-10 min-w-10 items-center justify-center"
          >
            <Text className="text-base text-ink-500">✕</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 border-b border-paper-line px-4 py-3">
          <View className="flex-1">
            <PillButton
              label="+  New entry"
              onPress={() => {
                onClose();
                onNewEntry();
              }}
              penAccent
              fullWidth
            />
          </View>
          <PillButton label="Refresh" onPress={onRefresh} disabled={loading} />
        </View>

        <ScrollView contentContainerClassName="p-3 pb-10">
          {loading && entries.length === 0 ? (
            <Text className="p-5 text-center text-sm leading-[22px] text-ink-500">
              Loading entries…
            </Text>
          ) : entries.length === 0 ? (
            <Text className="p-5 text-center text-sm leading-[22px] text-ink-500">
              No saved entries yet. Write and save your first journal entry.
            </Text>
          ) : (
            groups.map((group) => {
              const expanded = !collapsed.has(group.key);
              return (
                <View key={group.key} className="mb-2">
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 px-2.5 py-2.5"
                    onPress={() => toggle(group.key)}
                  >
                    <Text className="w-3.5 text-xs text-ink-400">{expanded ? "▾" : "▸"}</Text>
                    <Text className="flex-1 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                      {group.label}
                    </Text>
                    <Text className="text-xs text-ink-400">{group.entries.length}</Text>
                  </TouchableOpacity>
                  {expanded &&
                    group.entries.map((entry) => {
                      const selected = entry.id === selectedId;
                      return (
                        <View
                          key={entry.id}
                          className={cx(
                            "mb-0.5 flex-row items-center rounded-[10px]",
                            selected && "border border-pen/20 bg-white/80"
                          )}
                        >
                          <TouchableOpacity
                            className="flex-1 px-3 py-3"
                            onPress={() => {
                              onSelect(entry);
                              onClose();
                            }}
                          >
                            <Text
                              className="font-display text-[15px] text-ink-900"
                              numberOfLines={1}
                            >
                              {entry.title || "Untitled"}
                            </Text>
                          </TouchableOpacity>
                          {confirmDeleteId === entry.id ? (
                            <View className="flex-row gap-1.5 pr-1.5">
                              <TouchableOpacity
                                onPress={() => {
                                  onDelete(entry);
                                  setConfirmDeleteId(null);
                                }}
                              >
                                <Text className="p-1.5 text-xs font-semibold text-coral-700">
                                  Delete
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setConfirmDeleteId(null)}>
                                <Text className="p-1.5 text-xs text-ink-500">Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => setConfirmDeleteId(entry.id)}
                              hitSlop={8}
                              className="p-2"
                            >
                              <Text className="text-[13px] opacity-50">🗑</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </AnimatedDrawer>
  );
}
