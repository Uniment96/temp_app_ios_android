// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  defaultBranchId?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

type AuthCtx = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  ensureProfile: (params?: { name?: string }) => Promise<UserProfile | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  signOutUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  ensureProfile: async () => null,
  refreshProfile: async () => null,
  signOutUser: async () => {},
});

function normalizeProfile(u: User, data?: DocumentData | null, params?: { name?: string }): UserProfile {
  return {
    uid: u.uid,
    name: (data?.name as string) || params?.name || u.displayName || "User",
    email: (data?.email as string) || u.email || "",
    defaultBranchId: (data?.defaultBranchId as string | null) ?? null,
    createdAt: data?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function createDefaultProfile(u: User, params?: { name?: string }) {
  const ref = doc(db, "users", u.uid);
  const data = normalizeProfile(u, null, params);

  // IMPORTANT: must include uid match your rules (users/{userId})
  await setDoc(ref, data, { merge: true });
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // “boot” state: app should not hang forever
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async (): Promise<UserProfile | null> => {
    const u = auth.currentUser;
    if (!u) {
      setProfile(null);
      return null;
    }

    try {
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const p = normalizeProfile(u, snap.data());
        // keep doc fresh (optional)
        await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        setProfile(p);
        return p;
      }

      const created = await createDefaultProfile(u);
      setProfile(created);
      return created;
    } catch (e: any) {
      // Don’t trap the app in loading state if rules/index break
      console.log("refreshProfile error:", e?.code, e?.message);
      setProfile(null);
      return null;
    }
  };

  const ensureProfile = async (params?: { name?: string }): Promise<UserProfile | null> => {
    const u = auth.currentUser;
    if (!u) return null;

    try {
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const p = normalizeProfile(u, snap.data(), params);
        setProfile(p);
        return p;
      }

      const created = await createDefaultProfile(u, params);
      setProfile(created);
      return created;
    } catch (e: any) {
      console.log("ensureProfile error:", e?.code, e?.message);
      return null;
    }
  };

  const signOutUser = async () => {
    // importing signOut here avoids circular imports in some setups
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      setProfile(null);

      try {
        if (u) await refreshProfile();
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      ensureProfile,
      refreshProfile,
      signOutUser,
    }),
    [user, profile, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);