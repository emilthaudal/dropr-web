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
import { Card } from "@/components/ui/card";
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
    <Card className="overflow-hidden rounded-lg border border-border bg-card p-0 gap-0 shadow-none">
      {/* Dungeon header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border">
        <span className="text-sm font-semibold text-foreground">
          {dungeon.name}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          #{instanceId}
        </span>
      </div>

      {/* Item list */}
      <div className="divide-y divide-border">
        {dungeon.items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-accent/40 transition-colors"
          >
            {/* Rank */}
            <span className="text-[11px] font-medium text-muted-foreground w-3.5 text-center shrink-0">
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
                    className="shrink-0 text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-400 tracking-wide"
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
            <span className="font-mono text-sm font-semibold text-gain shrink-0">
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
    <div className="relative min-h-screen max-w-[860px] mx-auto px-6 py-16 pb-20">
      {/* Header */}
      <header className="text-center mb-14">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          Dropr
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Raidbots Droptimizer &rarr; In-Game Reminder
        </p>
      </header>

      {/* URL Input */}
      <div className="mb-8">
        <label
          htmlFor="rburl"
          className="block mb-2 text-sm font-medium text-foreground"
        >
          Raidbots Droptimizer URL
        </label>
        <div className="flex gap-2">
          <Input
            id="rburl"
            type="url"
            placeholder="https://www.raidbots.com/simbot/report/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            disabled={status === "loading"}
            className="flex-1 h-10 bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
          />
          <Button
            onClick={handleGenerate}
            disabled={status === "loading" || !url.trim()}
            className="h-10 px-5 font-medium"
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
          <p className="mb-2 text-sm font-medium text-foreground">
            Import String
          </p>
          <div className="bg-card border border-border rounded-lg px-4 py-3.5 mb-2">
            <p className="font-mono text-[12px] text-muted-foreground break-all leading-relaxed select-all">
              {importString}
            </p>
          </div>

          {/* Copy row */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <p className="text-sm text-muted-foreground">
              In-game:{" "}
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                /dropr import
              </code>{" "}
              then paste
            </p>
            <Button
              variant="outline"
              onClick={handleCopy}
              className={cn(
                "h-9 text-sm font-medium",
                copied && "border-green-600 text-green-500"
              )}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>

          <Separator className="mb-6" />

          {/* Char info */}
          <div className="flex items-center gap-3 mb-7">
            <span className="text-base font-semibold text-foreground">{payload.char}</span>
            <span className="text-border">·</span>
            <span className="text-sm text-muted-foreground capitalize">
              {payload.spec}
            </span>
            <span className="text-border">·</span>
            <Badge variant="secondary" className="text-xs">
              {Object.keys(payload.dungeons).length} dungeon
              {Object.keys(payload.dungeons).length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Section label */}
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            All upgrades &ge;100 DPS, sorted by best upgrade
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
      <footer className="text-center mt-16 text-xs text-muted-foreground">
        Not affiliated with Raidbots or Blizzard Entertainment.
      </footer>
    </div>
  );
}
