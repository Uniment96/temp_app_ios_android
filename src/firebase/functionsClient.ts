import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../src/firebase/firebaseConfig"; // make sure you export app from firebaseConfig

const functions = getFunctions(app);

export type CreateStaffInput = {
  name: string;
  email: string;
  password: string;
  defaultBranchId?: string | null;
};

export async function createStaff(input: CreateStaffInput) {
  const fn = httpsCallable(functions, "createStaff");
  const res = await fn(input);
  return res.data as { ok: boolean; uid: string };
}