import { adminAuth } from "./firebase-admin";

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

// Verify the Firebase ID token from the Authorization header.
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Missing Authorization bearer token");

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
