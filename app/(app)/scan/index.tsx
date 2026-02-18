// app/(app)/scan/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { Camera, CameraView, BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { parseChillerIdFromQr } from "../../../src/utils/qr";

const C = {
  bg: "#0F172A",
  card: "#111827",
  line: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  good: "#38BDF8",
};

export default function ScanQr() {
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [scanned, setScanned] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const requestPermission = async () => {
    try {
      setRequesting(true);
      const { status } = await Camera.requestCameraPermissionsAsync();
      const ok = status === "granted";
      setHasPermission(ok);
      return ok;
    } finally {
      setRequesting(false);
    }
  };

  useEffect(() => {
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvalid = () => {
    setScanned(true);
    Alert.alert("Invalid QR", "This QR is not a chiller QR.", [
      { text: "Scan again", onPress: () => setScanned(false) },
    ]);
  };

  const onScan = (res: BarcodeScanningResult) => {
    if (scanned) return;

    const raw = String(res?.data ?? "").trim();
    const chillerId = parseChillerIdFromQr(raw);

    if (!chillerId) {
      handleInvalid();
      return;
    }

    setScanned(true);

    Alert.alert("Chiller found", "What do you want to do?", [
      { text: "Cancel", style: "cancel", onPress: () => setScanned(false) },
      {
        text: "Add Reading",
        onPress: () => {
          setTimeout(() => {
            router.replace(`/(app)/logs/add?chillerId=${encodeURIComponent(chillerId)}`);
          }, 50);
        },
      },
      {
        text: "View History",
        onPress: () => {
          setTimeout(() => {
            router.replace(`/(app)/logs/chiller/${encodeURIComponent(chillerId)}`);
          }, 50);
        },
      },
    ]);
  };

  if (hasPermission === null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>
          Requesting camera permission…
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Scan QR</Text>
        <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18 }}>
          Camera permission is required to scan QR codes.
          {Platform.OS === "ios" ? " If you denied it once, enable it from Settings." : ""}
        </Text>

        <Pressable
          disabled={requesting}
          onPress={async () => {
            const ok = await requestPermission();
            if (!ok) {
              Alert.alert("Permission required", "Enable Camera permission in Settings.", [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]);
            } else {
              setScanned(false);
            }
          }}
          style={({ pressed }) => ({
            backgroundColor: C.good,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            opacity: requesting ? 0.7 : pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>
            {requesting ? "Requesting…" : "Enable Camera"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => ({
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.line,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, gap: 6 }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Scan QR</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          Scan a chiller QR to add a reading or view history.
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          margin: 16,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: C.line,
          backgroundColor: C.card,
        }}
      >
        <CameraView
          style={{ flex: 1 }}
          onBarcodeScanned={scanned ? undefined : onScan}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
      </View>

      <View style={{ padding: 16, flexDirection: "row", gap: 12 }}>
        <Pressable
          onPress={() => setScanned(false)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: C.good,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>
            {scanned ? "Scan again" : "Ready to scan"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert(
              "Note",
              Platform.OS === "ios"
                ? "iOS Simulator camera scanning may not work. Use a real iPhone for scanning."
                : "Hold the camera steady over the QR code."
            );
          }}
          style={({ pressed }) => ({
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.line,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            paddingHorizontal: 14,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Help</Text>
        </Pressable>
      </View>
    </View>
  );
}