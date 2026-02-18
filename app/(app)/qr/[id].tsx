// app/(app)/qr/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { db } from "../../../src/firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Clipboard from "expo-clipboard"; // ✅ add: npx expo install expo-clipboard

const FS = FileSystem as any;

const C = {
  bg: "#0F172A",
  surface: "#0B1220",
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
};

function buildChillerQrValue(chillerId: string) {
  return `temp-monitor://chiller/${chillerId}`;
}

function safeNameForFile(name: string) {
  return (name || "chiller")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 48);
}

function getWritableBaseDirOrNull(): string | null {
  const docDir = typeof FS?.documentDirectory === "string" ? FS.documentDirectory : null;
  const cacheDir = typeof FS?.cacheDirectory === "string" ? FS.cacheDirectory : null;
  return cacheDir || docDir || null;
}

export default function QrDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chillerId = String(id || "");

  const { user, loading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [chiller, setChiller] = useState<Chiller | null>(null);

  const qrRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [loading, user]);

  useEffect(() => {
    const run = async () => {
      if (!user || !chillerId) return;

      try {
        setPageLoading(true);

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
          isActive: v.isActive ?? true,
        });
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load chiller");
      } finally {
        setPageLoading(false);
      }
    };

    run();
  }, [user, chillerId]);

  const qrValue = useMemo(() => buildChillerQrValue(chillerId), [chillerId]);

  const exportPngToFileOrThrow = async () => {
    const node = qrRef.current;
    if (!node?.toDataURL) throw new Error("QR export not available (missing toDataURL).");

    const base64Png: string = await new Promise((resolve, reject) => {
      try {
        node.toDataURL((data: string) => resolve(data));
      } catch (e) {
        reject(e);
      }
    });

    const base = getWritableBaseDirOrNull();
    if (!base) throw new Error("NO_WRITABLE_DIR");

    const filenameSafe = safeNameForFile(chiller?.name || "chiller");
    const uri = `${base}QR_${filenameSafe}_${Date.now()}.png`;

    const encoding = FS?.EncodingType?.Base64 ?? ("base64" as any);
    await FileSystem.writeAsStringAsync(uri, base64Png, { encoding });

    return uri;
  };

  const shareLinkFallback = async () => {
    // ✅ Always works (simulator too)
    await Clipboard.setStringAsync(qrValue);
    Alert.alert("Copied", "QR link copied. You can paste it in WhatsApp or anywhere.");
  };

  const onShare = async () => {
    if (busy || !chiller) return;

    setBusy(true);
    try {
      // If Sharing isn't available, still allow copy-to-clipboard
      const canShare = await Sharing.isAvailableAsync().catch(() => false);

      // Try PNG first (real devices). Simulator often fails here.
      try {
        const uri = await exportPngToFileOrThrow();
        if (!canShare) {
          Alert.alert("Saved", `QR image created at:\n${uri}`);
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share QR",
          UTI: "public.png",
        } as any);
        return;
      } catch (e: any) {
        if (String(e?.message || e) === "NO_WRITABLE_DIR") {
          // ✅ Simulator fallback
          await shareLinkFallback();
          return;
        }
        // other png export errors -> fallback to link
        await shareLinkFallback();
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const onOpenHistory = () =>
    router.push({ pathname: "/(app)/logs/chiller/[id]", params: { id: chillerId } } as any);

  const onAddLog = () =>
    router.push({ pathname: "/(app)/logs/add", params: { chillerId } } as any);

  if (loading || pageLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user || !chiller) return null;

  const writable = getWritableBaseDirOrNull();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Chiller QR</Text>
        <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={2}>
          {chiller.name || "Unnamed"} • scan to open history / add log
        </Text>
      </View>

      <View
        style={{
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
          padding: 14,
          gap: 12,
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <QRCode value={qrValue} size={220} quietZone={12} getRef={(c: any) => (qrRef.current = c)} />
        </View>

        <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={2}>
          {qrValue}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onOpenHistory}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.line,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>History</Text>
          </Pressable>

          <Pressable
            onPress={onAddLog}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: C.good,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>Add Log</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onShare}
          disabled={busy}
          style={({ pressed }) => ({
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: busy ? "#334155" : C.good,
            alignItems: "center",
            opacity: pressed && !busy ? 0.9 : 1,
          })}
        >
          <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>
            {busy ? "Preparing…" : writable ? "Share / Download QR (PNG)" : "Copy QR link (Simulator)"}
          </Text>
        </Pressable>

        {Platform.OS === "ios" && !writable && (
          <Text style={{ color: C.muted, fontSize: 11, lineHeight: 16 }}>
            iOS Simulator sometimes has no writable storage for file export. Use a real iPhone for PNG sharing.
          </Text>
        )}
      </View>
    </View>
  );
}