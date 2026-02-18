// app/(auth)/signup.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
  Animated,
} from "react-native";
import { Link, router } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";

const C = {
  bgTop: "#0B1220",
  bgMid: "#0F172A",
  bgBottom: "#0A1020",
  card: "rgba(17,24,39,0.78)",
  line: "rgba(148,163,184,0.18)",
  lineStrong: "rgba(56,189,248,0.20)",
  text: "#F8FAFC",
  muted: "#94A3B8",
  good: "#38BDF8",
  goodDark: "#0B1220",
  danger: "#FB7185",
  ok: "#34D399",
};

function friendlyAuthError(e: any) {
  const code = String(e?.code || "");
  if (code.includes("auth/invalid-email")) return "Enter a valid email.";
  if (code.includes("auth/email-already-in-use")) return "Email already in use. Try logging in.";
  if (code.includes("auth/weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("auth/network-request-failed")) return "Network error. Check your internet.";
  return e?.message || "Signup failed. Try again.";
}

// Simple email regex (good enough for UI validation)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/** Lightweight toast (no libs) */
function Toast({
  visible,
  text,
  type = "ok",
}: {
  visible: boolean;
  text: string;
  type?: "ok" | "error";
}) {
  if (!visible) return null;
  const bg = type === "ok" ? "rgba(52,211,153,0.16)" : "rgba(251,113,133,0.16)";
  const border = type === "ok" ? "rgba(52,211,153,0.35)" : "rgba(251,113,133,0.35)";
  const color = type === "ok" ? C.ok : C.danger;

  return (
    <View style={[styles.toast, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.toastDot, { backgroundColor: color }]} />
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
}

/** Graph/grid overlay + a faint “temperature line” using Views */
function GraphBackdrop() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* subtle gradient-ish layers */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.bgMid }]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(2,6,23,0.35)" }]} />

      {/* grid */}
      <View style={styles.grid}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={`v-${i}`} style={styles.gridV} />
        ))}
      </View>
      <View style={styles.gridHWrap}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={`h-${i}`} style={styles.gridH} />
        ))}
      </View>

      {/* faint “temperature line” path (stylized) */}
      <View style={styles.lineWrap}>
        <View style={[styles.seg, { width: 42, transform: [{ rotate: "-12deg" }] }]} />
        <View style={[styles.seg, { width: 58, transform: [{ rotate: "14deg" }] }]} />
        <View style={[styles.seg, { width: 46, transform: [{ rotate: "-18deg" }] }]} />
        <View style={[styles.seg, { width: 70, transform: [{ rotate: "10deg" }] }]} />
        <View style={[styles.seg, { width: 52, transform: [{ rotate: "-8deg" }] }]} />
      </View>

      {/* vignette */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.15)" }]} />
    </View>
  );
}

export default function SignupScreen() {
  const { ensureProfile } = useAuth();

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);

  // toast
  const [toastText, setToastText] = useState("");
  const [toastType, setToastType] = useState<"ok" | "error">("ok");
  const [toastVisible, setToastVisible] = useState(false);

  const nameTrimmed = useMemo(() => name.trim(), [name]);
  const emailTrimmed = useMemo(() => email.trim(), [email]);

  const showToast = (text: string, type: "ok" | "error" = "ok") => {
    setToastText(text);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // Auto focus name on mount
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const validate = () => {
    if (!nameTrimmed) return "Please enter your name.";
    if (!emailTrimmed) return "Please enter your email.";
    if (!EMAIL_RE.test(emailTrimmed)) return "Please enter a valid email.";
    if (!password) return "Please enter a password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const onSignup = async () => {
    const msg = validate();
    if (msg) return showToast(msg, "error");

    try {
      setBusy(true);

      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, password);

      const displayName = nameTrimmed || "User";
      await updateProfile(cred.user, { displayName });

      await ensureProfile({ name: displayName });

      showToast("Account created ✅", "ok");

      // small delay so toast shows
      setTimeout(() => router.replace("/(app)/dashboard"), 350);
    } catch (e: any) {
      showToast(friendlyAuthError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        <GraphBackdrop />

        <Toast visible={toastVisible} text={toastText} type={toastType} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.container}>
            <View style={{ gap: 6 }}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Set up Temp Monitor for your team in under a minute.</Text>
            </View>

            <View style={styles.card}>
              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    ref={nameRef}
                    value={name}
                    onChangeText={setName}
                    placeholder="john doe"
                    placeholderTextColor="rgba(148,163,184,0.65)"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    style={styles.input}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(148,163,184,0.65)"
                    returnKeyType="next"
                    onSubmitEditing={() => passRef.current?.focus()}
                    style={styles.input}
                  />
                  {!!emailTrimmed && !EMAIL_RE.test(emailTrimmed) ? (
                    <Text style={styles.hintError}>Enter a valid email format.</Text>
                  ) : null}
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    ref={passRef}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="rgba(148,163,184,0.65)"
                    returnKeyType="done"
                    onSubmitEditing={onSignup}
                    style={styles.input}
                  />
                  <Text style={styles.hint}>Min 6 characters.</Text>
                </View>
              </View>

              <Pressable
                onPress={onSignup}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed && !busy ? 0.92 : 1, backgroundColor: busy ? "#334155" : C.good },
                ]}
              >
                {busy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ActivityIndicator color={C.goodDark} />
                    <Text style={styles.primaryText}>Creating…</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryText}>Sign up</Text>
                )}
              </Pressable>

              <Text style={styles.footerText}>
                Already have an account?{" "}
                <Link href="/(auth)/login" style={styles.footerLink}>
                  Login
                </Link>
              </Text>
            </View>

            <Text style={styles.micro}>
              By creating an account, you can manage branches, chillers, logs, QR access, and reports.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgMid },

  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 28,
    justifyContent: "center",
    gap: 14,
  },

  title: { color: C.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 18 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },

  label: { color: C.text, fontWeight: "800", fontSize: 12 },

  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(2,6,23,0.35)",
    color: C.text,
  },

  hint: { color: C.muted, fontSize: 11 },
  hintError: { color: C.danger, fontSize: 11 },

  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: C.goodDark, fontWeight: "900", fontSize: 16 },

  footerText: { textAlign: "center", color: C.muted, marginTop: 8 },
  footerLink: { color: C.text, fontWeight: "900" },

  micro: { color: "rgba(148,163,184,0.75)", fontSize: 11, marginTop: 4 },

  // toast
  toast: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toastDot: { width: 8, height: 8, borderRadius: 99 },
  toastText: { color: C.text, fontWeight: "800", fontSize: 12 },

  // grid overlay
  grid: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    opacity: 0.9,
  },
  gridV: {
    width: 1,
    backgroundColor: C.line,
  },
  gridHWrap: {
    position: "absolute",
    top: 64,
    left: 18,
    right: 18,
    bottom: 64,
    justifyContent: "space-between",
  },
  gridH: {
    height: 1,
    backgroundColor: C.line,
  },

  // “temperature” line
  lineWrap: {
    position: "absolute",
    top: "32%",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    opacity: 0.75,
  },
  seg: {
    height: 2,
    borderRadius: 99,
    backgroundColor: C.lineStrong,
  },
});