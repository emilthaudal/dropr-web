"use client";

import { useState } from "react";
import {
  extractReportId,
  fetchAndParse,
  generateImportString,
  DroprPayload,
  DroprDungeon,
} from "@/lib/raidbots";

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
    <div className="dungeon-card">
      <div className="dungeon-header">
        <span className="dungeon-name">{dungeon.name}</span>
        <span className="dungeon-id">#{instanceId}</span>
      </div>
      <div className="item-list">
        {dungeon.items.map((item, i) => (
          <div key={item.id} className="item-row">
            <span className="item-rank">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="item-icon"
              src={`https://wow.zamimg.com/images/wow/icons/medium/${item.icon}.jpg`}
              alt={item.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://wow.zamimg.com/images/wow/icons/medium/inv_misc_questionmark.jpg";
              }}
            />
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              <span className="item-meta">
                {SLOT_LABELS[item.slot] ?? item.slot} &middot; {item.boss}
              </span>
            </div>
            <span className="item-gain">{formatDps(item.dpsGain)}</span>
          </div>
        ))}
      </div>
    </div>
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Rajdhani:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #0a0b0d;
          --surface:   #111318;
          --border:    #1e2330;
          --border-hi: #2e3650;
          --accent:    #4f8cff;
          --accent-dim:#2a4e99;
          --gold:      #c8a84b;
          --gold-dim:  #7a6028;
          --green:     #3ecf8e;
          --text:      #e2e8f0;
          --muted:     #64748b;
          --danger:    #f87171;
        }

        html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Rajdhani', sans-serif; font-size: 16px; line-height: 1.5; }

        body::before {
          content: '';
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.35;
          pointer-events: none;
        }

        .page {
          position: relative; z-index: 1;
          min-height: 100vh;
          max-width: 860px;
          margin: 0 auto;
          padding: 64px 24px 80px;
        }

        .header { text-align: center; margin-bottom: 56px; }
        .logo {
          font-family: 'Cinzel', serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 700;
          letter-spacing: 0.08em;
          background: linear-gradient(135deg, var(--gold) 0%, #ffe08a 50%, var(--gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .tagline {
          margin-top: 8px;
          font-size: 1rem;
          font-weight: 400;
          color: var(--muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .divider {
          width: 120px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
          margin: 20px auto 0;
        }

        .input-section { margin-bottom: 32px; }
        .field-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 8px;
        }
        .input-row { display: flex; gap: 10px; }
        .url-input {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--border-hi);
          border-radius: 6px;
          padding: 12px 16px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.95rem;
          color: var(--text);
          outline: none;
          transition: border-color 0.15s;
        }
        .url-input::placeholder { color: var(--muted); }
        .url-input:focus { border-color: var(--accent); }

        .btn {
          padding: 12px 24px;
          border-radius: 6px;
          border: none;
          font-family: 'Cinzel', serif;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .btn:active { transform: scale(0.97); }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent-dim), var(--accent));
          color: #fff;
        }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-copy {
          background: var(--surface);
          border: 1px solid var(--border-hi);
          color: var(--text);
          font-family: 'Rajdhani', sans-serif;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .btn-copy.copied { border-color: var(--green); color: var(--green); }

        .status-msg { margin-top: 12px; font-size: 0.9rem; font-weight: 500; }
        .status-loading { color: var(--muted); }
        .status-error { color: var(--danger); }

        .result-section { margin-top: 40px; }
        .section-title {
          font-family: 'Cinzel', serif;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        .import-box {
          background: var(--surface);
          border: 1px solid var(--border-hi);
          border-radius: 6px;
          padding: 14px 16px;
          margin-bottom: 8px;
        }
        .import-string {
          font-family: 'Courier New', monospace;
          font-size: 0.78rem;
          color: var(--accent);
          word-break: break-all;
          line-height: 1.5;
          user-select: all;
        }

        .copy-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }
        .copy-hint { font-size: 0.82rem; color: var(--muted); }
        .slash-cmd {
          display: inline-block;
          background: #1a1f2e;
          border: 1px solid var(--border-hi);
          border-radius: 4px;
          padding: 2px 8px;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
          color: var(--accent);
        }

        .char-info {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
          padding: 14px 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .char-name { font-family: 'Cinzel', serif; font-size: 1.1rem; color: var(--gold); }
        .char-spec { font-size: 0.85rem; color: var(--muted); text-transform: capitalize; letter-spacing: 0.04em; }
        .char-sep { color: var(--border-hi); }

        .dungeon-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 16px;
        }

        .dungeon-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .dungeon-card:hover { border-color: var(--border-hi); }

        .dungeon-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #0d1018;
          border-bottom: 1px solid var(--border);
        }
        .dungeon-name {
          font-family: 'Cinzel', serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--gold);
          letter-spacing: 0.04em;
        }
        .dungeon-id { font-size: 0.7rem; color: var(--muted); font-family: monospace; }

        .item-list { padding: 6px 0; }
        .item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-bottom: 1px solid var(--border);
          transition: background 0.1s;
        }
        .item-row:last-child { border-bottom: none; }
        .item-row:hover { background: rgba(255,255,255,0.02); }

        .item-rank { font-size: 0.7rem; font-weight: 700; color: var(--muted); width: 14px; flex-shrink: 0; text-align: center; }
        .item-icon { width: 32px; height: 32px; border-radius: 4px; border: 1px solid var(--border-hi); flex-shrink: 0; }
        .item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .item-name { font-size: 0.88rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-meta { font-size: 0.75rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-gain { font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--green); flex-shrink: 0; letter-spacing: 0.02em; }

        .footer { text-align: center; margin-top: 64px; font-size: 0.75rem; color: var(--muted); letter-spacing: 0.06em; }
      `}</style>

      <div className="page">
        <header className="header">
          <div className="logo">Dropr</div>
          <div className="divider" />
          <p className="tagline">Raidbots Droptimizer → In-Game Reminder</p>
        </header>

        <div className="input-section">
          <label className="field-label" htmlFor="rburl">
            Raidbots Droptimizer URL
          </label>
          <div className="input-row">
            <input
              id="rburl"
              className="url-input"
              type="url"
              placeholder="https://www.raidbots.com/simbot/report/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={status === "loading"}
            />
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={status === "loading" || !url.trim()}
            >
              {status === "loading" ? "Loading…" : "Generate"}
            </button>
          </div>
          {status === "loading" && (
            <p className="status-msg status-loading">
              Fetching report from Raidbots…
            </p>
          )}
          {status === "error" && (
            <p className="status-msg status-error">{error}</p>
          )}
        </div>

        {status === "done" && payload && (
          <div className="result-section">
            <p className="section-title">Import String</p>
            <div className="import-box">
              <div className="import-string">{importString}</div>
            </div>
            <div className="copy-row">
              <p className="copy-hint">
                In-game: <span className="slash-cmd">/dropr import</span> then
                paste
              </p>
              <button
                className={`btn btn-copy${copied ? " copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>

            <div className="char-info">
              <span className="char-name">{payload.char}</span>
              <span className="char-sep">·</span>
              <span className="char-spec">{payload.spec}</span>
              <span className="char-sep">·</span>
              <span className="char-spec">
                {Object.keys(payload.dungeons).length} dungeon
                {Object.keys(payload.dungeons).length !== 1 ? "s" : ""}
              </span>
            </div>

            <p className="section-title">
              Top 3 Items Per Dungeon — sorted by best upgrade
            </p>
            <div className="dungeon-grid">
              {dungeonEntries.map(([id, dungeon]) => (
                <DungeonCard key={id} instanceId={id} dungeon={dungeon} />
              ))}
            </div>
          </div>
        )}

        <footer className="footer">
          Not affiliated with Raidbots or Blizzard Entertainment.
        </footer>
      </div>
    </>
  );
}
