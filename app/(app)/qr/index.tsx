// app/(app)/qr/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";

const C = {
  bg: "#0F172A",
  card: "#111827",
  line: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  good: "#38BDF8",
};

type Chiller = {
  id: string;
  ownerId: string;
  name: string;
  branchId: string;
  isActive: boolean;
  createdAt?: any;
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

export default function GetQrHome() {
  const { user, loading } = useAuth();
  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState<Chiller[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;

    setListLoading(true);

    const q1 = query(
      collection(db, "chillers"),
      where("ownerId", "==", user.uid)
      // no orderBy to avoid index requirement; sort locally
    );

    const unsub = onSnapshot(
      q1,
      (snap) => {
        const data = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            ownerId: v.ownerId ?? "",
            name: v.name ?? "Unnamed",
            branchId: v.branchId ?? "",
            isActive: v.isActive ?? true,
            createdAt: v.createdAt,
          } as Chiller;
        });

        data.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
        setItems(data.filter((x) => x.isActive));
        setListLoading(false);
      },
      (err) => {
        setListLoading(false);
        Alert.alert("Error", err.message || "Failed to load chillers");
      }
    );

    return () => unsub();
  }, [user]);

  const count = useMemo(() => items.length, [items]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Get QR</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>Select a chiller to generate its QR • {count} active</Text>
      </View>

      {listLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/qr/${item.id}`)}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 16,
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.line,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Tap to generate QR →</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>No chillers yet</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>Create a chiller first, then generate QR.</Text>
              <Pressable
                onPress={() => router.push("/(app)/chillers/new")}
                style={({ pressed }) => ({
                  marginTop: 10,
                  backgroundColor: C.good,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>+ Add Chiller</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}