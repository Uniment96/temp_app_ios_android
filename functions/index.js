// functions/index.js (Gen 2)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createStaff = onCall({ region: "us-central1" }, async (request) => {
  const auth = request.auth;
  const data = request.data || {};

  if (!auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const callerUid = auth.uid;

  // ✅ check caller role
  const callerSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;

  if (callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "").trim();
  const name = String(data.name || "").trim();
  const branchId = data.branchId ? String(data.branchId) : null;

  if (!email || !password || !name) {
    throw new HttpsError("invalid-argument", "email, password, name are required");
  }

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
  }

  try {
    // ✅ Create Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // ✅ Create Firestore profile
    await admin.firestore().doc(`users/${userRecord.uid}`).set(
      {
        uid: userRecord.uid,
        email,
        name,
        role: "staff",
        defaultBranchId: branchId, // ✅ aligns with your UserProfile type
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
      },
      { merge: true }
    );

    return { ok: true, uid: userRecord.uid };
  } catch (err) {
    // ✅ Better readable errors for the app
    const code = err?.code || "";
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password is invalid");
    }
    if (code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Email is invalid");
    }

    throw new HttpsError("internal", err?.message || "Failed to create staff");
  }
});