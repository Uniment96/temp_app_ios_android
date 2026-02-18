import React, { useMemo } from "react";
import { View, Text, Pressable, Alert, Share } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { buildChillerQrValue } from "../../../../src/utils/qr";

const C = {
  bg: "#0F172A",
  card: "#111827",
  line: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  good: "#38BDF8",
};

export default function ChillerQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chillerId = String(id || "");

  const value = useMemo(() => buildChillerQrValue(chillerId), [chillerId]);

  const onShare = async () => {
    try {
      await Share.share({
        message: value,
        title: "Chiller QR",
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Share failed");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 }}>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Chiller QR</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>
        Scan to open this chiller and add logs / view history.
      </Text>

      <View
        style={{
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
          padding: 16,
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 14 }}>
          <QRCode value={value} size={220} />
        </View>

        <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={2}>
          {value}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 6, width: "100%" }}>
          <Pressable
            onPress={onShare}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: C.good,
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: C.bg, fontWeight: "900", fontSize: 12 }}>Share</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.line,
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}