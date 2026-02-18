import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

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

export default function BranchEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = useMemo(() => id === "new", [id]);

  const { user, loading } = useAuth();

  const [pageLoading, setPageLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

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

  // load branch (edit)
  useEffect(() => {
    const run = async () => {
      if (!user || isNew) return;

      try {
        setPageLoading(true);

        const ref = doc(db, "branches", String(id));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert("Not found", "This branch does not exist.");
          router.back();
          return;
        }

        const v = snap.data() as any;

        // If ownerId exists and it's not you -> deny
        if (v.ownerId && v.ownerId !== user.uid) {
          Alert.alert("Access denied", "This branch is not yours.");
          router.back();
          return;
        }

        setName(v.name ?? "");
        setIsActive(v.isActive ?? true);
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load branch");
      } finally {
        setPageLoading(false);
      }
    };

    run();
  }, [id, isNew, user]);

  const onSave = async () => {
    if (!user) return;

    const clean = name.trim();
    if (!clean) return Alert.alert("Validation", "Branch name is required.");

    try {
      setSaving(true);

      if (isNew) {
        const ref = doc(db, "branches", randomId());
        await setDoc(ref, {
          ownerId: user.uid,
          name: clean,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const ref = doc(db, "branches", String(id));
        await updateDoc(ref, {
          // ✅ migrate old docs by setting ownerId on update
          ownerId: user.uid,
          name: clean,
          isActive,
          updatedAt: serverTimestamp(),
        });
      }

      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!user || isNew) return;

    Alert.alert("Delete branch?", "This will remove the branch.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await deleteDoc(doc(db, "branches", String(id)));
            router.replace("/(app)/branches");
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to delete");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading || pageLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Animated.View
        style={{
          flex: 1,
          padding: 16,
          gap: 12,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>
            {isNew ? "Add Branch" : "Edit Branch"}
          </Text>
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>
            {isNew ? "Create a branch for grouping chillers." : "Update branch details."}
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: COLORS.card,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 16,
            padding: 14,
            gap: 10,
          }}
        >
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "800" }}>Branch Name</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Main Kitchen"
            placeholderTextColor={COLORS.muted2}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingVertical: Platform.OS === "ios" ? 10 : 9,
              paddingHorizontal: 12,
              borderRadius: 14,
              color: COLORS.text,
              backgroundColor: "#0B1220",
              fontSize: 13.5,
              fontWeight: "700",
            }}
          />

          {!isNew && (
            <View
              style={{
                marginTop: 2,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "900" }}>Active</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>
                  Inactive branches are hidden in pickers.
                </Text>
              </View>
              <Switch value={isActive} onValueChange={setIsActive} />
            </View>
          )}
        </View>

        {/* Save */}
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => ({
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: COLORS.card,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>
              Save
            </Text>
          )}
        </Pressable>

        {/* Delete */}
        {!isNew && (
          <Pressable
            onPress={onDelete}
            disabled={saving}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: "#2A1220",
              borderWidth: 1,
              borderColor: "#3B1325",
              alignItems: "center",
              opacity: saving ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.bad, fontWeight: "900", fontSize: 13 }}>
              Delete Branch
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

function randomId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}