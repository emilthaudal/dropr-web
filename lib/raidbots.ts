// lib/raidbots.ts
// Fetches a Raidbots droptimizer report and generates a Dropr import string.
// All processing is client-side — no server required.

export interface DroprItem {
  id: number;
  name: string;
  slot: string;
  dpsGain: number;
  boss: string;
  icon: string;
}

export interface DroprDungeon {
  name: string;
  items: DroprItem[];
}

export interface DroprPayload {
  char: string;
  spec: string;
  importedAt: number;
  dungeons: Record<string, DroprDungeon>;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export function extractReportId(url: string): string | null {
  const match = url.match(/raidbots\.com\/simbot\/report\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Raidbots data types (minimal — only what we need)
// ---------------------------------------------------------------------------

interface RBSource {
  instanceId: number;
  encounterId: number;
}

interface RBItem {
  id: number;
  name: string;
  icon: string;
  sources: RBSource[];
}

interface RBEncounter {
  id: number;
  name: string;
}

interface RBInstance {
  id: number;
  name: string;
  encounters: RBEncounter[];
}

interface RBProfilesetResult {
  name: string;
  mean: number;
}

interface RBData {
  sim: {
    players: Array<{
      collected_data: { dps: { mean: number } };
    }>;
    profilesets: {
      results: RBProfilesetResult[];
    };
  };
  simbot: {
    meta: {
      player: string;
      spec: string;
      itemLibrary: RBItem[];
      instanceLibrary: RBInstance[];
    };
  };
}

// ---------------------------------------------------------------------------
// Core parsing logic
// ---------------------------------------------------------------------------

export async function fetchAndParse(reportId: string): Promise<DroprPayload> {
  const url = `https://www.raidbots.com/simbot/report/${reportId}/data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch report: ${res.status} ${res.statusText}`);
  }

  const data: RBData = await res.json();

  const baseline = data.sim.players[0].collected_data.dps.mean;
  const results = data.sim.profilesets.results;
  const itemLibrary = data.simbot.meta.itemLibrary;
  const instanceLibrary = data.simbot.meta.instanceLibrary;

  // Build fast lookup maps
  const itemMap = new Map<number, RBItem>();
  for (const item of itemLibrary) {
    itemMap.set(item.id, item);
  }

  const instanceMap = new Map<number, RBInstance>();
  for (const inst of instanceLibrary) {
    instanceMap.set(inst.id, inst);
  }

  // Accumulate best DPS gain per dungeon
  // dungeonItems: instanceId → Map<itemId, best DroprItem>
  const dungeonItems = new Map<number, Map<number, DroprItem>>();

  for (const result of results) {
    const parts = result.name.split("/");
    if (parts.length < 7) continue;

    const itemId = parseInt(parts[3], 10);
    const slot = parts[6];
    if (!itemId || !slot) continue;

    const dpsGain = Math.round(result.mean - baseline);
    if (dpsGain <= 0) continue;

    const item = itemMap.get(itemId);
    if (!item) continue;

    // Resolve real dungeon(s) from sources
    for (const src of item.sources) {
      if (src.instanceId <= 0) continue; // skip M+ pool (-1) and normal pool (-32)

      const instance = instanceMap.get(src.instanceId);
      if (!instance) continue;

      const encounter = instance.encounters.find((e) => e.id === src.encounterId);
      const bossName = encounter?.name ?? "Unknown Boss";

      if (!dungeonItems.has(src.instanceId)) {
        dungeonItems.set(src.instanceId, new Map());
      }
      const existing = dungeonItems.get(src.instanceId)!;

      // Keep only the highest DPS gain entry per itemId per dungeon
      const prev = existing.get(itemId);
      if (!prev || dpsGain > prev.dpsGain) {
        existing.set(itemId, {
          id: itemId,
          name: item.name,
          slot,
          dpsGain,
          boss: bossName,
          icon: item.icon,
        });
      }
    }
  }

  // Build final payload: top 3 per dungeon sorted by dpsGain desc
  const dungeons: Record<string, DroprDungeon> = {};

  for (const [instanceId, itemsMap] of dungeonItems.entries()) {
    const instance = instanceMap.get(instanceId);
    if (!instance) continue;

    const sorted = Array.from(itemsMap.values()).sort(
      (a, b) => b.dpsGain - a.dpsGain
    );

    dungeons[String(instanceId)] = {
      name: instance.name,
      items: sorted.slice(0, 3),
    };
  }

  return {
    char: data.simbot.meta.player,
    spec: data.simbot.meta.spec,
    importedAt: Math.floor(Date.now() / 1000),
    dungeons,
  };
}

// ---------------------------------------------------------------------------
// Import string generation
// ---------------------------------------------------------------------------

export function generateImportString(payload: DroprPayload): string {
  return btoa(JSON.stringify(payload));
}
