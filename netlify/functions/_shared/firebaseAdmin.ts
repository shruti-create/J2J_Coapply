import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

// Initialize the Admin SDK exactly once (Netlify may reuse the container across
// invocations). Credentials come from environment variables — see .env.example.
function getApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key is stored with literal "\n" sequences in the env var; turn
  // them back into real newlines.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function makeDb(): Firestore {
  const d = getFirestore(getApp());
  try {
    // REST transport has much faster cold starts than gRPC in short-lived
    // serverless functions; ignoreUndefinedProperties avoids write errors.
    d.settings({ preferRest: true, ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if Firestore was already used — safe to ignore.
  }
  return d;
}

export const db: Firestore = makeDb();
export const adminAuth: Auth = getAuth(getApp());
