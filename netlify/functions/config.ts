import type { Handler } from "@netlify/functions";

// Serves the PUBLIC Firebase web config to the frontend at runtime, read from
// environment variables so nothing is hard-coded/committed in index.html.
// (These values are not secret — they ship to every browser — but keeping them
// in env keeps the repo clean and lets each environment point at its own project.)
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export const handler: Handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const apiKey = process.env.FIREBASE_API_KEY || "";

  if (!apiKey || !projectId) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "Firebase web config missing — set FIREBASE_API_KEY and FIREBASE_PROJECT_ID.",
      }),
    };
  }

  const config = {
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };

  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, config }) };
};
