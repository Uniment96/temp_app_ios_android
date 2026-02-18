// app/(app)/logs/add.tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../../src/context/AuthContext";
import { db, storage } from "../../../src/firebase/firebaseConfig"; // ✅ use shared storage instance
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import TempKeypad from "../../../src/components/TempKeypad";

type Chiller = {
  id: string;
  ownerId: string;
  name: string;
  branchId: string;
  minTemp?: number | null;
  maxTemp?: number | null;
};

type Status = "ok" | "warning" | "damaged";

const C = {
  bg: "#ffffff",
  text: "#0B1220",
  muted: "#64748B",
  line: "#E5E7EB",
  black: "#111827",
  danger: "#F43F5E",
  good: "#38BDF8",
};

function parseNumber(val: string): number | null | "nan" {
  const t = String(val ?? "").trim();
  if (!t) return null;
  if (t === "-" || t === "." || t === "-.") return "nan";
  const normalized = t.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return "nan";
  return n;
}

export default function AddLog() {
  const { chillerId } = useLocalSearchParams<{ chillerId: string }>();
  const cid = String(chillerId || "");

  const { user, loading } = useAuth();

  const [screenLoading, setScreenLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [chiller, setChiller] = useState<Chiller | null>(null);

  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [status, setStatus] = useState<Status>("ok");
  const [note, setNote] = useState("");

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [activeField, setActiveField] = useState<"temp" | "humidity" | null>(null);

  const noteRef = useRef<TextInput>(null);

  // auth gate
  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  // Load chiller (verify owner)
  useEffect(() => {
    const run = async () => {
      if (!user) return;

      if (!cid) {
        Alert.alert("Error", "Missing chillerId");
        router.back();
        return;
      }

      try {
        setScreenLoading(true);

        const snap = await getDoc(doc(db, "chillers", cid));
        if (!snap.exists()) {
          Alert.alert("Error", "Chiller not found");
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
          ownerId: v.ownerId,
          name: v.name ?? "",
          branchId: v.branchId ?? "",
          minTemp: v.minTemp ?? null,
          maxTemp: v.maxTemp ?? null,
        });
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load chiller");
      } finally {
        setScreenLoading(false);
      }
    };

    run();
  }, [cid, user]);

  // Auto-warning based on range (unless damaged)
  useEffect(() => {
    if (!chiller) return;

    const t = parseNumber(tempC);
    if (t === null || t === "nan") return;
    if (status === "damaged") return;

    const min = chiller.minTemp;
    const max = chiller.maxTemp;

    if (min == null && max == null) {
      setStatus("ok");
      return;
    }

    const isLow = min != null && t < min;
    const isHigh = max != null && t > max;

    setStatus(isLow || isHigh ? "warning" : "ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempC, chiller]);

  const warningReasonHint = useMemo(() => {
    if (!chiller) return "";
    const min = chiller.minTemp;
    const max = chiller.maxTemp;
    if (min == null && max == null) return "";
    return `Allowed range: ${min ?? "—"}°C to ${max ?? "—"}°C`;
  }, [chiller]);

  // Pick photo (uri only)
  const pickOrTakePhoto = async () => {
    try {
      Alert.alert("Photo", "Choose option", [
        {
          text: "Take Photo",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert("Permission needed", "Camera permission is required.");
              return;
            }

            const res = await ImagePicker.launchCameraAsync({
              quality: 0.75,
              allowsEditing: true,
            });

            if (!res.canceled) {
              const asset = res.assets?.[0];
              setPhotoUri(asset?.uri ?? null);
            }
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert("Permission needed", "Gallery permission is required.");
              return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
              quality: 0.75,
              allowsEditing: true,
            });

            if (!res.canceled) {
              const asset = res.assets?.[0];
              setPhotoUri(asset?.uri ?? null);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to pick photo");
    }
  };

  // ✅ Upload photo to Firebase Storage (shared storage instance)
  const uploadPhotoIfNeeded = async () => {
    if (!photoUri || !user || !chiller) {
      return { photoUrl: null as string | null, photoPath: null as string | null };
    }

    try {
      setPhotoUploading(true);

      const photoPath = `tempLogs/${chiller.id}/${user.uid}/${Date.now()}.jpg`;

      // fetch uri -> blob
      const blob = await (await fetch(photoUri)).blob();

      const storageRef = ref(storage, photoPath);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

      const photoUrl = await getDownloadURL(storageRef);
      return { photoUrl, photoPath };
    } catch (e: any) {
      console.log("UPLOAD ERROR:", e);
      Alert.alert("Upload failed", e?.message || "Could not upload photo.");
      return { photoUrl: null, photoPath: null };
    } finally {
      setPhotoUploading(false);
    }
  };

  const onSave = async () => {
    if (!user || !chiller) return;

    Keyboard.dismiss();
    setActiveField(null);

    const t = parseNumber(tempC);
    if (t === null || t === "nan") {
      return Alert.alert("Validation", "Temperature is required and must be a number.");
    }

    const h = parseNumber(humidity);
    if (h === "nan") {
      return Alert.alert("Validation", "Humidity must be a number.");
    }

    if ((status === "warning" || status === "damaged") && !note.trim()) {
      return Alert.alert("Validation", "Note is required for Warning/Damaged.");
    }

    if (status === "damaged" && !photoUri) {
      return Alert.alert("Validation", "Photo is required when status is Damaged.");
    }

    try {
      setSaving(true);

      const { photoUrl, photoPath } = await uploadPhotoIfNeeded();

      // 1) create temp log
      await addDoc(collection(db, "tempLogs"), {
        ownerId: user.uid,
        chillerId: chiller.id,
        branchId: chiller.branchId,
        tempC: t,
        humidity: h ?? null,
        status,
        note: note.trim(),
        photoUrl: photoUrl ?? null,
        photoPath: photoPath ?? null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // 2) update chiller lastReading
      await updateDoc(doc(db, "chillers", chiller.id), {
        lastReading: {
          tempC: t,
          humidity: h ?? null,
          status,
          note: note.trim(),
          at: serverTimestamp(),
          by: user.uid,
          photoUrl: photoUrl ?? null,
          photoPath: photoPath ?? null,
        },
        updatedAt: serverTimestamp(),
      });

      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save log");
    } finally {
      setSaving(false);
    }
  };

  // UI
  if (loading || screenLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user || !chiller) return null;

  const submittingDisabled = saving || photoUploading;

  const FieldBox = ({
    label,
    value,
    placeholder,
    active,
    onPress,
    hint,
  }: {
    label: string;
    value: string;
    placeholder: string;
    active: boolean;
    onPress: () => void;
    hint?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: active ? "rgba(56,189,248,0.55)" : C.line,
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#fff",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Text style={{ fontWeight: "900", color: C.text, fontSize: 12 }}>{label}</Text>
      <Text style={{ marginTop: 6, fontWeight: "900", color: C.text, fontSize: 18 }}>
        {value || <Text style={{ color: "#9CA3AF" }}>{placeholder}</Text>}
      </Text>
      {!!hint && <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{hint}</Text>}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          setActiveField(null);
        }}
        accessible={false}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: activeField ? 6 : 18, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontSize: 20, fontWeight: "900", color: C.text }}>Add Reading</Text>
            <Text style={{ color: C.muted, fontWeight: "800" }}>{chiller.name}</Text>

            {/* ✅ Temperature + Humidity using custom keypad */}
            <FieldBox
              label="Temperature (°C) *"
              value={tempC}
              placeholder="Tap to enter"
              active={activeField === "temp"}
              hint={warningReasonHint || undefined}
              onPress={() => {
                Keyboard.dismiss();
                setActiveField("temp");
              }}
            />

            <FieldBox
              label="Humidity (%)"
              value={humidity}
              placeholder="Tap to enter"
              active={activeField === "humidity"}
              onPress={() => {
                Keyboard.dismiss();
                setActiveField("humidity");
              }}
            />

            <View style={{ gap: 10 }}>
              <Text style={{ fontWeight: "800", color: C.text }}>Status</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Chip label="OK" active={status === "ok"} onPress={() => setStatus("ok")} />
                <Chip label="Warning" active={status === "warning"} onPress={() => setStatus("warning")} />
                <Chip label="Damaged" active={status === "damaged"} onPress={() => setStatus("damaged")} />
              </View>

              {status === "warning" && <Text style={{ color: "#B45309", fontWeight: "800", fontSize: 12 }}>Out of range.</Text>}
              {status === "damaged" && (
                <Text style={{ color: C.danger, fontWeight: "900", fontSize: 12 }}>
                  Damaged requires a note + photo.
                </Text>
              )}
            </View>

            {status === "damaged" && (
              <View style={{ gap: 10 }}>
                <Text style={{ fontWeight: "800", color: C.text }}>Damage Photo *</Text>

                <Pressable
                  onPress={pickOrTakePhoto}
                  disabled={photoUploading}
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: C.line,
                    backgroundColor: "#fff",
                    opacity: photoUploading ? 0.6 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ fontWeight: "900", color: C.text }}>{photoUri ? "Change Photo" : "Add Photo"}</Text>
                  <Text style={{ color: C.muted, marginTop: 2, fontSize: 12 }}>Use camera or gallery</Text>
                </Pressable>

                {photoUri && (
                  <Image source={{ uri: photoUri }} style={{ width: "100%", height: 220, borderRadius: 14 }} resizeMode="cover" />
                )}

                {photoUploading && <Text style={{ color: C.muted, fontSize: 12 }}>Uploading photo…</Text>}

                {photoUri && (
                  <Pressable
                    onPress={() => setPhotoUri(null)}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: "#FFE4E6",
                      alignItems: "center",
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Text style={{ color: "#9F1239", fontWeight: "900" }}>Remove Photo</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: "800", color: C.text }}>
                Note {status === "warning" || status === "damaged" ? "*" : ""}
              </Text>
              <TextInput
                ref={noteRef}
                value={note}
                onChangeText={setNote}
                placeholder={
                  status === "warning"
                    ? "Reason (door open, loading, etc.)"
                    : status === "damaged"
                      ? "Describe the damage..."
                      : "Optional note"
                }
                placeholderTextColor="#9CA3AF"
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={onSave}
                style={{
                  borderWidth: 1,
                  borderColor: C.line,
                  padding: 12,
                  borderRadius: 12,
                  minHeight: 100,
                  textAlignVertical: "top",
                  color: C.text,
                }}
              />
            </View>

            <Pressable
              onPress={onSave}
              disabled={submittingDisabled}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 14,
                backgroundColor: submittingDisabled ? "#9CA3AF" : C.black,
                alignItems: "center",
                marginTop: 6,
                opacity: pressed && !submittingDisabled ? 0.92 : 1,
              })}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900" }}>Save</Text>}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#EEF2F7",
                alignItems: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ fontWeight: "900", color: C.text }}>Cancel</Text>
            </Pressable>
          </ScrollView>

          {/* ✅ Keypad pinned at bottom */}
          {activeField && (
            <TempKeypad
              value={activeField === "temp" ? tempC : humidity}
              mode={activeField === "temp" ? "signed-decimal" : "unsigned-decimal"} // ✅ humidity no minus
              onChange={(next) => {
                if (activeField === "temp") setTempC(next);
                else setHumidity(next);
              }}
              onDone={() => setActiveField(null)}
            />
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "#111827" : "#E5E7EB",
        backgroundColor: active ? "#111827" : "#fff",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Text style={{ color: active ? "#fff" : "#111827", fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}