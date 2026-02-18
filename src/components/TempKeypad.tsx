// src/components/TempKeypad.tsx
import React, { useMemo } from "react";
import { Pressable, Text, View, Platform } from "react-native";

type Mode = "signed-decimal" | "unsigned-decimal";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onDone: () => void;
  mode?: Mode; // ✅ add this
};

function normalizeInput(raw: string, mode: Mode) {
  // Keep digits, optional leading "-", and single "."
  let s = String(raw ?? "").replace(/,/g, "."); // allow comma
  s = s.replace(/[^0-9\-.]/g, "");

  const allowMinus = mode === "signed-decimal";

  // handle minus: only leading and only if allowed
  const startsMinus = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (allowMinus && startsMinus) s = "-" + s;

  // handle dot: only one
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");

  return s;
}

function appendChar(current: string, ch: string, mode: Mode) {
  const cur = String(current ?? "");

  if (ch === "±") {
    if (mode !== "signed-decimal") return cur; // ignore
    if (!cur) return "-";
    if (cur.startsWith("-")) return cur.slice(1);
    return "-" + cur;
  }

  if (ch === ".") {
    if (!cur) return "0.";
    if (cur.includes(".")) return cur;
    return cur + ".";
  }

  // digit
  if (/^\d$/.test(ch)) {
    // prevent "-0" weirdness? keep simple
    return cur + ch;
  }

  return cur;
}

function backspace(current: string) {
  const cur = String(current ?? "");
  if (!cur) return "";
  return cur.slice(0, -1);
}

export default function TempKeypad({ value, onChange, onDone, mode = "signed-decimal" }: Props) {
  const keys = useMemo(() => {
    // 3x4 keypad + action row (like iOS)
    // We keep "-" via ± toggle button (better UX) and "." always.
    // For unsigned mode, ± is hidden.
    const base = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      [mode === "signed-decimal" ? "±" : "", "0", "."],
    ];
    return base;
  }, [mode]);

  const Key = ({
    label,
    onPress,
    danger,
    wide,
  }: {
    label: string;
    onPress: () => void;
    danger?: boolean;
    wide?: boolean;
  }) => {
    if (!label) return <View style={{ flex: 1 }} />; // placeholder for unsigned mode
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flex: wide ? 2 : 1,
          height: 52,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: danger ? "#FEE2E2" : "#F3F4F6",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: danger ? "#9F1239" : "#111827" }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        padding: 12,
        paddingBottom: Platform.OS === "ios" ? 22 : 12,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        backgroundColor: "#fff",
      }}
    >
      {/* Key grid */}
      <View style={{ gap: 10 }}>
        {keys.map((row, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 10 }}>
            {row.map((k) => (
              <Key
                key={k || `empty-${i}`}
                label={k}
                onPress={() => {
                  const next = appendChar(value, k, mode);
                  onChange(normalizeInput(next, mode));
                }}
              />
            ))}
          </View>
        ))}

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          <Key
            label="⌫"
            danger
            onPress={() => onChange(normalizeInput(backspace(value), mode))}
          />
          <Key
            label="Done"
            wide
            onPress={onDone}
          />
        </View>
      </View>
    </View>
  );
}