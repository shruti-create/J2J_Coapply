import type { Handler, HandlerEvent } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./_shared/firebaseAdmin";
import { requireUser, HttpError } from "./_shared/auth";

// User-editable fields, mirroring the frontend form in index.html.
const FIELDS = [
  "company",
  "role",
  "status",
  "priority",
  "location",
  "date",
  "salary",
  "url",
  "recruiter",
  "followup",
  "notes",
  "starred",
] as const;

const APPLICATIONS = "applications";
const FEED = "feed";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
};

function ok(body: unknown, statusCode = 200) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}
function fail(statusCode: number, error: string) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error }) };
}

// Pick only known fields off an arbitrary payload and coerce to strings/bools.
function pickFields(input: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const k of FIELDS) {
    if (input[k] === undefined) continue;
    if (k === "starred") {
      out[k] = input[k] === true || input[k] === "true";
    } else {
      out[k] = String(input[k] ?? "").trim();
    }
  }
  return out;
}

async function addFeedEvent(ev: {
  type: "applied" | "status" | "offer";
  company: string;
  role: string;
  status: string;
  ownerName: string;
}) {
  await db.collection(FEED).add({ ...ev, ts: FieldValue.serverTimestamp() });
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: JSON_HEADERS, body: "" };
  }

  try {
    const user = await requireUser(event);
    const body = event.body ? JSON.parse(event.body) : {};

    // -------- CREATE --------
    if (event.httpMethod === "POST") {
      const data = pickFields(body);
      if (!data.company) throw new HttpError(400, "Company is required");
      if (!data.role) throw new HttpError(400, "Role is required");

      const status = (data.status as string) || "Applied";
      const now = FieldValue.serverTimestamp();
      const ref = await db.collection(APPLICATIONS).add({
        ...data,
        status,
        starred: data.starred === true,
        ownerUid: user.uid,
        ownerName: user.name,
        createdAt: now,
        updatedAt: now,
      });

      await addFeedEvent({
        type: status === "Offer" ? "offer" : "applied",
        company: data.company as string,
        role: data.role as string,
        status,
        ownerName: user.name,
      });

      return ok({ ok: true, id: ref.id });
    }

    // -------- UPDATE --------
    if (event.httpMethod === "PUT") {
      const id = body.id as string | undefined;
      if (!id) throw new HttpError(400, "Missing application id");

      const ref = db.collection(APPLICATIONS).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "Application not found");
      const existing = snap.data() as Record<string, unknown>;
      if (existing.ownerUid !== user.uid) {
        throw new HttpError(403, "You can only edit your own applications");
      }

      const data = pickFields(body);
      await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() });

      // Emit a feed event when the status changed.
      const newStatus = data.status as string | undefined;
      if (newStatus && newStatus !== existing.status) {
        await addFeedEvent({
          type: newStatus === "Offer" ? "offer" : "status",
          company: (data.company as string) || (existing.company as string) || "",
          role: (data.role as string) || (existing.role as string) || "",
          status: newStatus,
          ownerName: user.name,
        });
      }

      return ok({ ok: true, id });
    }

    // -------- DELETE --------
    if (event.httpMethod === "DELETE") {
      const id = (body.id as string) || (event.queryStringParameters?.id as string);
      if (!id) throw new HttpError(400, "Missing application id");

      const ref = db.collection(APPLICATIONS).doc(id);
      const snap = await ref.get();
      if (!snap.exists) return ok({ ok: true, id }); // already gone
      const existing = snap.data() as Record<string, unknown>;
      if (existing.ownerUid !== user.uid) {
        throw new HttpError(403, "You can only delete your own applications");
      }
      await ref.delete();
      return ok({ ok: true, id });
    }

    return fail(405, "Method not allowed");
  } catch (err) {
    if (err instanceof HttpError) return fail(err.statusCode, err.message);
    const msg = err instanceof Error ? err.message : "Server error";
    return fail(500, msg);
  }
};
