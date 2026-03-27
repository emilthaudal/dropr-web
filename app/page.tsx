"use client";

import { useState, useEffect, useCallback } from "react";
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
// HelpModal
// ---------------------------------------------------------------------------
const STEPS = [
  {
    n: "1",
    title: "Run a Droptimizer on Raidbots",
    body: 'Go to raidbots.com, run a Droptimizer sim for your character. Make sure "Mythic+" is included in the sim options so dungeon loot is covered.',
  },
  {
    n: "2",
    title: "Paste the report URL here",
    body: "Copy the URL of your finished Raidbots report and paste it into the input on this page, then click Generate.",
  },
  {
    n: "3",
    title: "Copy the import string",
    body: 'Click "Copy to Clipboard" to copy your personal import string. This encodes all your dungeon upgrade data.',
  },
  {
    n: "4",
    title: "Import in-game",
    body: 'Open the import window with /dropr import and paste the string, then click Confirm. You can also run /dropr import <string> directly in chat.',
  },
  {
    n: "5",
    title: "Zone into a dungeon",
    body: "Dropr will automatically show a reminder frame with your top upgrade items whenever you enter a tracked M+ dungeon. No setup needed.",
  },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to use Dropr"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            How to use Dropr
          </h2>
          <button
            onClick={onClose}
            aria-label="Close help"
            className="text-muted-foreground hover:text-foreground transition-colors rounded p-1 -mr-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <ol className="px-6 py-5 space-y-5">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-mono text-[11px] font-semibold text-primary mt-0.5">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground leading-snug">
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Dropr is a free, open-source addon.{" "}
            <a
              href="https://github.com/emilthaudal/Dropr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const [helpOpen, setHelpOpen] = useState(false);

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
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* Top-right nav cluster */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5">
        {/* Wago install link */}
        <a
          href="https://addons.wago.io/addons/dropr"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Install on Wago"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wago-logo.svg" alt="" width={13} height={13} className="shrink-0" style={{ filter: "brightness(0) invert(0.6)" }} />
          Install on Wago
        </a>

        {/* CurseForge install link */}
        <a
          href="https://www.curseforge.com/wow/addons/dropr"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Install on CurseForge"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/curseforge.webp" alt="" width={13} height={13} className="shrink-0" style={{ filter: "brightness(0) invert(0.6)" }} />
          Install on CurseForge
        </a>

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* How it works */}
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67C6.223 4.703 7.033 4.25 8 4.25c1.6 0 2.75 1.082 2.75 2.5 0 1.008-.615 1.7-1.25 2.113v.637a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75c.546 0 1.25-.45 1.25-1 0-.786-.7-1.25-1.25-1.25-.474 0-.83.174-1.08.585ZM8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          How it works
        </button>
      </div>

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
          <div className="bg-card border border-border rounded-lg px-4 py-3.5 mb-2 overflow-hidden">
            <p className="font-mono text-[12px] text-muted-foreground leading-relaxed select-all">
              {importString.slice(0, 80)}
              <span className="opacity-40">{importString.slice(80)}</span>
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
