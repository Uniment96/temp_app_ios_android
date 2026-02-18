// app/(app)/logs/photo.tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";

function normalizeFirebaseStorageUrl(input: string) {
  try {
    const raw = String(input || "").trim();
    if (!raw) return "";

    // If it's already correct (has /o/<encoded path>), keep it
    if (raw.includes("/v0/b/") && raw.includes("/o/") && raw.includes("%2F")) {
      return raw;
    }

    // Split query
    const [base, query = ""] = raw.split("?");
    const m = base.match(/^(https:\/\/[^/]+\/v0\/b\/[^/]+\/o\/)(.+)$/);
    if (!m) return raw;

    const prefix = m[1];
    const objectPart = m[2]; // may contain raw slashes

    // Encode object part safely (convert / -> %2F etc.)
    // Important: objectPart may already have some encoding. Normalize by decoding then encoding.
    const decoded = decodeURIComponent(objectPart);
    const encodedObject = encodeURIComponent(decoded);

    return query ? `${prefix}${encodedObject}?${query}` : `${prefix}${encodedObject}`;
  } catch {
    return String(input || "").trim();
  }
}

export default function PhotoScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  const uri = useMemo(() => {
    // IMPORTANT:
    // - expo-router often already decodes query params
    // - do not decode again here; just normalize encoding for the object path
    const raw = String(url || "");
    return normalizeFirebaseStorageUrl(raw);
  }, [url]);

  const showSpinner = loading && !!uri;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Back</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {!!uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
              setErrMsg("");
            }}
            onLoad={() => {
              // some RN builds only fire onLoad without onLoadEnd reliably
              setLoading(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              const status =
                (e as any)?.nativeEvent?.statusCode ??
                (e as any)?.nativeEvent?.status ??
                "unknown";
              const msg =
                e?.nativeEvent?.error ||
                `Failed to load image (status: ${String(status)})`;
              console.log("IMAGE ERROR:", e?.nativeEvent);
              setErrMsg(String(msg));
              setFailed(true);
              setLoading(false);
            }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              Missing photo URL
            </Text>
            <Text style={{ color: "#bbb", marginTop: 6, textAlign: "center" }}>
              This log does not contain a valid photoUrl.
            </Text>
          </View>
        )}

        {showSpinner && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {failed && (
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              top: 100,
              padding: 12,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              Failed to load image
            </Text>

            <Text style={{ color: "#bbb", marginTop: 6 }}>
              {errMsg || "The URL may be invalid or access is blocked."}
            </Text>

            <Text style={{ color: "#bbb", marginTop: 10 }}>
              If it still fails after normalization, it’s usually one of these:
              {"\n"}• token missing/expired (download URL token)
              {"\n"}• storage rules deny access
              {"\n"}• object path is wrong (file not present)
            </Text>

            <Text style={{ color: "#888", marginTop: 10, fontSize: 12 }}>
              URI: {uri}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}