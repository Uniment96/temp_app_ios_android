// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <>
        <Stack screenOptions={{ headerShown: false }} />
        <Toast />
      </>
    </AuthProvider>
  );
}