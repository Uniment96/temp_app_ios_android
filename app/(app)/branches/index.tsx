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
import { Link, router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";

type Branch = {
  id: string;
  name: string;
  isActive: boolean;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
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

export default function BranchesList() {
  const { user, loading } = useAuth();

  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState<Branch[]>([]);

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

  useEffect(() => {
    if (!user) return;

    // ✅ No orderBy => no composite index requirement.
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
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
          };
        });

        // ✅ Local sort: newest first (works even if some docs miss createdAt)
        data.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));

        setItems(data);
        setListLoading(false);
      },
      (err) => {
        setListLoading(false);
        Alert.alert("Error", err.message || "Failed to load branches");
      }
    );

    return () => unsub();
  }, [user]);

  const activeCount = useMemo(() => items.filter((b) => b.isActive).length, [items]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return null;

  const Header = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>Branches</Text>
          <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>
            {activeCount} active • {items.length} total
          </Text>
        </View>

        <Link href="/(app)/branches/new" asChild>
          <Pressable
            style={({ pressed }) => ({
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: COLORS.card,
              borderWidth: 1,
              borderColor: COLORS.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>+ Add</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );

  const Card = ({ item }: { item: Branch }) => {
    const statusText = item.isActive ? "Active" : "Inactive";
    const dotColor = item.isActive ? COLORS.good : COLORS.muted2;

    return (
      <Pressable
        onPress={() => router.push(`/(app)/branches/${item.id}`)}
        style={({ pressed }) => ({
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.card,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text
            style={{ color: COLORS.text, fontSize: 14.5, fontWeight: "900", flex: 1, paddingRight: 10 }}
            numberOfLines={1}
          >
            {item.name || "Unnamed"}
          </Text>

          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dotColor }} />
        </View>

        <Text style={{ marginTop: 6, color: item.isActive ? COLORS.good : COLORS.muted2, fontSize: 12.5, fontWeight: "800" }}>
          {statusText}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted2, fontSize: 11.5 }}>
          Tap to edit →
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        }}
      >
        <Header />

        {listLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: Platform.OS === "ios" ? 28 : 18,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => <Card item={item} />}
            ListEmptyComponent={
              <View style={{ paddingVertical: 40, alignItems: "center", gap: 6 }}>
                <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>No branches yet</Text>
                <Text style={{ color: COLORS.muted, fontSize: 12 }}>
                  Tap “Add” to create your first branch.
                </Text>
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}