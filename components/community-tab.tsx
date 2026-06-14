"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { auth } from "@/lib/firebase";
import { STATUSES, type CommunityStats, type FeedEvent, type Job } from "@/lib/types";
import { fmtMonth, timeAgo, classifyRole } from "@/lib/job-utils";

const STATUS_COLORS = ["#185FA5", "#6B9E6B", "#D4537E", "#3B6D11", "#A32D2D", "#9E9088", "#854F0B"];
const AXIS_LIGHT = { fontSize: 11, fill: "#9E9088" };
const AXIS_MID = { fontSize: 11, fill: "#6B5E52" };

function Donut({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={1}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip />
        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, color: "#6B5E52" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HBar({ data, fill }: { data: { name: string; value: number }[]; fill: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#F0F5F0" />
        <XAxis type="number" allowDecimals={false} tick={AXIS_LIGHT} />
        <YAxis type="category" dataKey="name" width={96} tick={AXIS_MID} />
        <Tooltip cursor={{ fill: "rgba(212,83,126,.06)" }} />
        <Bar dataKey="value" fill={fill} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CommunityTab({ allJobs, feed }: { allJobs: Job[]; feed: FeedEvent[] }) {
  const [stats, setStats] = useState<CommunityStats | null>(null);

  // Headline numbers from the server-side aggregator. Refresh as the pool changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/stats", { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        if (!cancelled && d.ok) setStats(d);
      } catch {
        /* charts still render from the live snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allJobs.length]);

  const charts = useMemo(() => {
    const sc: Record<string, number> = {};
    STATUSES.forEach((s) => (sc[s] = 0));
    const cc: Record<string, number> = {};
    const mc: Record<string, number> = {};
    const rc: Record<string, number> = {};
    allJobs.forEach((j) => {
      sc[j.status] = (sc[j.status] || 0) + 1;
      if (j.company) cc[j.company] = (cc[j.company] || 0) + 1;
      if (j.date) {
        const m = j.date.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) mc[m] = (mc[m] || 0) + 1;
      }
      const cat = j.roleCategory || classifyRole(j.role);
      if (cat) rc[cat] = (rc[cat] || 0) + 1;
    });

    // Funnel: how many apps reached at least each stage (excluding "Applied")
    const stageOrder: Record<string, number> = { "Phone Screen": 0, Interview: 1, Offer: 2 };
    const funnelReached = [0, 0, 0];
    allJobs.forEach((j) => {
      const o = stageOrder[j.status];
      if (o !== undefined) for (let i = 0; i <= o; i++) funnelReached[i]++;
    });

    return {
      status: STATUSES.map((s) => ({ name: s, value: sc[s] })),
      outcome: [
        { name: "In progress", value: sc["Applied"] + sc["Phone Screen"] + sc["Interview"] },
        { name: "Offer", value: sc["Offer"] },
        { name: "Rejected", value: sc["Rejected"] },
        { name: "Ghosted", value: sc["Ghosted"] },
        { name: "Withdrawn", value: sc["Withdrawn"] },
      ],
      funnel: ["Phone Screen", "Interview", "Offer"].map((s, i) => ({ name: s, value: funnelReached[i] })),
      companies: Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value })),
      roles: Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })),
      months: Object.entries(mc).sort((a, b) => (a[0] > b[0] ? 1 : -1)).map(([m, value]) => ({ name: fmtMonth(m), value })),
    };
  }, [allJobs]);

  const leaderboard = useMemo(() => {
    const by: Record<string, { uid: string; name: string; total: number; interviews: number; offers: number; responded: number }> = {};
    allJobs.forEach((j) => {
      const uid = j.ownerUid || "?";
      if (!by[uid]) by[uid] = { uid, name: j.ownerName || "Someone", total: 0, interviews: 0, offers: 0, responded: 0 };
      const u = by[uid];
      u.total++;
      if (j.status === "Interview" || j.status === "Offer") u.interviews++;
      if (j.status === "Offer") u.offers++;
      if (j.status !== "Applied" && j.status !== "Ghosted") u.responded++;
    });
    return Object.values(by).sort((a, b) => b.offers - a.offers || b.interviews - a.interviews || b.total - a.total);
  }, [allJobs]);

  const myUid = auth.currentUser?.uid;
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1);

  const card = (id: string, val: string | number, label: string, sage?: boolean, color?: string) => (
    <div className={`stat-card${sage ? " sage" : ""}`} key={id}>
      <div className="stat-num" style={color ? { color } : undefined}>{val}</div>
      <div className="stat-label">{label}</div>
    </div>
  );

  return (
    <div>
      <div className="sec-header" style={{ marginBottom: 6 }}>
        <span className="sec-title">Community garden</span>
      </div>
      <div className="privacy-note">
        <i className="ti ti-info-circle" /> Stats below are pooled across everyone using bloom right now.
      </div>

      <div className="stats-row">
        {card("u", stats?.totalUsers ?? "—", "Gardeners", true)}
        {card("a", stats?.totalApps ?? "—", "Applications")}
        {card("v", stats?.avgPerUser ?? "—", "Avg / person", true)}
        {card("i", stats ? stats.interviewRate + "%" : "—", "Interview rate", false, "var(--info)")}
        {card("o", stats ? stats.offerRate + "%" : "—", "Offer rate", false, "var(--success)")}
        {card("r", stats ? stats.responseRate + "%" : "—", "Response rate", true)}
      </div>

      <div className="comm-grid">
        <div className="chart-card"><div className="it">Status mix (everyone)</div><div className="chart-wrap"><Donut data={charts.status} colors={STATUS_COLORS} /></div></div>
        <div className="chart-card"><div className="it">Interview funnel</div><div className="chart-wrap"><HBar data={charts.funnel} fill="#185FA5" /></div></div>
        <div className="chart-card"><div className="it">Most-applied companies</div><div className="chart-wrap"><HBar data={charts.companies} fill="#F2AECF" /></div></div>
        <div className="chart-card"><div className="it">Top role categories</div><div className="chart-wrap"><HBar data={charts.roles} fill="#A8C9A8" /></div></div>
        <div className="chart-card"><div className="it">Outcomes</div><div className="chart-wrap"><Donut data={charts.outcome} colors={["#A8C9A8", "#3B6D11", "#A32D2D", "#9E9088", "#854F0B"]} /></div></div>

        <div className="chart-card wide">
          <div className="it">Monthly application volume</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.months} margin={{ left: 0, right: 12, top: 6, bottom: 4 }}>
                <CartesianGrid stroke="#F0F5F0" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_LIGHT} />
                <YAxis allowDecimals={false} tick={AXIS_LIGHT} />
                <Tooltip />
                <Area dataKey="value" type="monotone" stroke="#D4537E" strokeWidth={2} fill="rgba(212,83,126,.18)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="feed-card">
          <div className="it">🏆 Leaderboard — top gardeners</div>
          {leaderboard.length === 0 ? (
            <div className="lb-empty">No gardeners yet — applications will rank here 🌱</div>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-rank">#</th>
                  <th>Gardener</th>
                  <th className="num">Apps</th>
                  <th className="num">Interviews</th>
                  <th className="num">Offers</th>
                  <th className="num">Resp. rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((u, i) => {
                  const rate = u.total ? Math.round((u.responded / u.total) * 100) : 0;
                  const me = u.uid === myUid;
                  return (
                    <tr key={u.uid} className={me ? "lb-row-me" : ""}>
                      <td className="lb-rank">{medal(i)}</td>
                      <td className="lb-name">{u.name}{me && <span className="lb-me-tag">YOU</span>}</td>
                      <td className="num">{u.total}</td>
                      <td className="num">{u.interviews}</td>
                      <td className="num lb-offers">{u.offers}</td>
                      <td className="num">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="feed-card">
          <div className="it">Live activity feed 🌱</div>
          <div className="feed-list">
            {feed.length === 0 ? (
              <div className="feed-empty">No activity yet — be the first to plant something 🌱</div>
            ) : (
              feed.map((e, i) => {
                const icon = e.type === "offer" ? "🎉" : e.type === "status" ? "🔄" : "🌱";
                return (
                  <div className="feed-item" key={i}>
                    <span className="feed-ic">{icon}</span>
                    <div className="feed-body">
                      <div className="feed-text">
                        {e.type === "offer" ? (
                          <><strong>{e.ownerName}</strong> got an offer from <strong>{e.company}</strong>!</>
                        ) : e.type === "status" ? (
                          <><strong>{e.ownerName}</strong> moved <strong>{e.company}</strong> → {e.status}</>
                        ) : (
                          <><strong>{e.ownerName}</strong> applied to <strong>{e.company}</strong></>
                        )}
                      </div>
                      <div className="feed-sub">
                        {e.role && `${e.role} · `}
                        <span className="feed-time">{timeAgo(e.ts)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
