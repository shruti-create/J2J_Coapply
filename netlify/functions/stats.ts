import type { Handler, HandlerEvent } from "@netlify/functions";
import { db } from "./_shared/firebaseAdmin";
import { requireUser, HttpError } from "./_shared/auth";

const APPLICATIONS = "applications";

const STATUSES = [
  "Applied",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Ghosted",
  "Withdrawn",
];

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function rate(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

// GET /.netlify/functions/stats — community-wide aggregates across all users.
export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: JSON_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  try {
    await requireUser(event); // any signed-in user may view community stats

    const snap = await db.collection(APPLICATIONS).get();

    const statusCounts: Record<string, number> = {};
    STATUSES.forEach((s) => (statusCounts[s] = 0));
    const companyCounts: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const users = new Set<string>();

    let total = 0;
    let interviewish = 0; // Interview or Offer
    let offers = 0;
    let responded = 0; // anything past "Applied"/"Ghosted"

    snap.forEach((doc) => {
      const j = doc.data() as Record<string, string>;
      total++;
      if (j.ownerUid) users.add(j.ownerUid);

      const status = j.status || "Applied";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (status === "Interview" || status === "Offer") interviewish++;
      if (status === "Offer") offers++;
      if (status !== "Applied" && status !== "Ghosted") responded++;

      if (j.company) companyCounts[j.company] = (companyCounts[j.company] || 0) + 1;
      if (j.date) {
        const m = String(j.date).slice(0, 7); // YYYY-MM
        if (/^\d{4}-\d{2}$/.test(m)) monthly[m] = (monthly[m] || 0) + 1;
      }
    });

    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const monthlyVolume = Object.entries(monthly)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([month, count]) => ({ month, count }));

    const totalUsers = users.size;

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: true,
        totalApps: total,
        totalUsers,
        avgPerUser: totalUsers ? Math.round((total / totalUsers) * 10) / 10 : 0,
        interviewRate: rate(interviewish, total),
        offerRate: rate(offers, total),
        responseRate: rate(responded, total),
        statusCounts,
        topCompanies,
        monthlyVolume,
      }),
    };
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    const msg = err instanceof Error ? err.message : "Server error";
    return { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: msg }) };
  }
};
