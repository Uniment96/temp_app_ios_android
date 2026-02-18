import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.sub}>The route you opened doesn’t exist.</Text>

      <Pressable style={styles.btn} onPress={() => router.replace("/")}>
        <Text style={styles.btnText}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "800" },
  sub: { marginTop: 8, color: "#666", textAlign: "center" },
  btn: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#111" },
  btnText: { color: "#fff", fontWeight: "800" },
});