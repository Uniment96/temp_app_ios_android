// app/(app)/dashboard/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";

// =====================
// Palette
// =====================
const COLORS = {
  bg: "#0F172A",
  card: "#F8FAFC",
  muted: "#94A3B8",
  grid: "#64748B",
  good: "#38BDF8",
  critical: "#F43F5E",
  border: "rgba(15,23,42,0.08)",
  shadow: "rgba(0,0,0,0.18)",
};

type Branch = {
  id: string;
  name: string;
  isActive: boolean;
  ownerId: string;
  createdAt?: any;
};

type LastReading = {
  tempC?: number;
  humidity?: number | null;
  status?: "ok" | "warning" | "damaged";
  at?: any;
};

type Chiller = {
  id: string;
  name: string;
  branchId: string;
  minTemp?: number | null;
  maxTemp?: number | null;
  isActive: boolean;
  ownerId: string;
  lastReading?: LastReading | null;
  createdAt?: any;
};

type PickerOption = { label: string; value: string };

export default function Dashboard() {
  const { user, loading } = useAuth();

  // Auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  const [refreshing, setRefreshing] = useState(false);

  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("all");

  const [chillersLoading, setChillersLoading] = useState(true);
  const [chillers, setChillers] = useState<Chiller[]>([]);

  // =====================
  // Animations
  // =====================
  const introY = useRef(new Animated.Value(14)).current;
  const introOpacity = useRef(new Animated.Value(0)).current;
  const criticalPulse = useRef(new Animated.Value(1)).current;

  const runIntro = () => {
    introY.setValue(14);
    introOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(introY, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(introOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  const runCriticalPulse = () => {
    criticalPulse.setValue(1);
    Animated.sequence([
      Animated.timing(criticalPulse, { toValue: 1.05, duration: 260, useNativeDriver: true }),
      Animated.timing(criticalPulse, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  // =====================
  // Load Branches (owner only)
  // =====================
  useEffect(() => {
    if (!user) return;

    setBranchesLoading(true);

    const q1 = query(
      collection(db, "branches"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q1,
      (snap) => {
        const data: Branch[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            name: v.name ?? "",
            isActive: v.isActive ?? true,
            ownerId: v.ownerId ?? "",
            createdAt: v.createdAt,
          };
        });

        const active = data.filter((b) => b.isActive);
        setBranches(active);
        setBranchesLoading(false);

        if (branchId !== "all" && !active.some((b) => b.id === branchId)) {
          setBranchId("all");
        }
      },
      (err) => {
        setBranchesLoading(false);
        console.log(err);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // =====================
  // Load Chillers (owner only, max 40)
  // =====================
  useEffect(() => {
    if (!user) return;

    setChillersLoading(true);

    const base = [
      where("ownerId", "==", user.uid),
      where("isActive", "==", true),
    ] as any[];

    const q2 =
      branchId === "all"
        ? query(collection(db, "chillers"), ...base, orderBy("createdAt", "desc"), limit(40))
        : query(
            collection(db, "chillers"),
            ...base,
            where("branchId", "==", branchId),
            orderBy("createdAt", "desc"),
            limit(40)
          );

    const unsub = onSnapshot(
      q2,
      (snap) => {
        const data: Chiller[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            name: v.name ?? "",
            branchId: v.branchId ?? "",
            minTemp: v.minTemp ?? null,
            maxTemp: v.maxTemp ?? null,
            isActive: v.isActive ?? true,
            ownerId: v.ownerId ?? "",
            lastReading: (v.lastReading ?? null) as LastReading | null,
            createdAt: v.createdAt,
          };
        });

        setChillers(data);
        setChillersLoading(false);
        runIntro();
      },
      (err) => {
        setChillersLoading(false);
        console.log(err);
      }
    );

    return () => unsub();
  }, [user, branchId]);

  // =====================
  // Derived UI values
  // =====================
  const branchOptions: PickerOption[] = useMemo(() => {
    return [
      { label: "All branches", value: "all" },
      ...branches.map((b) => ({ label: b.name, value: b.id })),
    ];
  }, [branches]);

  const selectedBranchLabel =
    branchOptions.find((o) => o.value === branchId)?.label || "Select branch";

  const counts = useMemo(() => {
    let ok = 0;
    let warning = 0;
    let damaged = 0;
    let noData = 0;

    for (const c of chillers) {
      const s = c.lastReading?.status;
      if (!s) noData++;
      else if (s === "ok") ok++;
      else if (s === "warning") warning++;
      else damaged++;
    }

    return { ok, warning, damaged, noData, total: chillers.length };
  }, [chillers]);

  useEffect(() => {
    if (counts.damaged > 0) runCriticalPulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.damaged]);

  const formatWhen = (ts: any) => {
    try {
      const d =
        ts?.toDate?.()
          ? ts.toDate()
          : ts instanceof Date
            ? ts
            : ts instanceof Timestamp
              ? ts.toDate()
              : null;
      if (!d) return "";
      return d.toLocaleString();
    } catch {
      return "";
    }
  };

  const statusDot = (s?: LastReading["status"]) => {
    if (s === "ok") return COLORS.good;
    if (s === "warning") return "#F59E0B";
    if (s === "damaged") return COLORS.critical;
    return COLORS.muted;
  };

  const statusLabel = (s?: LastReading["status"]) => {
    if (s === "ok") return "GOOD";
    if (s === "warning") return "WARNING";
    if (s === "damaged") return "CRITICAL";
    return "NO DATA";
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  // =====================
  // Loading Gate
  // =====================
  if (loading || (!user && !loading)) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.card} />
      </View>
    );
  }

  if (!user) return null;

  // =====================
  // UI
  // =====================
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: COLORS.card, fontSize: 22, fontWeight: "800" }}>Dashboard</Text>
            <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>
              Monitor + scan QR to log faster
            </Text>
          </View>

          {/* Small Scan button */}
          <Pressable
            onPress={() => router.push("/(app)/scan")}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: "rgba(248,250,252,0.10)",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: COLORS.card, fontWeight: "900", fontSize: 13 }}>📷 Scan</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <ModalPicker
            label="Branch"
            valueLabel={selectedBranchLabel}
            options={branchOptions}
            onSelect={(v) => setBranchId(v)}
          />

          <Pressable
            onPress={() => router.push("/(app)/logs")}
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 14,
              backgroundColor: "rgba(248,250,252,0.10)",
              paddingVertical: 14,
              paddingHorizontal: 14,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: COLORS.card, fontWeight: "900", fontSize: 13 }}>Logs</Text>
            <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>History & readings</Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <Animated.View
        style={{
          flex: 1,
          opacity: introOpacity,
          transform: [{ translateY: introY }],
        }}
      >
        {/* Summary Cards */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card>
              <Text style={styles.cardTitle}>Total chillers</Text>
              <Text style={styles.bigNumber}>{counts.total}</Text>
              <Text style={styles.smallMuted}>Max shown: 40</Text>
            </Card>

            <Animated.View style={{ flex: 1, transform: [{ scale: counts.damaged > 0 ? criticalPulse : 1 }] }}>
              <Card>
                <Text style={styles.cardTitle}>Critical</Text>
                <Text style={[styles.bigNumber, { color: counts.damaged > 0 ? COLORS.critical : "#111827" }]}>
                  {counts.damaged}
                </Text>
                <Text style={styles.smallMuted}>Needs action</Text>
              </Card>
            </Animated.View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card>
              <Text style={styles.cardTitle}>Good</Text>
              <Text style={[styles.bigNumber, { color: COLORS.good }]}>{counts.ok}</Text>
              <Text style={styles.smallMuted}>In range</Text>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Warning</Text>
              <Text style={[styles.bigNumber, { color: "#F59E0B" }]}>{counts.warning}</Text>
              <Text style={styles.smallMuted}>Out of range</Text>
            </Card>
          </View>
        </View>

        {/* List */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={{ color: COLORS.card, fontWeight: "900", fontSize: 16 }}>Chillers</Text>
          <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>
            Tap a chiller to view history, or scan QR to log faster.
          </Text>
        </View>

        {branchesLoading || chillersLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.card} />
          </View>
        ) : (
          <FlatList
            data={chillers}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.card} />}
            renderItem={({ item }) => {
              const lr = item.lastReading;
              const dot = statusDot(lr?.status);
              const label = statusLabel(lr?.status);

              return (
                <Pressable
                  onPress={() => router.push(`/(app)/logs/chiller/${item.id}`)}
                  style={({ pressed }) => ({
                    borderRadius: 16,
                    backgroundColor: COLORS.card,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    shadowColor: COLORS.shadow,
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 8 },
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 15.5, fontWeight: "900", color: "#0B1220", flex: 1 }} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: dot,
                          }}
                        />
                        <Text style={{ fontWeight: "900", color: "#0B1220", fontSize: 12 }}>{label}</Text>
                      </View>

                      {/* Small QR quick action */}
                      <Pressable
                        onPress={() => router.push("/(app)/scan")}
                        hitSlop={10}
                        style={({ pressed }) => ({
                          width: 30,
                          height: 30,
                          borderRadius: 10,
                          backgroundColor: "rgba(15,23,42,0.06)",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 13 }}>⌁</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#334155", fontWeight: "800", fontSize: 13 }}>
                      {lr?.tempC == null ? "—°C" : `${lr.tempC}°C`}
                      {lr?.humidity == null ? "" : `  •  ${lr.humidity}%`}
                    </Text>
                    <Text style={{ color: "#64748B", fontSize: 12 }}>
                      {lr?.at ? formatWhen(lr.at) : "No reading yet"}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <Pressable
                      onPress={() => router.push(`/(app)/logs/add?chillerId=${item.id}`)}
                      style={({ pressed }) => ({
                        flex: 1,
                        borderRadius: 12,
                        backgroundColor: "#0B1220",
                        paddingVertical: 11,
                        alignItems: "center",
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ color: COLORS.card, fontWeight: "900", fontSize: 13 }}>Add Reading</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/(app)/logs/chiller/${item.id}`)}
                      style={({ pressed }) => ({
                        flex: 1,
                        borderRadius: 12,
                        backgroundColor: "rgba(15,23,42,0.06)",
                        paddingVertical: 11,
                        alignItems: "center",
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 13 }}>History</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 44, alignItems: "center", gap: 8 }}>
                <Text style={{ color: COLORS.card, fontWeight: "900" }}>No chillers yet</Text>
                <Text style={{ color: COLORS.muted, textAlign: "center" }}>
                  Create a branch → add chillers → then you’ll see them here.
                </Text>

                <Pressable
                  onPress={() => router.push("/(app)/branches/new")}
                  style={({ pressed }) => ({
                    marginTop: 10,
                    borderRadius: 14,
                    backgroundColor: "rgba(248,250,252,0.10)",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: COLORS.card, fontWeight: "900" }}>+ Add Branch</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(app)/chillers/new")}
                  style={({ pressed }) => ({
                    borderRadius: 14,
                    backgroundColor: "#0B1220",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: COLORS.card, fontWeight: "900" }}>+ Add Chiller</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(app)/scan")}
                  style={({ pressed }) => ({
                    borderRadius: 14,
                    backgroundColor: "rgba(56,189,248,0.18)",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: COLORS.card, fontWeight: "900" }}>📷 Scan QR</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

// =====================
// iOS-native Modal Picker (no library)
// =====================
function ModalPicker({
  label,
  valueLabel,
  options,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 14,
          backgroundColor: "rgba(248,250,252,0.10)",
          paddingVertical: 14,
          paddingHorizontal: 14,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "800" }}>{label.toUpperCase()}</Text>
        <Text style={{ color: COLORS.card, fontWeight: "900", marginTop: 2 }} numberOfLines={1}>
          {valueLabel}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />

        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingTop: 10,
            paddingBottom: 18,
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 10 }}>
            <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: "#E2E8F0" }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: "#0B1220" }}>Select {label}</Text>
            <Text style={{ color: "#64748B", marginTop: 4, fontSize: 12 }}>Tap an option</Text>
          </View>

          <FlatList
            data={options}
            keyExtractor={(i) => i.value}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#EEF2F7" }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? "#F1F5F9" : "#fff",
                })}
              >
                <Text style={{ fontWeight: "900", color: "#0B1220" }}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#64748B" }}>No options available.</Text>
              </View>
            }
            style={{ maxHeight: 360 }}
          />

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Pressable
              onPress={() => setOpen(false)}
              style={({ pressed }) => ({
                borderRadius: 14,
                backgroundColor: "#0B1220",
                paddingVertical: 12,
                alignItems: "center",
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// =====================
// Reusable Card
// =====================
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.10,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      {children}
    </View>
  );
}

const styles = {
  cardTitle: {
    color: "#64748B",
    fontWeight: "900" as const,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  bigNumber: {
    color: "#0B1220",
    fontWeight: "900" as const,
    fontSize: 28,
    marginTop: 8,
  },
  smallMuted: {
    color: "#64748B",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700" as const,
  },
};