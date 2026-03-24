"use client";

import { useState } from "react";
import {
  extractReportId,
  fetchAndParse,
  generateImportString,
  DroprPayload,
  DroprDungeon,
} from "@/lib/raidbots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Slot display labels
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
// DungeonCard
// ---------------------------------------------------------------------------
function DungeonCard({
  instanceId,
  dungeon,
}: {
  instanceId: string;
  dungeon: DroprDungeon;
}) {
  return (
    <Card className="overflow-hidden rounded-lg ring-0 border border-border bg-card p-0 gap-0">
      {/* Dungeon header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-dungeon-header border-b border-border">
        <span className="font-cinzel text-sm font-semibold tracking-wide text-gold">
          {dungeon.name}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          #{instanceId}
        </span>
      </div>

      {/* Item list */}
      <div className="divide-y divide-border">
        {dungeon.items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.02] transition-colors"
          >
            {/* Rank */}
            <span className="text-[11px] font-bold text-muted-foreground w-3.5 text-center shrink-0">
              {i + 1}
            </span>

            {/* Icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-8 h-8 rounded border border-border/60 shrink-0"
              src={`https://wow.zamimg.com/images/wow/icons/medium/${item.icon}.jpg`}
              alt={item.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://wow.zamimg.com/images/wow/icons/medium/inv_misc_questionmark.jpg";
              }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.name}
                  {item.ilvl > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground font-normal">
                      ({item.ilvl})
                    </span>
                  )}
                </p>
                {item.isCatalyst && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] px-1 py-0 h-4 border-amber-500/60 text-amber-400 font-rajdhani tracking-wide"
                  >
                    Catalyst
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {SLOT_LABELS[item.slot] ?? item.slot} &middot; {item.boss}
              </p>
            </div>

            {/* DPS gain */}
            <span className="font-rajdhani text-sm font-bold text-green-gain shrink-0 tracking-wide">
              {formatDps(item.dpsGain)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const [importString, setImportString] = useState("");
  const [payload, setPayload] = useState<DroprPayload | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setStatus("loading");
    setError("");
    setImportString("");
    setPayload(null);
    setCopied(false);

    const reportId = extractReportId(url);
    if (!reportId) {
      setError(
        "Could not find a report ID in that URL. Paste a full Raidbots droptimizer URL."
      );
      setStatus("error");
      return;
    }

    try {
      const data = await fetchAndParse(reportId);
      const str = generateImportString(data);
      setPayload(data);
      setImportString(str);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(importString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // browser blocked — user can manually select the string
    }
  }

  const dungeonEntries = payload
    ? Object.entries(payload.dungeons).sort(
        ([, a], [, b]) =>
          (b.items[0]?.dpsGain ?? 0) - (a.items[0]?.dpsGain ?? 0)
      )
    : [];

  return (
    <div className="relative z-10 min-h-screen max-w-[860px] mx-auto px-6 py-16 pb-20">
      {/* Header */}
      <header className="text-center mb-14">
        <h1
          className="font-cinzel font-bold tracking-widest"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.2rem)",
            background:
              "linear-gradient(135deg, var(--wow-gold) 0%, #ffe08a 50%, var(--wow-gold) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Dropr
        </h1>
        <div
          className="mx-auto mt-5 mb-0"
          style={{
            width: 120,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, var(--wow-gold-dim), transparent)",
          }}
        />
        <p className="mt-5 text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
          Raidbots Droptimizer &rarr; In-Game Reminder
        </p>
      </header>

      {/* URL Input */}
      <div className="mb-8">
        <label
          htmlFor="rburl"
          className="block mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
        >
          Raidbots Droptimizer URL
        </label>
        <div className="flex gap-2.5">
          <Input
            id="rburl"
            type="url"
            placeholder="https://www.raidbots.com/simbot/report/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            disabled={status === "loading"}
            className="flex-1 h-11 bg-card border-border/60 text-foreground placeholder:text-muted-foreground focus-visible:border-primary font-rajdhani text-base"
          />
          <Button
            onClick={handleGenerate}
            disabled={status === "loading" || !url.trim()}
            className="font-cinzel text-[13px] tracking-widest h-11 px-6 bg-primary hover:bg-primary/80"
          >
            {status === "loading" ? "Loading\u2026" : "Generate"}
          </Button>
        </div>

        {status === "loading" && (
          <p className="mt-3 text-sm text-muted-foreground">
            Fetching report from Raidbots\u2026
          </p>
        )}
        {status === "error" && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Results */}
      {status === "done" && payload && (
        <div className="mt-10">
          {/* Import string */}
          <p className="mb-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground font-cinzel">
            Import String
          </p>
          <div className="bg-card border border-border/60 rounded-lg px-4 py-3.5 mb-2">
            <p className="font-mono text-[12px] text-primary break-all leading-relaxed select-all">
              {importString}
            </p>
          </div>

          {/* Copy row */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <p className="text-[13px] text-muted-foreground">
              In-game:{" "}
              <code className="bg-card border border-border/60 rounded px-2 py-0.5 font-mono text-[12px] text-primary">
                /dropr import
              </code>{" "}
              then paste
            </p>
            <Button
              variant="outline"
              onClick={handleCopy}
              className={cn(
                "font-rajdhani font-semibold tracking-wide h-9",
                copied && "border-[var(--wow-green)] text-[var(--wow-green)]"
              )}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>

          <Separator className="mb-6 bg-border/60" />

          {/* Char info */}
          <div className="flex items-center gap-4 mb-7 px-4 py-3.5 bg-card border border-border/40 rounded-lg">
            <span className="font-cinzel text-lg text-gold">{payload.char}</span>
            <span className="text-border/60">·</span>
            <span className="text-sm text-muted-foreground capitalize tracking-wide">
              {payload.spec}
            </span>
            <span className="text-border/60">·</span>
            <Badge variant="secondary" className="font-rajdhani text-xs tracking-wide">
              {Object.keys(payload.dungeons).length} dungeon
              {Object.keys(payload.dungeons).length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Section label */}
          <p className="mb-4 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground font-cinzel">
            All Upgrades &ge;100 DPS &mdash; sorted by best upgrade
          </p>

          {/* Dungeon grid */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            }}
          >
            {dungeonEntries.map(([id, dungeon]) => (
              <DungeonCard key={id} instanceId={id} dungeon={dungeon} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center mt-16 text-[11px] text-muted-foreground tracking-widest uppercase">
        Not affiliated with Raidbots or Blizzard Entertainment.
      </footer>
    </div>
  );
}
