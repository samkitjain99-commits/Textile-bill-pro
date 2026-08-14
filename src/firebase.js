// Firebase project configuration.
// Get these from: Firebase Console → Project Settings (gear icon) → General
// → scroll to "Your apps" → your web app → SDK setup and configuration.
// Replace the placeholders below with your own values before deploying.
//
// Note: these values are not secrets — they identify your project publicly
// and are meant to ship in the browser bundle. What actually protects your
// data is the Firestore security rules plus Firebase Authentication (see
// the Sync panel in the app, and the rules snippet in SYNC-SETUP.md).
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Everything is imported lazily inside the functions below so that the
// Firebase SDK is only downloaded when someone actually opens Sync — it
// stays out of the initial page load for everyone else.
let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp } = await import("firebase/app");
      return initializeApp(firebaseConfig);
    })();
  }
  return appPromise;
}

export function isFirebaseConfigured() {
  return !String(firebaseConfig.apiKey || "").startsWith("YOUR_");
}

export async function getFirebaseAuth() {
  const app = await getApp();
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

export async function getFirestoreDb() {
  const app = await getApp();
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(app);
}

// Signs in with the Firebase account you created in the Firebase Console
// (Authentication → Users → Add user). Firebase persists the session in the
// browser, so this is normally only needed once per device.
export async function firebaseSignIn(email, password) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function firebaseSignOut() {
  const auth = await getFirebaseAuth();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

// Fires immediately with the current user (or null) and again on any change.
export async function watchFirebaseUser(cb) {
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(auth, cb);
}

// Pushes one company's book to Firestore under the signed-in user's own
// document tree: users/{uid}/companies/{companyId}. Combined with the
// security rules in SYNC-SETUP.md, that means only this signed-in account
// can read or write it.
//
// The whole book goes in a single document, which keeps this simple and
// atomic. Firestore's hard limit is 1 MB per document — comfortably more
// than these books run to in practice, but the caller surfaces a clear
// error if that's ever exceeded rather than failing silently.
export async function pushCompanyToFirestore({ companyId, companyName, book }) {
  const db = await getFirestoreDb();
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in to Firebase.");

  const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const payload = JSON.stringify(book);
  const bytes = new Blob([payload]).size;
  if (bytes > 950 * 1024) {
    throw new Error(
      `This company's data is ${(bytes / 1024 / 1024).toFixed(2)} MB, which exceeds Firestore's 1 MB per-document limit. Use the JSON backup instead.`
    );
  }

  const ref = doc(db, "users", user.uid, "companies", companyId);
  await setDoc(ref, {
    companyName,
    // Stored as a JSON string rather than a nested object: Firestore rejects
    // nested arrays (an array can't directly contain another array), and
    // these books have arrays of line items inside arrays of invoices.
    // Serialising sidesteps that entirely and round-trips exactly.
    data: payload,
    sizeBytes: bytes,
    updatedAt: serverTimestamp(),
    syncedFrom: navigator.userAgent || "unknown",
  });
  return { bytes };
}

// The other half of pushCompanyToFirestore — fetches that same document back
// down and parses it into a plain book object. Used by "Restore from Cloud",
// e.g. to recover on a new device or after clearing browser storage. Doesn't
// touch local data itself; the caller decides what to do with the result.
export async function pullCompanyFromFirestore({ companyId }) {
  const db = await getFirestoreDb();
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in to Firebase.");

  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(db, "users", user.uid, "companies", companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("No cloud backup found for this company yet — sync it at least once first.");
  }
  const record = snap.data();
  let book;
  try {
    book = JSON.parse(record.data);
  } catch {
    throw new Error("The cloud copy of this company looks corrupted.");
  }
  return {
    book,
    companyName: record.companyName || "",
    updatedAt: record.updatedAt?.toDate ? record.updatedAt.toDate().toISOString() : null,
  };
}
