import type { HandlerEvent } from "@netlify/functions";
import { adminAuth } from "./firebaseAdmin";

export interface AuthedUser {
  uid: string;
  name: string;
  email: string;
}

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Verifies the Firebase ID token from the Authorization header and returns the
// caller's identity. Throws HttpError(401) when missing/invalid.
export async function requireUser(event: HandlerEvent): Promise<AuthedUser> {
  const header =
    event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, "Missing Authorization bearer token");
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  return {
    uid: decoded.uid,
    name: (decoded.name as string) || (decoded.email as string) || "Someone",
    email: (decoded.email as string) || "",
  };
}
