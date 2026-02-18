import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";

const C = {
  bg: "#0F172A",
  card: "#111827",
  line: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  good: "#38BDF8",
  danger: "#FB7185",
};

type Chiller = {
  id: string;
  ownerId: string;
  name: string;
  branchId?: string;
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

export default function ChillersList() {
  const { user, loading } = useAuth();
  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState<Chiller[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;

    setListLoading(true);

    const q1 = query(collection(db, "chillers"), where("ownerId", "==", user.uid));

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

  const onDelete = (chiller: Chiller) => {
    Alert.alert(
      "Delete chiller?",
      `This will delete "${chiller.name}" permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // ✅ Option A: Hard delete
              await deleteDoc(doc(db, "chillers", chiller.id));

              // ✅ Option B (recommended): Soft delete
              // await updateDoc(doc(db, "chillers", chiller.id), { isActive: false });

            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to delete");
            }
          },
        },
      ]
    );
  };

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
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Chillers</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{count} active</Text>
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
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.line,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "900", fontSize: 14 }}>{item.name}</Text>
                  {!!item.branchId ? (
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Branch: {item.branchId}</Text>
                  ) : null}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => router.push(`/(app)/chillers/${item.id}`)}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: C.line,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => onDelete(item)}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(251,113,133,0.35)",
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text style={{ color: C.danger, fontWeight: "900", fontSize: 12 }}>Delete</Text>
                  </Pressable>
                </View>
              </View>

              {/* Open details/history */}
              <Pressable
                onPress={() => router.push(`/(app)/logs/chiller/[${item.id}]`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Text style={{ color: C.good, fontWeight: "900", fontSize: 12 }}>Open logs →</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>No chillers yet</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>Create a chiller first.</Text>
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