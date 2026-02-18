import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../../src/context/AuthContext";
import { db } from "../../../../src/firebase/firebaseConfig";
import { doc, getDoc, collection, onSnapshot, query, where, limit } from "firebase/firestore";

type Chiller = {
  id: string;
  ownerId: string;
  name: string;
  branchId: string;
  minTemp?: number | null;
  maxTemp?: number | null;
  isActive: boolean;
};

type TempLog = {
  id: string;
  ownerId: string;
  chillerId?: string;
  tempC: number;
  humidity?: number | null;
  status: "ok" | "warning" | "damaged";
  note?: string;
  photoUrl?: string | null;
  createdBy: string;
  createdAt?: any;
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

export default function ChillerLogsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chillerId = String(id);

  const { user, loading } = useAuth();

  const [loadingChiller, setLoadingChiller] = useState(true);
  const [chiller, setChiller] = useState<Chiller | null>(null);

  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logs, setLogs] = useState<TempLog[]>([]);

  const anim = useRef(new Animated.Value(0)).current;

  // auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  // Load chiller (validate owner)
  useEffect(() => {
    const run = async () => {
      if (!user) return;

      try {
        setLoadingChiller(true);

        const ref = doc(db, "chillers", chillerId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert("Not found", "Chiller not found.");
          router.back();
          return;
        }

        const v = snap.data() as any;

        if (v.ownerId !== user.uid) {
          Alert.alert("Access denied", "This chiller is not yours.");
          router.back();
          return;
        }

        setChiller({
          id: snap.id,
          ownerId: v.ownerId ?? "",
          name: v.name ?? "",
          branchId: v.branchId ?? "",
          minTemp: v.minTemp ?? null,
          maxTemp: v.maxTemp ?? null,
          isActive: v.isActive ?? true,
        });
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load chiller");
      } finally {
        setLoadingChiller(false);
      }
    };

    run();
  }, [chillerId, user]);

  // Load logs (no orderBy => avoid composite index). Sort locally.
  useEffect(() => {
    if (!user) return;

    const q1 = query(
      collection(db, "tempLogs"),
      where("ownerId", "==", user.uid),
      where("chillerId", "==", chillerId),
      limit(200),
    );

    const unsub = onSnapshot(
      q1,
      (snap) => {
        const data: TempLog[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            ownerId: v.ownerId ?? "",
            chillerId: v.chillerId ?? "",
            tempC: Number(v.tempC ?? 0),
            humidity: v.humidity ?? null,
            status: v.status ?? "ok",
            note: v.note ?? "",
            photoUrl: v.photoUrl ?? null,
            createdBy: v.createdBy ?? "",
            createdAt: v.createdAt,
          };
        });

        data.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));

        setLogs(data);
        setLoadingLogs(false);
      },
      (err) => {
        setLoadingLogs(false);
        Alert.alert("Error", err.message);
      },
    );

    return () => unsub();
  }, [chillerId, user]);

  const rangeText = useMemo(() => {
    if (!chiller) return "";
    const min = chiller.minTemp;
    const max = chiller.maxTemp;
    if (min == null && max == null) return "No range set";
    return `Range: ${min ?? "—"}°C to ${max ?? "—"}°C`;
  }, [chiller]);

  const formatWhen = (ts: any) => {
    try {
      const d = ts?.toDate?.() ? ts.toDate() : null;
      return d ? d.toLocaleString() : "";
    } catch {
      return "";
    }
  };

  const statusColor = (s: TempLog["status"]) =>
    s === "ok" ? COLORS.good : s === "warning" ? "#FBBF24" : COLORS.bad;

  if (loadingChiller || loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user || !chiller) return null;

  const Header = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
        {chiller.name || "Chiller"}
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{rangeText}</Text>

      <Pressable
        onPress={() => router.push(`/(app)/logs/add?chillerId=${chiller.id}`)}
        style={({ pressed }) => ({
          marginTop: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: COLORS.card,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>+ Add Reading</Text>
      </Pressable>

      <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 12, fontWeight: "800" }}>
        Recent readings
      </Text>
    </View>
  );

  const Row = ({ item }: { item: TempLog }) => {
    const url = typeof item.photoUrl === "string" ? item.photoUrl : "";
    const color = statusColor(item.status);

    return (
      <View
        style={{
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.card,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: COLORS.text, fontSize: 14.5, fontWeight: "900" }}>
            {item.tempC}°C
            {item.humidity == null ? "" : `  •  ${item.humidity}%`}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
            <Text style={{ color, fontWeight: "900", fontSize: 12 }}>
              {String(item.status).toUpperCase()}
            </Text>
          </View>
        </View>

        {!!item.note && (
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>
            Note: {item.note}
          </Text>
        )}

        {!!url && (
          <Pressable
            onPress={() => router.push(`/(app)/logs/photo?url=${encodeURIComponent(url)}`)}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: "#0B1220",
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12 }}>
              View Photo
            </Text>
          </Pressable>
        )}

        <Text style={{ color: COLORS.muted2, fontSize: 11.5 }}>{formatWhen(item.createdAt)}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}
      >
        <Header />

        {loadingLogs ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 28 : 18 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => <Row item={item} />}
            ListEmptyComponent={
              <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
                <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>
                  No readings yet
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>
                  Tap “Add Reading” to log the first one.
                </Text>
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}