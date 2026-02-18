// app/(app)/_layout.tsx
import React from "react";
import { Drawer } from "expo-router/drawer";
import { View, Text, Pressable } from "react-native";
import { usePathname, router } from "expo-router";
import type { Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  bg: "#0F172A",
  card: "#111827",
  border: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  activeBg: "rgba(56,189,248,0.18)",
  activeBorder: "rgba(56,189,248,0.35)",
  activeIcon: "#38BDF8",
};

type NavItem = {
  label: string;
  href: Href;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/(app)/dashboard", route: "/dashboard", icon: "grid-outline" },
  { label: "Scan QR", href: "/(app)/scan", route: "/scan", icon: "qr-code-outline" },
  { label: "Logs", href: "/(app)/logs", route: "/logs", icon: "time-outline" },
  { label: "Reports", href: "/(app)/reports", route: "/reports", icon: "document-text-outline" },
  { label: "Branches", href: "/(app)/branches", route: "/branches", icon: "business-outline" },
  { label: "Chillers", href: "/(app)/chillers", route: "/chillers", icon: "snow-outline" },
  { label: "QR", href: "/(app)/qr", route: "/qr", icon: "barcode-outline" },
  { label: "Settings", href: "/(app)/settings", route: "/settings", icon: "settings-outline" },
];

function CustomDrawerContent() {
  const pathname = usePathname() || "";

  const isActive = (route: string) =>
    pathname === route ||
    pathname.startsWith(`${route}/`) ||
    pathname.includes(`/(app)${route}`);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: 54 }}>
      <View style={{ paddingHorizontal: 18, gap: 6 }}>
        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "800" }}>Temp Monitor</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>Chiller temperature logging</Text>
      </View>

      <View style={{ marginTop: 14, paddingHorizontal: 12 }}>
        {ITEMS.map((it) => {
          const active = isActive(it.route);
          const iconColor = active ? COLORS.activeIcon : COLORS.muted;

          return (
            <Pressable
              key={it.route}
              onPress={() => router.replace(it.href)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 16,
                marginBottom: 10,
                backgroundColor: active ? COLORS.activeBg : "transparent",
                borderWidth: active ? 1 : 0,
                borderColor: active ? COLORS.activeBorder : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name={it.icon} size={18} color={iconColor} />
              <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: 14 }}>
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <Text style={{ color: COLORS.muted, fontSize: 12, paddingHorizontal: 18, paddingBottom: 18 }}>
        v1.0
      </Text>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        drawerStyle: { backgroundColor: COLORS.bg, width: 310 },
      }}
      drawerContent={() => <CustomDrawerContent />}
    >
      {/* Visible routes */}
      <Drawer.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Drawer.Screen name="scan/index" options={{ title: "Scan QR" }} />
      <Drawer.Screen name="logs/index" options={{ title: "Logs" }} />
      <Drawer.Screen name="reports/index" options={{ title: "Reports" }} />
      <Drawer.Screen name="branches/index" options={{ title: "Branches" }} />
      <Drawer.Screen name="chillers/index" options={{ title: "Chillers" }} />
      <Drawer.Screen name="qr/index" options={{ title: "QR" }} />
      <Drawer.Screen name="settings/index" options={{ title: "Settings" }} />

      {/* Hidden routes */}
      <Drawer.Screen name="logs/add" options={{ drawerItemStyle: { display: "none" }, title: "Add Reading" }} />
      <Drawer.Screen name="logs/photo" options={{ drawerItemStyle: { display: "none" }, title: "Photo" }} />
      <Drawer.Screen name="logs/chiller/[id]" options={{ drawerItemStyle: { display: "none" }, title: "Chiller Logs" }} />
      <Drawer.Screen name="branches/[id]" options={{ drawerItemStyle: { display: "none" }, title: "Branch" }} />
      <Drawer.Screen name="chillers/[id]" options={{ drawerItemStyle: { display: "none" }, title: "Chiller" }} />
      <Drawer.Screen name="qr/[id]" options={{ drawerItemStyle: { display: "none" }, title: "Chiller QR" }} />
      <Drawer.Screen name="chillers/(id)/qr" options={{ drawerItemStyle: { display: "none" }, title: "Chiller QR" }} />
    </Drawer>
  );
}