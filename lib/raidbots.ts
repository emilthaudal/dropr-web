// lib/raidbots.ts
// Fetches a Raidbots droptimizer report and generates a Dropr import string.
// All processing is client-side — no server required.

export interface DroprItem {
  id: number;
  name: string;
  slot: string;
  ilvl: number;
  dpsGain: number;
  boss: string;
  icon: string;
  isCatalyst: boolean;
  bonusIds: number[]; // WoW bonus IDs encoding ilvl/upgrade track; [] if unavailable
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
  tags?: string[];
  bonusLists?: number[];
  sourceItem?: {
    sources?: RBSource[];
  };
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
    options?: {
      profileset_metric?: string;
    };
    statistics?: {
      raid_dps?: { mean: number };
    };
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
  const url = `https://www.raidbots.com/reports/${reportId}/data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch report: ${res.status} ${res.statusText}`);
  }

  const data: RBData = await res.json();

  // For Augmentation Evoker, Raidbots sims include a full party and the
  // profileset metric is "raid_dps" (total DPS of all players combined).
  // Using the Aug's personal DPS as the baseline produces garbage gains (~600k).
  // When the metric is "raid_dps", use sim.statistics.raid_dps.mean instead.
  const profilesetMetric = data.sim.options?.profileset_metric ?? "dps";
  const baseline =
    profilesetMetric === "raid_dps"
      ? (data.sim.statistics?.raid_dps?.mean ?? data.sim.players[0].collected_data.dps.mean)
      : data.sim.players[0].collected_data.dps.mean;
  const results = data.sim.profilesets.results;
  const itemLibrary = data.simbot.meta.itemLibrary;
  const instanceLibrary = data.simbot.meta.instanceLibrary;

  // Build fast lookup maps
  // Note: a single itemId can appear multiple times in itemLibrary when it has
  // multiple sourceItems (catalyst items from different source drops). We store
  // the first entry per id for basic info, but track ALL entries for catalyst
  // source dungeon resolution.
  const itemMap = new Map<number, RBItem>();
  // catalystSources: itemId → array of all real instanceIds from sourceItem.sources
  const catalystSources = new Map<number, Set<number>>();

  for (const item of itemLibrary) {
    // itemMap stores the first entry per id (for basic info like name/icon).
    // The catalyst detection MUST NOT be guarded by this check — an item can
    // appear multiple times in itemLibrary (once as a base drop, once with the
    // catalyst tag and sourceItem). We need to accumulate catalyst sources from
    // ALL entries, not just the first-seen one.
    if (!itemMap.has(item.id)) {
      itemMap.set(item.id, item);
    }

    const isCatalyst = Array.isArray(item.tags) && item.tags.includes("catalyst");
    if (isCatalyst && item.sourceItem?.sources) {
      if (!catalystSources.has(item.id)) {
        catalystSources.set(item.id, new Set());
      }
      const set = catalystSources.get(item.id)!;
      for (const src of item.sourceItem.sources) {
        if (src.instanceId > 0) {
          set.add(src.instanceId);
        }
      }
    }
  }

  const instanceMap = new Map<number, RBInstance>();
  for (const inst of instanceLibrary) {
    instanceMap.set(inst.id, inst);
  }

  // Accumulate best DPS gain per dungeon
  // dungeonItems: instanceId → Map<itemId, best DroprItem>
  const dungeonItems = new Map<number, Map<number, DroprItem>>();

  const upsert = (
    instanceId: number,
    itemId: number,
    entry: DroprItem
  ) => {
    if (!dungeonItems.has(instanceId)) {
      dungeonItems.set(instanceId, new Map());
    }
    const existing = dungeonItems.get(instanceId)!;
    const prev = existing.get(itemId);
    if (!prev || entry.dpsGain > prev.dpsGain) {
      existing.set(itemId, entry);
    }
  };

  for (const result of results) {
    // Profile name format: instanceId/encounterId/difficulty/itemId/ilvl/enchantId/slot///
    const parts = result.name.split("/");
    if (parts.length < 7) continue;

    const itemId = parseInt(parts[3], 10);
    const ilvl = parseInt(parts[4], 10) || 0;
    const slot = parts[6];
    if (!itemId || !slot) continue;

    const dpsGain = Math.round(result.mean - baseline);
    if (dpsGain < 100) continue;

    const item = itemMap.get(itemId);
    if (!item) continue;

    const isCatalyst = catalystSources.has(itemId);

    if (isCatalyst) {
      // Catalyst items: assign to each dungeon where a sourceItem drops
      const sourceInstanceIds = catalystSources.get(itemId)!;
      for (const srcInstanceId of sourceInstanceIds) {
        const instance = instanceMap.get(srcInstanceId);
        if (!instance) continue;

        // Boss is "Catalyst" since it comes from the catalyst forge, not a boss
        upsert(srcInstanceId, itemId, {
          id: itemId,
          name: item.name,
          slot,
          ilvl,
          dpsGain,
          boss: "Catalyst",
          icon: item.icon,
          isCatalyst: true,
          bonusIds: item.bonusLists ?? [],
        });
      }
    } else {
      // Normal items: resolve dungeon(s) from item.sources
      for (const src of item.sources) {
        if (src.instanceId <= 0) continue;

        const instance = instanceMap.get(src.instanceId);
        if (!instance) continue;

        const encounter = instance.encounters.find((e) => e.id === src.encounterId);
        const bossName = encounter?.name ?? "Unknown Boss";

        upsert(src.instanceId, itemId, {
          id: itemId,
          name: item.name,
          slot,
          ilvl,
          dpsGain,
          boss: bossName,
          icon: item.icon,
          isCatalyst: false,
          bonusIds: item.bonusLists ?? [],
        });
      }
    }
  }

  // Build final payload: all qualifying items per dungeon sorted by dpsGain desc
  const dungeons: Record<string, DroprDungeon> = {};

  for (const [instanceId, itemsMap] of dungeonItems.entries()) {
    const instance = instanceMap.get(instanceId);
    if (!instance) continue;

    // Slot deduplication: if a base item AND its catalyzed version (different
    // itemIds, same gear slot) both qualify, keep only the one with higher
    // dpsGain. Multiple distinct non-catalyst items occupying the same slot
    // type (e.g. two trinkets) are intentionally preserved.
    const catalystBySlot = new Map<string, DroprItem>();
    const nonCatalystBySlot = new Map<string, DroprItem[]>();
    for (const item of itemsMap.values()) {
      if (item.isCatalyst) {
        const prev = catalystBySlot.get(item.slot);
        if (!prev || item.dpsGain > prev.dpsGain) {
          catalystBySlot.set(item.slot, item);
        }
      } else {
        if (!nonCatalystBySlot.has(item.slot)) nonCatalystBySlot.set(item.slot, []);
        nonCatalystBySlot.get(item.slot)!.push(item);
      }
    }
    // Resolve catalyst vs non-catalyst conflicts per slot
    for (const [slot, catalyst] of catalystBySlot.entries()) {
      const nonCatalysts = nonCatalystBySlot.get(slot) ?? [];
      const bestNonCatalyst = nonCatalysts.reduce<DroprItem | undefined>(
        (best, item) => (!best || item.dpsGain > best.dpsGain ? item : best),
        undefined
      );
      if (bestNonCatalyst && bestNonCatalyst.dpsGain >= catalyst.dpsGain) {
        itemsMap.delete(catalyst.id);
      } else {
        for (const item of nonCatalysts) itemsMap.delete(item.id);
      }
    }

    const sorted = Array.from(itemsMap.values()).sort(
      (a, b) => b.dpsGain - a.dpsGain
    );

    dungeons[String(instanceId)] = {
      name: instance.name,
      items: sorted,
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
