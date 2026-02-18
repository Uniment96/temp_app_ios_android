import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Animated,
  Platform,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../../../src/context/AuthContext";
import { auth, db } from "../../../src/firebase/firebaseConfig";

type Branch = { id: string; name: string; isActive: boolean; ownerId: string };

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

function SheetPicker<T extends { id: string }>(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  items: T[];
  selectedId: string;
  getLabel: (item: T) => string;
  onSelect: (id: string) => void;
  extraTopItem?: { id: string; label: string }; // e.g. "None"
}) {
  const { title, open, onClose, items, selectedId, getLabel, onSelect, extraTopItem } = props;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: COLORS.border,
          maxHeight: "70%",
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 14, borderBottomWidth: 1, borderColor: COLORS.border }}>
          <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 11.5, marginTop: 2 }}>
            Tap to select
          </Text>
        </View>

        <FlatList
          data={extraTopItem ? ([{ id: extraTopItem.id } as any, ...items] as any[]) : items}
          keyExtractor={(i: any) => String(i.id)}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COLORS.border }} />}
          renderItem={({ item }: any) => {
            const isExtra = extraTopItem && item.id === extraTopItem.id;
            const label = isExtra ? extraTopItem!.label : getLabel(item);
            const active = item.id === selectedId;

            return (
              <Pressable
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: active ? "#0B1220" : COLORS.card,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                    {label}
                  </Text>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: active ? COLORS.good : "transparent",
                      borderWidth: active ? 0 : 1,
                      borderColor: COLORS.border,
                    }}
                  />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 16 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>
                No items found.
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

export default function SettingsPage() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);

  // Branches for default branch picker
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

  // Local editable name (optional)
  const [nameDraft, setNameDraft] = useState("");

  const anim = useRef(new Animated.Value(0)).current;

  // auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [anim]);

  useEffect(() => {
    setNameDraft(profile?.name ?? "");
  }, [profile?.name]);

  // Load branches (no orderBy => no composite index)
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        setBranchesLoading(true);
        const q1 = query(collection(db, "branches"), where("ownerId", "==", user.uid));
        const snap = await getDocs(q1);

        const data: Branch[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            name: v.name ?? "",
            isActive: v.isActive ?? true,
            ownerId: v.ownerId ?? "",
          };
        });

        // local sort by name for a clean picker
        data.sort((a, b) => a.name.localeCompare(b.name));
        setBranches(data.filter((b) => b.isActive));
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load branches");
      } finally {
        setBranchesLoading(false);
      }
    };

    run();
  }, [user]);

  const defaultBranchName = useMemo(() => {
    const id = profile?.defaultBranchId || "";
    if (!id) return "None";
    return branches.find((b) => b.id === id)?.name || "Unknown";
  }, [branches, profile?.defaultBranchId]);

  const saveProfile = async (patch: Partial<{ name: string; defaultBranchId: string | null }>) => {
    if (!user) return;
    try {
      setSaving(true);
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        ...patch,
        updatedAt: new Date(), // okay for UI; can use serverTimestamp() too if you prefer
      } as any);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onSaveName = async () => {
    const clean = nameDraft.trim();
    if (!clean) return Alert.alert("Validation", "Name is required.");
    await saveProfile({ name: clean });
  };

  const onPickDefaultBranch = async (branchId: string) => {
    if (branchId === "__none__") return saveProfile({ defaultBranchId: null });
    return saveProfile({ defaultBranchId: branchId });
  };

  const onLogout = async () => {
    Alert.alert("Sign out?", "You will need to login again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/(auth)/login");
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to sign out");
          }
        },
      },
    ]);
  };

  if (loading) {
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
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>Settings</Text>
          <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>
            Account • Defaults • Shortcuts
          </Text>
        </View>

        {/* Account card */}
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
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "800" }}>Account</Text>

          <View style={{ gap: 6 }}>
            <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>Email</Text>
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
              {user.email || "—"}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>Name</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
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
          </View>

          <Pressable
            onPress={onSaveName}
            disabled={saving}
            style={({ pressed }) => ({
              paddingVertical: 11,
              borderRadius: 14,
              backgroundColor: "#0B1220",
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              opacity: saving ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>Save Name</Text>
            )}
          </Pressable>
        </View>

        {/* Defaults card */}
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
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "800" }}>Defaults</Text>

          <Pressable
            onPress={() => setBranchPickerOpen(true)}
            disabled={branchesLoading}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: "#0B1220",
              borderWidth: 1,
              borderColor: COLORS.border,
              opacity: branchesLoading ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>Default Branch</Text>
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "900", marginTop: 4 }}>
              {branchesLoading ? "Loading…" : defaultBranchName}
            </Text>
            <Text style={{ color: COLORS.muted2, fontSize: 11.5, marginTop: 2 }}>
              Tap to choose
            </Text>
          </Pressable>

          <Text style={{ color: COLORS.muted, fontSize: 11.5 }}>
            This branch will be pre-selected on dashboard/logs.
          </Text>
        </View>

        {/* Shortcuts card */}
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
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "800" }}>Shortcuts</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => router.push("/(app)/branches")}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 11,
                borderRadius: 14,
                backgroundColor: "#0B1220",
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>Branches</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(app)/chillers")}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 11,
                borderRadius: 14,
                backgroundColor: "#0B1220",
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>Chillers</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/(app)/reports")}
            style={({ pressed }) => ({
              paddingVertical: 11,
              borderRadius: 14,
              backgroundColor: "#0B1220",
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 12.5 }}>Reports</Text>
          </Pressable>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => ({
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: "#2A1220",
            borderWidth: 1,
            borderColor: "#3B1325",
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: COLORS.bad, fontWeight: "900", fontSize: 13 }}>Sign out</Text>
        </Pressable>
      </Animated.View>

      {/* Bottom sheet branch picker */}
      <SheetPicker
        title="Default Branch"
        open={branchPickerOpen}
        onClose={() => setBranchPickerOpen(false)}
        items={branches}
        selectedId={profile?.defaultBranchId || "__none__"}
        getLabel={(b) => b.name || "Unnamed"}
        onSelect={onPickDefaultBranch}
        extraTopItem={{ id: "__none__", label: "None" }}
      />
    </View>
  );
}