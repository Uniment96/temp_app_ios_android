import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  Platform,
} from "react-native";

import { collection, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../../../src/context/AuthContext";
import { db } from "../../../src/firebase/firebaseConfig";

import * as FileSystem from "expo-file-system";
import { writeAsStringAsync } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ✅ calendar picker
import { Calendar } from "react-native-calendars";

type Status = "ok" | "warning" | "damaged";
type SheetKind = "branch" | "chiller" | "status" | null;

type Branch = { id: string; ownerId: string; name: string; isActive: boolean };
type Chiller = { id: string; ownerId: string; name: string; branchId: string; isActive: boolean };

type TempLog = {
  id: string;
  ownerId: string;
  chillerId: string;
  branchId: string;
  tempC: number;
  humidity?: number | null;
  status: Status;
  note?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
  createdBy: string;
  createdAt?: any;
};

type PickerOption = { key: string; label: string; subLabel?: string };

const STATUS_OPTIONS: Array<"all" | Status> = ["all", "ok", "warning", "damaged"];

// ✅ DESIGN TOKENS (your palette)
const C = {
  bg: "#0F172A",
  surface: "#0B1220",
  card: "#111827",
  text: "#F8FAFC",
  muted: "#94A3B8",
  line: "#1F2937",
  good: "#38BDF8",
  critical: "#F43F5E",
};

function safeTime(v: any): number {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    return 0;
  } catch {
    return 0;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseDateInputValue(s: string) {
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ✅ iOS-style bottom sheet picker (no libs)
function BottomSheetPicker({
  open,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: PickerOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!open) return;

    backdrop.setValue(0);
    translateY.setValue(24);

    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start();
  }, [open, backdrop, translateY]);

  const closeWithAnim = () => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 18, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!open) return null;

  return (
    <Modal transparent animationType="none" visible={open} onRequestClose={closeWithAnim}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          opacity: backdrop,
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeWithAnim} />

        <Animated.View style={{ transform: [{ translateY }] }}>
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderWidth: 1,
              borderColor: C.line,
              overflow: "hidden",
              paddingBottom: Platform.OS === "ios" ? 18 : 12,
            }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.line,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 13 }}>{title}</Text>
              <Pressable onPress={closeWithAnim} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={{ color: C.good, fontWeight: "900", fontSize: 12.5 }}>Done</Text>
              </Pressable>
            </View>

            <FlatList
              data={options}
              keyExtractor={(o) => o.key}
              style={{ maxHeight: 340 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.line }} />}
              renderItem={({ item }) => {
                const active = item.key === selectedKey;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.key);
                      closeWithAnim();
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: active ? C.surface : C.card,
                      opacity: pressed ? 0.9 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: C.text,
                          fontWeight: active ? "900" : "700",
                          fontSize: 13,
                        }}
                      >
                        {item.label}
                      </Text>
                      {!!item.subLabel && (
                        <Text numberOfLines={1} style={{ color: C.muted, marginTop: 2, fontSize: 12 }}>
                          {item.subLabel}
                        </Text>
                      )}
                    </View>

                    <Text style={{ color: active ? C.good : "transparent", fontSize: 14, fontWeight: "900" }}>
                      ✓
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 14 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>No options</Text>
                </View>
              }
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ✅ Native-style calendar modal (react-native-calendars), two-step: From -> To
function CalendarRangeModal({
  open,
  from,
  to,
  onApply,
  onClose,
}: {
  open: boolean;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  onApply: (nextFrom: string, nextTo: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"from" | "to">("from");
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  useEffect(() => {
    if (!open) return;
    setLocalFrom(from);
    setLocalTo(to);
    setStep("from");
  }, [open, from, to]);

  const fromD = parseDateInputValue(localFrom);
  const toD = parseDateInputValue(localTo);

  const canApply = useMemo(() => {
    if (!fromD || !toD) return false;
    return fromD.getTime() <= toD.getTime();
  }, [fromD, toD]);

  const marked = useMemo(() => {
    // Mark selected from/to dates and the in-between range (simple loop)
    const marks: any = {};

    if (localFrom) {
      marks[localFrom] = {
        ...(marks[localFrom] || {}),
        startingDay: true,
        color: C.good,
        textColor: C.bg,
      };
    }
    if (localTo) {
      marks[localTo] = {
        ...(marks[localTo] || {}),
        endingDay: true,
        color: C.good,
        textColor: C.bg,
      };
    }

    const f = parseDateInputValue(localFrom);
    const t = parseDateInputValue(localTo);
    if (f && t && f.getTime() <= t.getTime()) {
      const cur = new Date(f.getTime());
      while (cur.getTime() <= t.getTime()) {
        const key = toDateInputValue(cur);
        // middle days
        if (key !== localFrom && key !== localTo) {
          marks[key] = { color: "rgba(56,189,248,0.20)", textColor: C.text };
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    return marks;
  }, [localFrom, localTo]);

  const onDayPress = (day: any) => {
    const s = String(day?.dateString || "");
    if (!s) return;

    if (step === "from") {
      setLocalFrom(s);

      // If current "to" is before new from, snap to same day
      if (localTo) {
        const nf = parseDateInputValue(s)?.getTime() ?? 0;
        const nt = parseDateInputValue(localTo)?.getTime() ?? 0;
        if (nt < nf) setLocalTo(s);
      } else {
        setLocalTo(s);
      }

      setStep("to");
      return;
    }

    // step === "to"
    const nf = parseDateInputValue(localFrom)?.getTime() ?? 0;
    const nt = parseDateInputValue(s)?.getTime() ?? 0;

    if (nt < nf) {
      // if user picks earlier date, treat it as new FROM and continue
      setLocalFrom(s);
      setLocalTo(s);
      setStep("to");
      return;
    }

    setLocalTo(s);
  };

  const apply = () => {
    if (!canApply) {
      Alert.alert("Validation", "Please select a valid range.");
      return;
    }
    onApply(localFrom, localTo);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 18 }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: C.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: C.line,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: C.line,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 13 }}>
                Select date range
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "800" }}>
                {step === "from" ? "Pick FROM date" : "Pick TO date"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={onClose} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={{ color: C.muted, fontWeight: "900", fontSize: 12.5 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={apply} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={{ color: canApply ? C.good : "#64748B", fontWeight: "900", fontSize: 12.5 }}>
                  Apply
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Calendar */}
          <View style={{ padding: 12, backgroundColor: C.card }}>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, backgroundColor: C.surface }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900" }}>FROM</Text>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: "900", marginTop: 2 }}>{localFrom}</Text>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, backgroundColor: C.surface }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900" }}>TO</Text>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: "900", marginTop: 2 }}>{localTo}</Text>
              </View>
            </View>

            <Calendar
              onDayPress={onDayPress}
              markedDates={marked}
              markingType={"period"}
              theme={{
                backgroundColor: C.card,
                calendarBackground: C.card,
                textSectionTitleColor: C.muted,
                dayTextColor: C.text,
                monthTextColor: C.text,
                todayTextColor: C.good,
                arrowColor: C.good,
                textDisabledColor: "#334155",
              }}
            />

            {/* Quick actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => {
                  const now = new Date();
                  const toS = toDateInputValue(now);
                  const fromD = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setLocalFrom(toDateInputValue(fromD));
                  setLocalTo(toS);
                  setStep("to");
                }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 14,
                  paddingVertical: 10,
                  backgroundColor: C.surface,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>Last 7d</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const now = new Date();
                  const toS = toDateInputValue(now);
                  const fromD = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setLocalFrom(toDateInputValue(fromD));
                  setLocalTo(toS);
                  setStep("to");
                }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 14,
                  paddingVertical: 10,
                  backgroundColor: C.surface,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }}>Last 30d</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterPill({
  label,
  value,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
      })}
    >
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 13, fontWeight: "900", marginTop: 2 }} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

export default function Reports() {
  const { user, profile, loading } = useAuth();

  // AUTH GATE
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  // STATE
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [chillersLoading, setChillersLoading] = useState(true);
  const [chillers, setChillers] = useState<Chiller[]>([]);
  const [selectedChillerId, setSelectedChillerId] = useState<string>("all");

  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [logsLoading, setLogsLoading] = useState(true);
  const [logs, setLogs] = useState<TempLog[]>([]);

  const [exporting, setExporting] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);

  // ✅ NEW: calendar modal open/close
  const [dateModalOpen, setDateModalOpen] = useState(false);

  // custom date range (defaults: last 7 days)
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return toDateInputValue(from);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  // HELPERS
  const getWritableUri = (filename: string) => {
    const docDir = (FileSystem as any).documentDirectory;
    const cacheDir = (FileSystem as any).cacheDirectory;
    const base = typeof docDir === "string" ? docDir : typeof cacheDir === "string" ? cacheDir : "";
    if (!base) throw new Error("No writable directory found (document/cache).");
    return base + filename;
  };

  const formatWhen = (ts: any) => {
    try {
      const d = ts?.toDate?.() ? ts.toDate() : null;
      return d ? d.toLocaleString() : "";
    } catch {
      return "";
    }
  };

  const statusColor = (s: Status) => (s === "ok" ? C.good : s === "warning" ? "#F59E0B" : C.critical);

  const escapeHtml = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const safeShare = async (uri: string) => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Not supported", "Sharing is not available on this device.");
      return;
    }
    await Promise.race([Sharing.shareAsync(uri), sleep(8000)]);
  };

  const runExport = async (fn: () => Promise<void>) => {
    if (exporting) return;
    setExporting(true);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      setExporting(false);
      Alert.alert(
        "Export timeout",
        "Sharing took too long (common on iOS Simulator). The file may still be created.",
      );
    }, 15000);

    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Export failed");
    } finally {
      clearTimeout(timer);
      if (!timedOut) setExporting(false);
    }
  };

  const createdByName = (uid: string) => {
    if (user?.uid && uid === user.uid) return profile?.name || user.email || uid;
    return uid || "—";
  };

  // ✅ LOAD BRANCHES (LIVE)
  useEffect(() => {
    if (!user) return;

    setBranchesLoading(true);

    const q1 = query(collection(db, "branches"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      q1,
      (snap) => {
        const data: Branch[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            ownerId: v.ownerId ?? "",
            name: v.name ?? "",
            isActive: v.isActive ?? true,
          };
        });

        data.sort((a, b) => safeTime((b as any).createdAt) - safeTime((a as any).createdAt));

        const active = data.filter((b) => b.isActive);
        setBranches(active);
        setBranchesLoading(false);

        if (active.length === 0) setSelectedBranchId("");
        else if (!selectedBranchId) setSelectedBranchId(active[0].id);
        else if (!active.some((b) => b.id === selectedBranchId)) setSelectedBranchId(active[0].id);
      },
      (err) => {
        setBranchesLoading(false);
        Alert.alert("Error", err.message);
      },
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ✅ LOAD CHILLERS (BY BRANCH)
  useEffect(() => {
    const run = async () => {
      if (!user) return;

      if (!selectedBranchId) {
        setChillers([]);
        setSelectedChillerId("all");
        setChillersLoading(false);
        return;
      }

      try {
        setChillersLoading(true);

        const q2 = query(
          collection(db, "chillers"),
          where("ownerId", "==", user.uid),
          where("branchId", "==", selectedBranchId),
        );

        const snap = await getDocs(q2);
        const data: Chiller[] = snap.docs
          .map((d) => {
            const v = d.data() as any;
            return {
              id: d.id,
              ownerId: v.ownerId ?? "",
              name: v.name ?? "",
              branchId: v.branchId ?? "",
              isActive: v.isActive ?? true,
            };
          })
          .filter((c) => c.isActive);

        data.sort((a, b) => a.name.localeCompare(b.name));

        setChillers(data);

        if (selectedChillerId !== "all" && !data.some((c) => c.id === selectedChillerId)) {
          setSelectedChillerId("all");
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load chillers");
      } finally {
        setChillersLoading(false);
      }
    };

    run();
  }, [user, selectedBranchId, selectedChillerId]);

  // ✅ LOAD LOGS (LIVE)
  useEffect(() => {
    if (!user) return;

    if (!selectedBranchId) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }

    setLogsLoading(true);

    const q3 = query(
      collection(db, "tempLogs"),
      where("ownerId", "==", user.uid),
      where("branchId", "==", selectedBranchId),
      limit(500),
    );

    const unsub = onSnapshot(
      q3,
      (snap) => {
        const data: TempLog[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            ownerId: v.ownerId ?? "",
            chillerId: v.chillerId,
            branchId: v.branchId,
            tempC: v.tempC,
            humidity: v.humidity ?? null,
            status: v.status,
            note: v.note ?? "",
            photoUrl: v.photoUrl ?? null,
            photoPath: v.photoPath ?? null,
            createdBy: v.createdBy ?? "",
            createdAt: v.createdAt,
          };
        });

        data.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));

        setLogs(data);
        setLogsLoading(false);
      },
      (err) => {
        setLogsLoading(false);
        Alert.alert("Error", err.message);
      },
    );

    return () => unsub();
  }, [user, selectedBranchId]);

  const branchName = branches.find((b) => b.id === selectedBranchId)?.name || "Select branch";
  const chillerName = (id: string) => chillers.find((c) => c.id === id)?.name || id;

  // FILTERED LOGS (custom date range + status + chiller)
  const filtered = useMemo(() => {
    const fromD = parseDateInputValue(dateFrom);
    const toD = parseDateInputValue(dateTo);
    const fromMs = fromD ? fromD.getTime() : 0;
    const toMs = toD ? toD.getTime() + 24 * 60 * 60 * 1000 - 1 : Number.MAX_SAFE_INTEGER;

    return logs.filter((l) => {
      const dt = l.createdAt?.toDate?.() ? l.createdAt.toDate().getTime() : 0;
      if (dt && (dt < fromMs || dt > toMs)) return false;
      if (selectedChillerId !== "all" && l.chillerId !== selectedChillerId) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      return true;
    });
  }, [logs, dateFrom, dateTo, selectedChillerId, statusFilter]);

  // Picker options
  const branchOptions = useMemo(() => branches.map((b) => ({ key: b.id, label: b.name })), [branches]);

  const chillerOptions = useMemo(() => {
    const base: PickerOption[] = [{ key: "all", label: "All chillers" }];
    return base.concat(chillers.map((c) => ({ key: c.id, label: c.name })));
  }, [chillers]);

  const statusOptions = useMemo<PickerOption[]>(
    () => [
      { key: "all", label: "All statuses" },
      { key: "ok", label: "Good (OK)" },
      { key: "warning", label: "Warning" },
      { key: "damaged", label: "Critical (Damaged)" },
    ],
    [],
  );

  const statusLabel =
    statusFilter === "all"
      ? "ALL"
      : statusFilter === "ok"
        ? "GOOD"
        : statusFilter === "warning"
          ? "WARNING"
          : "CRITICAL";

  const dateLabel = `${dateFrom} → ${dateTo}`;

  // EXPORT META + ROWS
  const exportMeta = () => {
    const exporter = profile?.name || user?.email || "—";
    const now = new Date().toLocaleString();
    const ch = selectedChillerId === "all" ? "ALL" : chillerName(selectedChillerId);

    return {
      exporter,
      now,
      branch: branchName,
      range: `${dateFrom} to ${dateTo}`,
      status: statusLabel,
      chiller: ch,
    };
  };

  const buildRows = () => {
    const meta = exportMeta();
    return filtered.map((l) => ({
      ExportedBy: meta.exporter,
      Branch: meta.branch,
      Chiller: chillerName(l.chillerId),
      DateTime: formatWhen(l.createdAt),
      TempC: l.tempC,
      Humidity: l.humidity ?? "",
      Status: l.status,
      Note: l.note ?? "",
      CreatedBy: (user?.uid && l.createdBy === user.uid) ? (profile?.name || user.email || l.createdBy) : (l.createdBy || "—"),
      PhotoUrl: l.photoUrl ?? "",
      PhotoPath: l.photoPath ?? "",
    }));
  };

  const exportCSV = async () => {
    if (filtered.length === 0) return Alert.alert("No data", "No records to export.");

    const rows = buildRows();
    const headers = Object.keys(rows[0]);

    const csvEscape = (val: any) => {
      const s = val == null ? "" : String(val);
      const needs = s.includes(",") || s.includes('"') || s.includes("\n");
      const escaped = s.replace(/"/g, '""');
      return needs ? `"${escaped}"` : escaped;
    };

    const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape((r as any)[h])).join(","))];

    const filename = `TempReports_${Date.now()}.csv`;
    const uri = getWritableUri(filename);

    await writeAsStringAsync(uri, lines.join("\n"), { encoding: "utf8" as any });
    await safeShare(uri);
  };

  const exportPDF = async () => {
    if (filtered.length === 0) return Alert.alert("No data", "No records to export.");

    const meta = exportMeta();

    const css = `
      <style>
        body { font-family: -apple-system, Arial, sans-serif; padding: 18px; }
        h1 { font-size: 18px; margin: 0 0 2px 0; }
        .sub { color: #333; font-size: 12px; margin: 0 0 10px 0; }
        .meta { color: #666; font-size: 12px; margin-bottom: 12px; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 10.5px; vertical-align: top; }
        th { background: #f4f4f4; text-align: left; }
        .ok { color: #0284c7; font-weight: 700; }
        .warning { color: #b45309; font-weight: 700; }
        .damaged { color: #e11d48; font-weight: 700; }
        .small { color: #777; font-size: 10px; }
      </style>
    `;

    const rowsHtml = filtered
      .map((l) => {
        const cls = l.status === "ok" ? "ok" : l.status === "warning" ? "warning" : "damaged";
        return `
          <tr>
            <td>${escapeHtml(formatWhen(l.createdAt))}</td>
            <td>${escapeHtml(chillerName(l.chillerId))}</td>
            <td>${l.tempC}</td>
            <td>${l.humidity ?? ""}</td>
            <td class="${cls}">${String(l.status).toUpperCase()}</td>
            <td>${escapeHtml(l.note ?? "")}</td>
            <td>${escapeHtml(createdByName(l.createdBy))}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>${css}</head>
        <body>
          <h1>Temperature Report</h1>
          <div class="sub">Exported by: ${escapeHtml(meta.exporter)} • ${escapeHtml(meta.now)}</div>

          <div class="meta">
            <div><b>Branch:</b> ${escapeHtml(meta.branch)}</div>
            <div><b>Date Range:</b> ${escapeHtml(meta.range)}</div>
            <div><b>Status:</b> ${escapeHtml(meta.status)}</div>
            <div><b>Chiller:</b> ${escapeHtml(meta.chiller)}</div>
            <div><b>Records:</b> ${filtered.length}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>DateTime</th>
                <th>Chiller</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Status</th>
                <th>Note</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="small" style="margin-top: 10px;">
            Photos are stored in the app and exported in CSV as URLs/paths.
          </div>
        </body>
      </html>
    `;

    const file = await Print.printToFileAsync({ html });
    await safeShare(file.uri);
  };

  const ExportButton = ({
    title,
    subtitle,
    onPress,
    disabled,
    icon,
  }: {
    title: string;
    subtitle: string;
    onPress: () => void;
    disabled: boolean;
    icon: string;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: disabled ? "#334155" : C.good,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 54,
        opacity: pressed && !disabled ? 0.9 : 1,
      })}
    >
      <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12.5 }}>
        {icon} {title}
      </Text>
      <Text style={{ color: C.bg, fontSize: 11, marginTop: 2, opacity: 0.85 }}>{subtitle}</Text>
    </Pressable>
  );

  const PhotoThumb = ({ url }: { url: string }) => {
    const [err, setErr] = useState(false);
    if (!url) return null;

    return (
      <View style={{ marginTop: 8 }}>
        {err ? (
          <Text style={{ color: C.critical, fontSize: 12 }}>Photo failed to load. (Check storage rules/token)</Text>
        ) : (
          <Image
            source={{ uri: url }}
            style={{ width: "100%", height: 150, borderRadius: 14, backgroundColor: C.surface }}
            resizeMode="cover"
            onError={(e) => {
              console.log("IMAGE THUMB ERROR:", e?.nativeEvent);
              setErr(true);
            }}
          />
        )}
      </View>
    );
  };

  // LOADING
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return null;

  if (branchesLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // MAIN UI
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header / Filters */}
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Reports</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{String(profile?.name || user?.email || "—")}</Text>
        </View>

        <View style={{ gap: 10 }}>
          <FilterPill label="Branch" value={branchName} onPress={() => setSheet("branch")} />
          {/* ✅ calendar selector */}
          <FilterPill label="Date range" value={dateLabel} onPress={() => setDateModalOpen(true)} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FilterPill label="Status" value={statusLabel} onPress={() => setSheet("status")} />
            </View>

            <View style={{ flex: 1 }}>
              <FilterPill
                label="Chiller"
                value={selectedChillerId === "all" ? "ALL" : chillerName(selectedChillerId)}
                onPress={() => setSheet("chiller")}
                disabled={chillersLoading}
              />
            </View>
          </View>
        </View>

        {/* Summary */}
        <View
          style={{
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 16,
            padding: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 13 }}>{filtered.length} records</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Latest (max 500)</Text>
        </View>

        {/* Export */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ExportButton
            icon="🧾"
            title={exporting ? "Exporting..." : "Export PDF"}
            subtitle="Printable"
            onPress={() => runExport(exportPDF)}
            disabled={exporting}
          />
          <ExportButton
            icon="📄"
            title={exporting ? "Exporting..." : "Export CSV"}
            subtitle="Excel"
            onPress={() => runExport(exportCSV)}
            disabled={exporting}
          />
        </View>
      </View>

      {/* List */}
      {logsLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 28, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View
              style={{
                marginHorizontal: 16,
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.card,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
                  {chillerName(item.chillerId)}
                </Text>

                <Text style={{ color: statusColor(item.status), fontWeight: "900", fontSize: 12 }}>
                  {item.status === "damaged" ? "CRITICAL" : item.status === "warning" ? "WARNING" : "GOOD"}
                </Text>
              </View>

              <Text style={{ color: C.text, fontSize: 13 }}>
                {item.tempC}°C{item.humidity == null ? "" : `  •  ${item.humidity}%`}
              </Text>

              {!!item.note && (
                <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={3}>
                  Note: {item.note}
                </Text>
              )}

              <Text style={{ color: C.muted, fontSize: 12 }}>By: {createdByName(item.createdBy)}</Text>

              {item.status === "damaged" && !!item.photoUrl && <PhotoThumb url={item.photoUrl} />}

              {!!item.photoUrl && (
                <Pressable
                  onPress={() => router.push(`/(app)/logs/photo?url=${encodeURIComponent(String(item.photoUrl))}`)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    borderRadius: 14,
                    backgroundColor: C.surface,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: C.line,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>View Photo</Text>
                </Pressable>
              )}

              <Text style={{ color: C.muted, fontSize: 11 }}>{formatWhen(item.createdAt)}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>No records found</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>Try changing filters.</Text>
            </View>
          }
        />
      )}

      {/* Sheets */}
      <BottomSheetPicker
        open={sheet === "branch"}
        title="Select Branch"
        options={branches.map((b) => ({ key: b.id, label: b.name }))}
        selectedKey={selectedBranchId}
        onSelect={(key) => {
          setSelectedBranchId(key);
          setSelectedChillerId("all");
        }}
        onClose={() => setSheet(null)}
      />

      <BottomSheetPicker
        open={sheet === "status"}
        title="Select Status"
        options={[
          { key: "all", label: "All statuses" },
          { key: "ok", label: "Good (OK)" },
          { key: "warning", label: "Warning" },
          { key: "damaged", label: "Critical (Damaged)" },
        ]}
        selectedKey={statusFilter}
        onSelect={(key) => setStatusFilter(key as any)}
        onClose={() => setSheet(null)}
      />

      <BottomSheetPicker
        open={sheet === "chiller"}
        title="Select Chiller"
        options={[{ key: "all", label: "All chillers" }].concat(chillers.map((c) => ({ key: c.id, label: c.name })))}
        selectedKey={selectedChillerId}
        onSelect={(key) => setSelectedChillerId(key)}
        onClose={() => setSheet(null)}
      />

      {/* ✅ Calendar modal */}
      <CalendarRangeModal
        open={dateModalOpen}
        from={dateFrom}
        to={dateTo}
        onApply={(f, t) => {
          setDateFrom(f);
          setDateTo(t);
        }}
        onClose={() => setDateModalOpen(false)}
      />
    </View>
  );
}