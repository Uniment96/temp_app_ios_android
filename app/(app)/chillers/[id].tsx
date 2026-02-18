// app/(app)/chillers/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  Platform,
  Animated,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { db } from "../../../src/firebase/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import TempKeypad from "../../../src/components/TempKeypad";

type Branch = {
  id: string;
  name: string;
  isActive: boolean;
  ownerId: string;
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

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: COLORS.card,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingBottom: Platform.OS === "ios" ? 24 : 14,
          }}
        >
          <View style={{ padding: 14, gap: 8 }}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: COLORS.border,
                }}
              />
            </View>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "900" }}>{title}</Text>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  title,
  selected,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: pressed ? "#0B1220" : COLORS.card,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      })}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: COLORS.text, fontSize: 13.5, fontWeight: "800" }} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text style={{ color: selected ? COLORS.good : COLORS.muted2, fontSize: 13, fontWeight: "900" }}>
        {selected ? "✓" : ""}
      </Text>
    </Pressable>
  );
}

function parseNumberOrNull(val: string) {
  const t = String(val ?? "").trim();
  if (!t) return null;
  const normalized = t.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

export default function ChillerEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chillerId = String(id || "");
  const isNew = useMemo(() => chillerId === "new", [chillerId]);

  const { user, loading } = useAuth();

  const [pageLoading, setPageLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [minTemp, setMinTemp] = useState<string>("");
  const [maxTemp, setMaxTemp] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSheet, setBranchSheet] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [activeField, setActiveField] = useState<"min" | "max" | null>(null);

  // safer delete confirmation
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const anim = useRef(new Animated.Value(0)).current;

  // auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [anim]);

  // branches live
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
            createdAt: v.createdAt,
          };
        });

        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        const active = data.filter((b) => b.isActive);

        setBranches(active);

        // keep branchId valid
        setBranchId((prev) => {
          if (!prev) return active[0]?.id ?? "";
          if (!active.some((b) => b.id === prev)) return active[0]?.id ?? "";
          return prev;
        });

        setBranchesLoading(false);
      },
      (err) => {
        setBranchesLoading(false);
        Alert.alert("Error", err.message);
      }
    );

    return () => unsub();
  }, [user]);

  // chiller live when editing
  useEffect(() => {
    if (!user || isNew) {
      setPageLoading(false);
      return;
    }

    setPageLoading(true);

    const ref = doc(db, "chillers", chillerId);

    // first do a quick getDoc for ownership validation (fast + clear errors)
    (async () => {
      try {
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          Alert.alert("Not found", "This chiller does not exist.");
          router.back();
          return;
        }

        const v = snap.data() as any;

        if (v.ownerId !== user.uid) {
          Alert.alert("Access denied", "This chiller is not yours.");
          router.back();
          return;
        }

        // now subscribe for live updates
        const unsub = onSnapshot(
          ref,
          (liveSnap) => {
            const x = liveSnap.data() as any;
            if (!x) return;

            setName(x.name ?? "");
            setBranchId(x.branchId ?? "");
            setMinTemp(x.minTemp == null ? "" : String(x.minTemp));
            setMaxTemp(x.maxTemp == null ? "" : String(x.maxTemp));
            setIsActive(x.isActive ?? true);

            setPageLoading(false);
          },
          (err) => {
            setPageLoading(false);
            Alert.alert("Error", err.message || "Failed to load chiller");
          }
        );

        // cleanup
        return unsub;
      } catch (e: any) {
        setPageLoading(false);
        Alert.alert("Error", e?.message || "Failed to load chiller");
      }
    })();
  }, [user, isNew, chillerId]);

  const branchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "Select branch";
  }, [branches, branchId]);

  const canSave = useMemo(() => {
    if (!user) return false;
    if (saving) return false;
    if (branchesLoading) return false;
    if (branches.length === 0) return false;
    if (!name.trim()) return false;
    if (!branchId) return false;
    const min = parseNumberOrNull(minTemp);
    const max = parseNumberOrNull(maxTemp);
    if (Number.isNaN(min) || Number.isNaN(max)) return false;
    if (min != null && max != null && min > max) return false;
    return true;
  }, [user, saving, branchesLoading, branches.length, name, branchId, minTemp, maxTemp]);

  const onSave = async () => {
    if (!user) return;

    const clean = name.trim();
    if (!clean) return Alert.alert("Validation", "Chiller name is required.");
    if (!branchId) return Alert.alert("Validation", "Please select a branch.");
    if (branches.length === 0) return Alert.alert("Branches required", "Create a branch first.");

    const min = parseNumberOrNull(minTemp);
    const max = parseNumberOrNull(maxTemp);

    if (Number.isNaN(min) || Number.isNaN(max)) {
      return Alert.alert("Validation", "Min/Max temperature must be a number.");
    }
    if (min != null && max != null && min > max) {
      return Alert.alert("Validation", "Min temperature cannot be greater than Max temperature.");
    }

    try {
      setSaving(true);

      if (isNew) {
        // ✅ Firestore generates the ID
        await addDoc(collection(db, "chillers"), {
          ownerId: user.uid,
          name: clean,
          branchId,
          minTemp: min,
          maxTemp: max,
          isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "chillers", chillerId), {
          name: clean,
          branchId,
          minTemp: min,
          maxTemp: max,
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

  const confirmDelete = () => {
    setDeleteText("");
    setDeleteSheet(true);
  };

  const onDelete = async () => {
    if (!user || isNew) return;

    if (deleteText.trim().toUpperCase() !== "DELETE") {
      Alert.alert("Type DELETE", 'Please type "DELETE" to confirm.');
      return;
    }

    try {
      setSaving(true);
      await deleteDoc(doc(db, "chillers", chillerId));
      setDeleteSheet(false);
      router.replace("/(app)/chillers");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}>
        <Animated.View
          style={{
            gap: 12,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "900" }}>
            {isNew ? "Add Chiller" : "Edit Chiller"}
          </Text>

          {/* Name */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: COLORS.muted, fontWeight: "800", fontSize: 12 }}>Chiller Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Chiller 01 – Dairy"
              placeholderTextColor={COLORS.muted2}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.card,
                color: COLORS.text,
                padding: 12,
                borderRadius: 14,
                fontSize: 13,
              }}
            />
          </View>

          {/* Branch */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: COLORS.muted, fontWeight: "800", fontSize: 12 }}>Branch</Text>

            <Pressable
              onPress={() => {
                setActiveField(null);
                setBranchSheet(true);
              }}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.card,
                padding: 12,
                borderRadius: 14,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
                {branchName}
              </Text>

              {branchesLoading ? (
                <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>Loading branches…</Text>
              ) : branches.length === 0 ? (
                <Text style={{ color: COLORS.bad, marginTop: 2, fontSize: 12 }}>No branches found. Create one first.</Text>
              ) : (
                <Text style={{ color: COLORS.muted, marginTop: 2, fontSize: 12 }}>Tap to choose</Text>
              )}
            </Pressable>
          </View>

          {/* Temps */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: COLORS.muted, fontWeight: "800", fontSize: 12 }}>
              Allowed Temperature Range (°C)
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setActiveField("min")}
                style={({ pressed }) => ({
                  flex: 1,
                  borderWidth: 1,
                  borderColor: activeField === "min" ? "rgba(56,189,248,0.7)" : COLORS.border,
                  backgroundColor: COLORS.card,
                  borderRadius: 14,
                  padding: 12,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "900" }}>MIN</Text>
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900", marginTop: 6 }}>
                  {minTemp || "—"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveField("max")}
                style={({ pressed }) => ({
                  flex: 1,
                  borderWidth: 1,
                  borderColor: activeField === "max" ? "rgba(56,189,248,0.7)" : COLORS.border,
                  backgroundColor: COLORS.card,
                  borderRadius: 14,
                  padding: 12,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "900" }}>MAX</Text>
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900", marginTop: 6 }}>
                  {maxTemp || "—"}
                </Text>
              </Pressable>
            </View>

            <Text style={{ color: COLORS.muted, fontSize: 12 }}>
              Leave blank if you don’t want alerts yet.
            </Text>
          </View>

          {/* Active */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.card,
              padding: 12,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 13 }}>Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>

          {/* Save */}
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => ({
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: !canSave ? "#0B1220" : COLORS.card,
              borderWidth: 1,
              borderColor: !canSave ? "rgba(31,41,55,0.7)" : COLORS.border,
              alignItems: "center",
              opacity: pressed && canSave ? 0.85 : 1,
              marginTop: 4,
            })}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: canSave ? COLORS.text : COLORS.muted2, fontWeight: "900", fontSize: 13 }}>
                Save
              </Text>
            )}
          </Pressable>

          {/* Delete */}
          {!isNew && (
            <Pressable
              onPress={confirmDelete}
              disabled={saving}
              style={({ pressed }) => ({
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: "rgba(244,63,94,0.10)",
                borderWidth: 1,
                borderColor: "rgba(244,63,94,0.35)",
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: COLORS.bad, fontWeight: "900", fontSize: 13 }}>Delete Chiller</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* keypad */}
      {activeField && (
        <TempKeypad
          value={activeField === "min" ? minTemp : maxTemp}
          onChange={(next) => {
            if (activeField === "min") setMinTemp(next);
            else setMaxTemp(next);
          }}
          onDone={() => setActiveField(null)}
        />
      )}

      {/* branch sheet */}
      <Sheet visible={branchSheet} title="Select Branch" onClose={() => setBranchSheet(false)}>
        {branchesLoading ? (
          <View style={{ padding: 14 }}>
            <Text style={{ color: COLORS.muted }}>Loading…</Text>
          </View>
        ) : branches.length === 0 ? (
          <View style={{ padding: 14 }}>
            <Text style={{ color: COLORS.muted }}>No active branches.</Text>
          </View>
        ) : (
          branches.map((b) => (
            <Row
              key={b.id}
              title={b.name || "Unnamed"}
              subtitle="Active"
              selected={b.id === branchId}
              onPress={() => {
                setBranchId(b.id);
                setBranchSheet(false);
              }}
            />
          ))
        )}
      </Sheet>

      {/* delete sheet */}
      <Sheet visible={deleteSheet} title='Type "DELETE" to confirm' onClose={() => setDeleteSheet(false)}>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>
            This permanently deletes the chiller. It won’t remove old logs unless you delete them separately.
          </Text>

          <TextInput
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="characters"
            placeholder="DELETE"
            placeholderTextColor={COLORS.muted2}
            style={{
              borderWidth: 1,
              borderColor: "rgba(244,63,94,0.35)",
              backgroundColor: COLORS.card,
              color: COLORS.text,
              padding: 12,
              borderRadius: 14,
              fontSize: 13,
            }}
          />

          <Pressable
            onPress={onDelete}
            disabled={saving || deleteText.trim().toUpperCase() !== "DELETE"}
            style={({ pressed }) => ({
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor:
                deleteText.trim().toUpperCase() !== "DELETE" || saving
                  ? "rgba(244,63,94,0.08)"
                  : "rgba(244,63,94,0.18)",
              borderWidth: 1,
              borderColor: "rgba(244,63,94,0.35)",
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: COLORS.bad, fontWeight: "900", fontSize: 13 }}>Confirm Delete</Text>
            )}
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}