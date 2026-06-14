"use client";

import { useMemo } from "react";
import type { Job } from "@/lib/types";

function drawTree(pct: number, idx: number, isFull: boolean): string {
  const seed = (idx * 7 + 3) % 5;
  const w = 90, h = 130, cx = 45;
  const trunkH = 26 + seed * 2, trunkW = 7 + (seed % 3);
  const groundY = h - 8, trunkTop = groundY - trunkH;
  const trunk = `<rect x="${cx - trunkW / 2}" y="${trunkTop}" width="${trunkW}" height="${trunkH}" rx="3" fill="#8B6B47"/>
    <rect x="${cx - trunkW / 2}" y="${trunkTop}" width="${Math.round(trunkW * 0.35)}" height="${trunkH}" rx="3" fill="#5C3D1E" opacity=".35"/>`;
  let canopy = "";
  if (isFull) {
    ([[cx, 72, 28, "#4A7C59"], [cx, 58, 24, "#5A8F6A"], [cx, 46, 20, "#6BA07A"], [cx, 36, 16, "#7DB88C"], [cx, 27, 11, "#96CCA4"]] as const).forEach(
      ([x, cy, r, c]) => {
        canopy += `<ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${Math.round(r * 0.83)}" fill="${c}"/>`;
      }
    );
    ([[cx - 13, 54], [cx + 11, 49], [cx - 7, 39], [cx + 9, 37], [cx, 62]] as const).forEach(([x, y]) => {
      canopy += `<circle cx="${x}" cy="${y}" r="3" fill="#F2AECF" opacity=".85"/>`;
    });
  } else {
    const base = 9 + pct * 19;
    const numL = Math.max(1, Math.round(pct * 4 + 1));
    const cs = ["#7DB87D", "#8FCC8F", "#A8D8A8", "#C0E8C0", "#D4F0D4"];
    const layers: { r: number; cy: number; c: string }[] = [];
    for (let i = 0; i < numL; i++) {
      const r = Math.round(base * (1 - i * 0.18));
      const cy = Math.round(90 - pct * 52 - i * (r * 0.62));
      layers.push({ r: Math.max(r, 5), cy, c: cs[i % cs.length] });
    }
    layers.forEach((l) => {
      canopy += `<ellipse cx="${cx}" cy="${l.cy}" rx="${l.r}" ry="${Math.round(l.r * 0.83)}" fill="${l.c}"/>`;
    });
    const bcount = Math.floor(pct * 7);
    const bcol = pct < 0.3 ? "#F9D6E7" : pct < 0.7 ? "#F2AECF" : "#E07FAA";
    if (bcount > 0 && layers.length) {
      const top = layers[layers.length - 1];
      for (let b = 0; b < bcount; b++) {
        const a = (b / bcount) * Math.PI * 2;
        const bx = cx + Math.cos(a) * top.r * 0.65;
        const by = top.cy + Math.sin(a) * top.r * 0.42;
        canopy += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.2" fill="${bcol}" opacity=".9"/>`;
      }
    }
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${trunk}${canopy}</svg>`;
}

export function ForestTab({ jobs }: { jobs: Job[] }) {
  const { total, full, rem, tcount } = useMemo(() => {
    const total = jobs.length;
    const full = Math.floor(total / 50);
    const rem = total % 50;
    return { total, full, rem, tcount: full + (rem > 0 ? 1 : 0) };
  }, [jobs]);

  const tip =
    total === 0
      ? "Add your first application to plant your first seed 🌱"
      : total < 10
      ? "Your seedling is sprouting... keep going! 🌱"
      : total < 50
      ? `${50 - total} more applications to grow your first full tree 🌿`
      : `You've grown ${full} full tree${full !== 1 ? "s" : ""}! The forest expands 🌳`;

  return (
    <div>
      <div className="forest-hd">
        <div>
          <div className="sec-title">My forest</div>
          <div className="forest-counter">
            <strong>{total}</strong> application{total !== 1 ? "s" : ""} planted · <strong>{full}</strong> full tree{full !== 1 ? "s" : ""} grown
            {rem > 0 && <> · current tree: <strong>{rem}/50</strong></>}
          </div>
        </div>
      </div>
      <div className="forest-bg">
        <div className="forest-scroll">
          <div className="forest-row">
            {total === 0 ? (
              <div style={{ padding: "40px 20px", color: "var(--text-light)", fontSize: 13, fontStyle: "italic" }}>
                Your forest is waiting — add applications to grow trees 🌱
              </div>
            ) : (
              Array.from({ length: tcount }).map((_, t) => {
                const isFull = t < full;
                const fillN = isFull ? 50 : rem;
                const pct = fillN / 50;
                return (
                  <div
                    className="tree-group"
                    key={t}
                    title={isFull ? `Tree ${t + 1}: fully grown (50 applications)` : `Tree ${t + 1}: ${fillN}/50 applications`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: drawTree(pct, t, isFull) }} />
                    <div className="tree-lbl"><strong>#{t + 1}</strong><br />{isFull ? "🌳 full" : `${fillN}/50`}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="forest-ground" />
      </div>
      <div className="forest-tip">{tip}</div>
    </div>
  );
}
