import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

// Admin SDK — server-only (imported exclusively from Route Handlers).
function getAdminApp(): App {
  const apps = getApps();
  if (apps.length) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function makeDb(): Firestore {
  const d = getFirestore(getAdminApp());
  try {
    d.settings({ preferRest: true, ignoreUndefinedProperties: true });
  } catch {
    /* settings already applied */
  }
  return d;
}

export const adminDb: Firestore = makeDb();
export const adminAuth: Auth = getAuth(getAdminApp());
