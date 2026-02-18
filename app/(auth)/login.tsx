// app/(auth)/login.tsx
import React, { useMemo, useState, useEffect } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";

const C = {
  bgTop: "#06121F",
  bgMid: "#071A2E",
  bgBottom: "#06121F",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.10)",
  line: "rgba(255,255,255,0.12)",
  text: "#F8FAFC",
  muted: "#9CA3AF",
  cold: "#38BDF8", // cold accent
  cold2: "#60A5FA",
  frost: "rgba(56,189,248,0.14)",
  frost2: "rgba(96,165,250,0.12)",
};

function friendlyAuthError(e: any) {
  const code = String(e?.code || "");
  if (code.includes("auth/invalid-credential")) return "Wrong email or password.";
  if (code.includes("auth/invalid-email")) return "Please enter a valid email.";
  if (code.includes("auth/user-disabled")) return "This account is disabled.";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  if (code.includes("auth/network-request-failed")) return "Network error. Check your internet.";
  return e?.message || "Login failed.";
}

function friendlyResetError(e: any) {
  const code = String(e?.code || "");
  if (code.includes("auth/invalid-email")) return "Enter a valid email.";
  if (code.includes("auth/user-not-found")) return "No account found with this email.";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Try later.";
  return e?.message || "Could not send reset email.";
}

export default function LoginScreen() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailTrimmed = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    if (!loading && user) router.replace("/(app)/dashboard");
  }, [loading, user]);

  // --- temperature-wave animation (app-relevant) ---
  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = withRepeat(
      withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const waveStyle = useAnimatedStyle(() => {
    const t = wave.value;
    return {
      transform: [{ scale: 1 + t * 0.08 }],
      opacity: 0.25 + t * 0.15,
    };
  });

  const wave2Style = useAnimatedStyle(() => {
    const t = wave.value;
    return {
      transform: [{ scale: 1.15 + t * 0.10 }],
      opacity: 0.18 + t * 0.12,
    };
  });

  const onLogin = async () => {
    if (!emailTrimmed || !password) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, emailTrimmed, password);
      // redirect handled by useEffect/AuthContext
    } catch (e: any) {
      Alert.alert("Login failed", friendlyAuthError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!emailTrimmed) {
      Alert.alert("Email required", "Enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      Alert.alert("Email sent", "Password reset email sent. Check inbox/spam.");
    } catch (e: any) {
      Alert.alert("Reset failed", friendlyResetError(e));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.text} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[C.bgTop, C.bgMid, C.bgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bg}
    >
      {/* Tap outside => dismiss keyboard */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          {/* Frost grid overlay */}
          <View pointerEvents="none" style={styles.gridOverlay} />

          {/* Temperature “signal” waves */}
          <Animated.View pointerEvents="none" style={[styles.wave, waveStyle]} />
          <Animated.View pointerEvents="none" style={[styles.wave2, wave2Style]} />

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.container}>
              {/* Header (app-relevant) */}
              <View style={{ gap: 8 }}>
                <View style={styles.badge}>
                  <View style={styles.dot} />
                  <Text style={styles.badgeText}>Temperature Monitor</Text>
                </View>

                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>
                  Track cold-chain logs and keep compliance on point.
                </Text>
              </View>

              {/* Card */}
              <View style={styles.card}>
                <View style={{ gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(156,163,175,0.7)"
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor="rgba(156,163,175,0.7)"
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={onLogin}
                    />
                  </View>

                  <Pressable
                    onPress={onForgotPassword}
                    disabled={submitting}
                    style={{ alignSelf: "flex-start", paddingVertical: 6 }}
                  >
                    <Text style={styles.link}>Forgot password?</Text>
                  </Pressable>

                  <Pressable
                    onPress={onLogin}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.button,
                      submitting ? styles.buttonDisabled : null,
                      { opacity: pressed && !submitting ? 0.92 : 1 },
                    ]}
                  >
                    {submitting ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <ActivityIndicator color={C.bgTop} />
                        <Text style={styles.buttonText}>Signing in…</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Login</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Footer */}
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text style={{ color: C.muted }}>Don’t have an account?</Text>
                <Pressable onPress={() => router.push("/(auth)/signup")}>
                  <Text style={[styles.link, { color: C.text }]}>Sign up</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: C.bgTop,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    gap: 16,
  },

  // App-relevant badge
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.10)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.cold,
  },
  badgeText: {
    color: "rgba(248,250,252,0.92)",
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  title: { color: C.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: C.muted },

  card: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  label: { color: "rgba(248,250,252,0.92)", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.18)",
    color: C.text,
  },
  link: { color: "rgba(56,189,248,0.95)", fontWeight: "900" },

  button: {
    marginTop: 6,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: C.cold,
  },
  buttonDisabled: { backgroundColor: "rgba(56,189,248,0.7)" },
  buttonText: { color: C.bgTop, fontWeight: "900", fontSize: 16 },

  // Frost grid overlay (relevant to “monitoring” / “dashboard” feel)
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.10,
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.10)",
    borderWidth: 0,
  },

  // Signal waves near top-right (subtle “sensor” vibe)
  wave: {
    position: "absolute",
    top: 80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: C.frost,
  },
  wave2: {
    position: "absolute",
    top: 70,
    right: -55,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: C.frost2,
  },
});