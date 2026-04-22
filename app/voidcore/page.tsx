"use client";

import { useState } from "react";
import Link from "next/link";
import {
  fetchAndParseForVoidcore,
  mergeResults,
  extractReportId,
  RollTarget,
  VoidcoreAdvisorResult,
} from "@/lib/voidcore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLOT_LABELS: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  shoulder: "Shoulders",
  back: "Back",
  chest: "Chest",
  wrist: "Wrists",
  hands: "Hands",
  waist: "Waist",
  legs: "Legs",
  feet: "Feet",
  finger1: "Ring",
  finger2: "Ring",
  trinket1: "Trinket",
  trinket2: "Trinket",
  main_hand: "Main Hand",
  off_hand: "Off Hand",
};

function formatDps(gain: number) {
  if (gain >= 1000) return `+${(gain / 1000).toFixed(1)}k`;
  return `+${gain}`;
}

// ---------------------------------------------------------------------------
// RollTargetCard
// ---------------------------------------------------------------------------

function RollTargetCard({
  rank,
  target,
}: {
  rank: number;
  target: RollTarget;
}) {
  const [expanded, setExpanded] = useState(false);
  const rest = target.allItems.slice(1);

  const title =
    target.reportType === "raid"
      ? `${target.bossName} — ${target.instanceName}`
      : target.instanceName;

  const subtitle =
    target.reportType === "raid"
      ? `${target.voidcoreCost} Voidcores • Raid`
      : `${target.voidcoreCost} Voidcore • M+`;

  return (
    <Card className="overflow-hidden rounded-lg border border-border bg-card p-0 gap-0 shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center font-mono text-[11px] font-bold text-primary">
            {rank}
          </span>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground leading-tight block truncate">
              {title}
            </span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        <div className="shrink-0 text-right ml-4">
          <span className="block text-sm font-bold text-gain tabular-nums">
            {formatDps(target.dpsPerVoidcore)}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            DPS/voidcore
          </span>
        </div>
      </div>

      {/* Top item */}
      <ItemRow item={target.topItem} showBoss={target.reportType === "mplus"} />

      {/* Expandable rest */}
      {rest.length > 0 && (
        <>
          {expanded &&
            rest.map((item) => (
              <ItemRow
                key={`${item.id}-${item.slot}`}
                item={item}
                showBoss={target.reportType === "mplus"}
              />
            ))}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border bg-muted/10"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M1.75 6.5l6.25 5.25L14.25 6.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {expanded ? "Show less" : `${rest.length} more item${rest.length !== 1 ? "s" : ""} in this pool`}
          </button>
        </>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  showBoss,
}: {
  item: { id: number; name: string; icon: string; slot: string; ilvl: number; dpsGain: number; isCatalyst: boolean; bossName?: string };
  showBoss: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-border last:border-b-0">
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded overflow-hidden border border-border bg-muted/30">
        {item.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://wow.zamimg.com/images/wow/icons/medium/${item.icon}.jpg`}
            alt=""
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground leading-snug truncate">
            {item.name}
          </span>
          {item.isCatalyst && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              Catalyst
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {SLOT_LABELS[item.slot] ?? item.slot}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">ilvl {item.ilvl}</span>
          {showBoss && item.bossName && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{item.bossName}</span>
            </>
          )}
        </div>
      </div>

      {/* DPS gain */}
      <span className="shrink-0 text-sm font-semibold text-gain tabular-nums">
        {formatDps(item.dpsGain)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Status = "idle" | "loading" | "done" | "error";

export default function VoidcorePage() {
  const [mplusUrl, setMplusUrl] = useState("");
  const [raidUrl, setRaidUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VoidcoreAdvisorResult | null>(null);

  async function handleAnalyze() {
    const hasM = mplusUrl.trim().length > 0;
    const hasR = raidUrl.trim().length > 0;
    if (!hasM && !hasR) return;

    setStatus("loading");
    setError(null);
    setResults(null);

    try {
      const fetches: Promise<VoidcoreAdvisorResult>[] = [];

      if (hasM) {
        const id = extractReportId(mplusUrl.trim());
        if (!id) throw new Error("Invalid M+ Raidbots URL — could not extract report ID.");
        fetches.push(fetchAndParseForVoidcore(id));
      }

      if (hasR) {
        const id = extractReportId(raidUrl.trim());
        if (!id) throw new Error("Invalid Raid Raidbots URL — could not extract report ID.");
        fetches.push(fetchAndParseForVoidcore(id));
      }

      const resolved = await Promise.all(fetches);
      const merged =
        resolved.length === 2
          ? mergeResults(resolved[0], resolved[1])
          : resolved[0];

      setResults(merged);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const canAnalyze =
    status !== "loading" &&
    (mplusUrl.trim().length > 0 || raidUrl.trim().length > 0);

  return (
    <div className="relative min-h-screen max-w-[860px] mx-auto px-6 py-16 pb-20">
      {/* Back nav */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
            <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z" />
          </svg>
          Back to Dropr
        </Link>
      </div>

      {/* Header */}
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Voidcore Advisor
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
          Paste your Raidbots droptimizer URLs to find out where your Voidcore bonus rolls
          will give you the most DPS.
        </p>
      </header>

      {/* Caveat box */}
      <div className="mb-8 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 mt-0.5 text-amber-400">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
        </svg>
        <p className="text-xs text-amber-200/80 leading-relaxed">
          Rankings are based on simulated DPS gain. Bad luck protection (no duplicate drops per slot) is
          not modeled by Raidbots — if you already own the best item from a boss, your actual value will be lower.
          Voidcore cost: <strong className="text-amber-200">1 per M+ dungeon</strong>, <strong className="text-amber-200">2 per raid boss</strong>.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label
            htmlFor="mplus-url"
            className="block mb-2 text-sm font-medium text-foreground"
          >
            M+ Droptimizer URL
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="mplus-url"
            type="url"
            placeholder="https://www.raidbots.com/simbot/report/..."
            value={mplusUrl}
            onChange={(e) => setMplusUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            disabled={status === "loading"}
            className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label
            htmlFor="raid-url"
            className="block mb-2 text-sm font-medium text-foreground"
          >
            Raid Droptimizer URL
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="raid-url"
            type="url"
            placeholder="https://www.raidbots.com/simbot/report/..."
            value={raidUrl}
            onChange={(e) => setRaidUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            disabled={status === "loading"}
            className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        className="h-10 px-8 font-medium"
      >
        {status === "loading" ? "Analyzing…" : "Analyze"}
      </Button>

      {/* Status messages */}
      {status === "loading" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Fetching report{mplusUrl && raidUrl ? "s" : ""} from Raidbots…
        </p>
      )}
      {status === "error" && error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      {/* Results */}
      {results && results.targets.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="text-lg font-semibold text-foreground">
              Roll Targets
            </h2>
            <span className="text-sm text-muted-foreground">
              {results.char} &middot; {results.spec} &middot;{" "}
              {results.targets.length} target{results.targets.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {results.targets.map((target, i) => (
              <RollTargetCard key={target.key} rank={i + 1} target={target} />
            ))}
          </div>
        </div>
      )}

      {results && results.targets.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">
          No significant upgrade targets found in the provided report{mplusUrl && raidUrl ? "s" : ""}.
        </p>
      )}

      {/* Footer */}
      <footer className="mt-20 text-center">
        <p className="text-xs text-muted-foreground">
          Data provided by{" "}
          <a
            href="https://www.raidbots.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Raidbots
          </a>
          . Not affiliated with Blizzard Entertainment.
        </p>
      </footer>
    </div>
  );
}
