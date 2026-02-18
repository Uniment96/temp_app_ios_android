// app/(app)/logs/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";

type Branch = { id: string; name: string; isActive: boolean; ownerId: string };

type LastReading = {
  tempC?: number;
  humidity?: number | null;
  status?: "ok" | "warning" | "damaged";
  at?: any;
};

type Chiller = {
  id: string;
  ownerId: string;
  name: string;
  branchId: string;
  minTemp?: number | null;
  maxTemp?: number | null;
  isActive: boolean;
  lastReading?: LastReading | null;
};

const COLORS = {
  bg: "#0F172A",
  card: "#111827",
  border: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  muted2: "#64748B",
  good: "#38BDF8",
  bad: "#F43F5E",
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

function formatWhen(ts: any) {
  try {
    const d = ts?.toDate?.() ? ts.toDate() : null;
    return d ? d.toLocaleString() : "";
  } catch {
    return "";
  }
}

function statusColor(s?: LastReading["status"]) {
  if (s === "ok") return COLORS.good;
  if (s === "warning") return "#FBBF24";
  if (s === "damaged") return COLORS.bad;
  return COLORS.muted2;
}

function statusLabel(s?: LastReading["status"]) {
  if (s === "ok") return "GOOD";
  if (s === "warning") return "WARNING";
  if (s === "damaged") return "CRITICAL";
  return "NO DATA";
}

export default function LogsHome() {
  const { user, loading } = useAuth();

  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [chillersLoading, setChillersLoading] = useState(true);
  const [chillers, setChillers] = useState<Chiller[]>([]);

  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const anim = useRef(new Animated.Value(0)).current;

  // Auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [anim]);

  // -------------------------
  // Load branches (owner only) — no orderBy -> no index requirement
  // -------------------------
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
            name: v.name ?? "",
            isActive: v.isActive ?? true,
            ownerId: v.ownerId ?? "",
          };
        });

        const active = data.filter((b) => b.isActive);
        active.sort((a, b) => String(a.name).localeCompare(String(b.name)));

        setBranches(active);
        setBranchesLoading(false);

        // Auto-select / keep selection valid
        if (active.length === 0) {
          setSelectedBranchId("");
          return;
        }

        if (!selectedBranchId) {
          setSelectedBranchId(active[0].id);
          return;
        }

        if (!active.some((b) => b.id === selectedBranchId)) {
          setSelectedBranchId(active[0].id);
        }
      },
      (err) => {
        setBranchesLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // -------------------------
  // Load chillers for selected branch (owner only) — no orderBy -> no index
  // -------------------------
  useEffect(() => {
    if (!user) return;

    if (!selectedBranchId) {
      setChillers([]);
      setChillersLoading(false);
      return;
    }

    setChillersLoading(true);

    const q2 = query(
      collection(db, "chillers"),
      where("ownerId", "==", user.uid),
      where("branchId", "==", selectedBranchId)
    );

    const unsub = onSnapshot(
      q2,
      (snap) => {
        const data: Chiller[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            ownerId: v.ownerId ?? "",
            name: v.name ?? "",
            branchId: v.branchId ?? "",
            minTemp: v.minTemp ?? null,
            maxTemp: v.maxTemp ?? null,
            isActive: v.isActive ?? true,
            lastReading: (v.lastReading ?? null) as LastReading | null,
          };
        });

        const activeOnly = data.filter((c) => c.isActive);

        // Local sort: newest reading first
        activeOnly.sort((a, b) => safeTime(b.lastReading?.at) - safeTime(a.lastReading?.at));

        setChillers(activeOnly);
        setChillersLoading(false);
      },
      (err) => {
        setChillersLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    return () => unsub();
  }, [selectedBranchId, user]);

  const selectedBranchName = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId)?.name || "Select branch";
  }, [branches, selectedBranchId]);

  const onRefresh = async () => {
    // Snapshot is live, this is only UX
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  // -------------------------
  // Loading gates
  // -------------------------
  if (loading || branchesLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return null;

  // -------------------------
  // UI pieces
  // -------------------------
  const BranchPicker = () => (
    <Modal
      transparent
      visible={branchPickerOpen}
      animationType="slide"
      onRequestClose={() => setBranchPickerOpen(false)}
    >
      <Pressable onPress={() => setBranchPickerOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
      <View
        style={{
          backgroundColor: COLORS.card,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingBottom: Platform.OS === "ios" ? 24 : 16,
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
          <View
            style={{
              alignSelf: "center",
              width: 44,
              height: 5,
              borderRadius: 999,
              backgroundColor: "rgba(248,250,252,0.25)",
              marginBottom: 10,
            }}
          />
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 14 }}>Select Branch</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{branches.length} active branches</Text>
        </View>

        <FlatList
          data={branches}
          keyExtractor={(b) => b.id}
          style={{ maxHeight: 420 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.border }} />}
          renderItem={({ item }) => {
            const active = item.id === selectedBranchId;
            return (
              <Pressable
                onPress={() => {
                  setSelectedBranchId(item.id);
                  setBranchPickerOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: active ? "rgba(56,189,248,0.16)" : COLORS.card,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 13.5 }} numberOfLines={1}>
                  {item.name || "Unnamed"}
                </Text>
                {active && <Text style={{ color: COLORS.good, fontSize: 12, marginTop: 3, fontWeight: "700" }}>Selected</Text>}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 16 }}>
              <Text style={{ color: COLORS.text, fontWeight: "800" }}>No active branches</Text>
              <Text style={{ color: COLORS.muted, marginTop: 6, fontSize: 12 }}>Create a branch first.</Text>
              <Pressable
                onPress={() => {
                  setBranchPickerOpen(false);
                  router.push("/(app)/branches/new");
                }}
                style={({ pressed }) => ({
                  marginTop: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(56,189,248,0.18)",
                  borderWidth: 1,
                  borderColor: "rgba(56,189,248,0.35)",
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>+ Add Branch</Text>
              </Pressable>
            </View>
          }
        />
      </View>
    </Modal>
  );

  const Header = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>Logs</Text>

        <Pressable
          onPress={() => router.push("/(app)/scan")}
          style={({ pressed }) => ({
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: "rgba(56,189,248,0.18)",
            borderWidth: 1,
            borderColor: "rgba(56,189,248,0.35)",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12 }}>📷 Scan QR</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setBranchPickerOpen(true)}
        style={({ pressed }) => ({
          marginTop: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: COLORS.card,
          borderWidth: 1,
          borderColor: COLORS.border,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <Text style={{ color: COLORS.muted, fontSize: 11.5, fontWeight: "800" }}>BRANCH</Text>
        <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "900", marginTop: 3 }} numberOfLines={1}>
          {selectedBranchName}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>Chillers</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{chillers.length} active</Text>
      </View>
    </View>
  );

  const Card = ({ item }: { item: Chiller }) => {
    const lr = item.lastReading;

    const tempText = lr?.tempC == null ? "—" : `${lr.tempC}°C`;
    const humText = lr?.humidity == null ? "" : ` • ${lr.humidity}%`;
    const sColor = statusColor(lr?.status);

    return (
      <View
        style={{
          padding: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.card,
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.push(`/(app)/logs/chiller/${item.id}`)}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: COLORS.text, fontSize: 14.5, fontWeight: "900", flex: 1, paddingRight: 10 }} numberOfLines={1}>
              {item.name || "Unnamed"}
            </Text>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: sColor }} />
          </View>

          <Text style={{ marginTop: 6, color: COLORS.muted, fontSize: 12.5, fontWeight: "700" }}>
            Last: <Text style={{ color: COLORS.text, fontWeight: "900" }}>{tempText}</Text>
            <Text style={{ color: COLORS.muted }}>{humText}</Text>
          </Text>

          <Text style={{ marginTop: 4, color: sColor, fontWeight: "900", fontSize: 12 }}>
            {statusLabel(lr?.status)}
          </Text>

          {!!lr?.at && <Text style={{ marginTop: 4, color: COLORS.muted2, fontSize: 11.5 }}>{formatWhen(lr.at)}</Text>}
        </Pressable>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => router.push(`/(app)/logs/add?chillerId=${encodeURIComponent(item.id)}`)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: "rgba(56,189,248,0.18)",
              borderWidth: 1,
              borderColor: "rgba(56,189,248,0.35)",
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>Add Reading</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/(app)/logs/chiller/${encodeURIComponent(item.id)}`)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>History</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <BranchPicker />

      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}
      >
        <Header />

        {chillersLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={chillers}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: Platform.OS === "ios" ? 28 : 18,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text} />}
            renderItem={({ item }) => <Card item={item} />}
            ListEmptyComponent={
              <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
                <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>No chillers found</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: "center" }}>
                  Create chillers for this branch first.
                </Text>

                <Pressable
                  onPress={() => router.push("/(app)/chillers/new")}
                  style={({ pressed }) => ({
                    marginTop: 4,
                    borderRadius: 14,
                    backgroundColor: "#0B1220",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>+ Add Chiller</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}