"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/lib/firebase";
import type { FeedEvent, Job } from "@/lib/types";

function tsToISO(t: unknown): string {
  try {
    const v = t as Timestamp | undefined;
    return v && typeof v.toDate === "function" ? v.toDate().toISOString() : "";
  } catch {
    return "";
  }
}

function mapDoc(d: QueryDocumentSnapshot<DocumentData>): Job {
  const x = d.data();
  return {
    id: d.id,
    company: x.company || "",
    role: x.role || "",
    roleCategory: x.roleCategory || "",
    status: x.status || "Applied",
    priority: x.priority || "",
    location: x.location || "",
    date: x.date || "",
    salary: x.salary || "",
    url: x.url || "",
    recruiter: x.recruiter || "",
    followup: x.followup || "",
    notes: x.notes || "",
    starred: x.starred === true || x.starred === "true",
    ownerUid: x.ownerUid || "",
    ownerName: x.ownerName || "Someone",
    added: tsToISO(x.createdAt),
    updated: tsToISO(x.updatedAt),
  };
}

function mapFeed(d: QueryDocumentSnapshot<DocumentData>): FeedEvent {
  const x = d.data();
  const ts = x.ts as Timestamp | undefined;
  return {
    type: (x.type as FeedEvent["type"]) || "applied",
    company: x.company || "",
    role: x.role || "",
    status: x.status || "",
    ownerName: x.ownerName || "Someone",
    ts: ts && typeof ts.toDate === "function" ? ts.toDate() : null,
  };
}

interface Pending {
  adds: Job[];
  patches: Record<string, Partial<Job>>;
  deletes: Record<string, true>;
}

const EMPTY_PENDING: Pending = { adds: [], patches: {}, deletes: {} };

export function useBloom() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverJobs, setServerJobs] = useState<Job[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [pending, setPending] = useState<Pending>(EMPTY_PENDING);
  const firstSnap = useRef(true);

  // ---- auth ----
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setServerJobs([]);
        setFeed([]);
        setPending(EMPTY_PENDING);
        setLoading(true);
        firstSnap.current = true;
      }
    });
  }, []);

  // ---- live snapshots ----
  useEffect(() => {
    if (!user) return;
    firstSnap.current = true;
    setLoading(true);

    const unsubApps = onSnapshot(
      collection(db, "applications"),
      (snap) => {
        setServerJobs(snap.docs.map(mapDoc));
        if (firstSnap.current) {
          firstSnap.current = false;
          setLoading(false);
        }
      },
      (err) => console.error("applications snapshot error", err)
    );

    const unsubFeed = onSnapshot(
      query(collection(db, "feed"), orderBy("ts", "desc"), limit(10)),
      (snap) => setFeed(snap.docs.map(mapFeed)),
      (err) => console.error("feed snapshot error", err)
    );

    return () => {
      unsubApps();
      unsubFeed();
    };
  }, [user]);

  // ---- derived: merge server data with optimistic overlay ----
  const allJobs = useMemo<Job[]>(() => {
    const patched = serverJobs
      .filter((j) => !pending.deletes[j.id])
      .map((j) => (pending.patches[j.id] ? { ...j, ...pending.patches[j.id] } : j));
    const adds = pending.adds.filter((a) => !serverJobs.some((s) => s.id === a.id));
    const list = [...adds, ...patched];
    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return list;
  }, [serverJobs, pending]);

  const myJobs = useMemo<Job[]>(
    () => allJobs.filter((j) => j.ownerUid === user?.uid),
    [allJobs, user]
  );

  // ---- writes (through the TS API, with optimistic overlay) ----
  const authedFetch = useCallback(
    async (method: string, body: Record<string, unknown>) => {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch("/api/applications", {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let d: { ok?: boolean; error?: string } = {};
      try {
        d = await res.json();
      } catch {
        d = { ok: false, error: "Bad response from server" };
      }
      if (!res.ok || !d.ok) throw new Error(d.error || `Request failed (${res.status})`);
      return d;
    },
    []
  );

  const createJob = useCallback(
    async (data: Record<string, string>) => {
      if (!user) return;
      const tempId = "tmp-" + Math.random().toString(36).slice(2);
      const now = new Date().toISOString();
      const temp: Job = {
        id: tempId,
        company: data.company || "",
        role: data.role || "",
        roleCategory: data.roleCategory || "",
        status: data.status || "Applied",
        priority: data.priority || "",
        location: data.location || "",
        date: data.date || "",
        salary: data.salary || "",
        url: data.url || "",
        recruiter: data.recruiter || "",
        followup: data.followup || "",
        notes: data.notes || "",
        starred: false,
        ownerUid: user.uid,
        ownerName: user.displayName || user.email || "You",
        added: now,
        updated: now,
      };
      setPending((p) => ({ ...p, adds: [temp, ...p.adds] }));
      toast.success("Application added 🌸 — a new tree is growing!");
      try {
        await authedFetch("POST", data);
      } catch (e) {
        toast.error("Save failed — " + (e as Error).message);
      } finally {
        setPending((p) => ({ ...p, adds: p.adds.filter((a) => a.id !== tempId) }));
      }
    },
    [user, authedFetch]
  );

  const updateJob = useCallback(
    async (id: string, data: Record<string, string>) => {
      setPending((p) => ({ ...p, patches: { ...p.patches, [id]: { ...p.patches[id], ...data } } }));
      toast.success("Updated 🌿");
      try {
        await authedFetch("PUT", { id, ...data });
      } catch (e) {
        toast.error("Save failed — " + (e as Error).message);
      } finally {
        setPending((p) => {
          const patches = { ...p.patches };
          delete patches[id];
          return { ...p, patches };
        });
      }
    },
    [authedFetch]
  );

  const toggleStar = useCallback(
    async (id: string) => {
      const current = allJobs.find((j) => j.id === id);
      if (!current) return;
      const next = !current.starred;
      setPending((p) => ({ ...p, patches: { ...p.patches, [id]: { ...p.patches[id], starred: next } } }));
      try {
        await authedFetch("PUT", { id, starred: next });
      } catch (e) {
        toast.error("Couldn't save star — " + (e as Error).message);
      } finally {
        setPending((p) => {
          const patches = { ...p.patches };
          if (patches[id]) {
            const { starred, ...rest } = patches[id]!;
            if (Object.keys(rest).length) patches[id] = rest;
            else delete patches[id];
          }
          return { ...p, patches };
        });
      }
    },
    [allJobs, authedFetch]
  );

  const deleteJob = useCallback(
    async (id: string) => {
      setPending((p) => ({ ...p, deletes: { ...p.deletes, [id]: true } }));
      toast.success("Removed 🍂");
      try {
        await authedFetch("DELETE", { id });
      } catch (e) {
        toast.error("Delete failed — " + (e as Error).message);
      } finally {
        setPending((p) => {
          const deletes = { ...p.deletes };
          delete deletes[id];
          return { ...p, deletes };
        });
      }
    },
    [authedFetch]
  );

  const signOut = useCallback(() => fbSignOut(auth), []);

  return {
    user,
    authReady,
    loading,
    allJobs,
    myJobs,
    feed,
    createJob,
    updateJob,
    deleteJob,
    toggleStar,
    signOut,
  };
}

export type BloomApi = ReturnType<typeof useBloom>;
