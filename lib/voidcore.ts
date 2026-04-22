// lib/voidcore.ts
// Parses one or two Raidbots droptimizer reports (M+ and/or Raid) and ranks
// roll opportunities by simulated DPS gain per Voidcore spent.
//
// Voidcore costs:
//   M+   — 1 voidcore per dungeon (rolls the entire dungeon pool)
//   Raid — 2 voidcores per boss
//
// All processing is client-side — no server required.

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface VoidcoreItem {
  id: number;
  name: string;
  icon: string;
  slot: string;
  ilvl: number;
  dpsGain: number;
  isCatalyst: boolean;
  bossName?: string; // populated for raid targets; for M+ it's the boss within the dungeon
}

export interface RollTarget {
  key: string; // e.g. "mplus-1315" or "raid-1308-2740"
  reportType: "mplus" | "raid";
  instanceId: number;
  instanceName: string;
  encounterId?: number; // raid only
  bossName?: string; // raid only
  voidcoreCost: 1 | 2;
  topItem: VoidcoreItem;
  allItems: VoidcoreItem[]; // sorted by dpsGain desc
  dpsPerVoidcore: number; // topItem.dpsGain / voidcoreCost
  avgDpsPerVoidcore: number; // average dpsGain across all items / voidcoreCost
}

export interface VoidcoreAdvisorResult {
  char: string;
  spec: string;
  reportType: "mplus" | "raid";
  targets: RollTarget[]; // sorted by dpsPerVoidcore desc
}

// ---------------------------------------------------------------------------
// Internal Raidbots data types
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
  type: string;
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
      rawFormData?: {
        droptimizer?: {
          difficulty?: string;
        };
      };
    };
  };
}

// ---------------------------------------------------------------------------
// URL parsing (re-exported for convenience)
// ---------------------------------------------------------------------------

export function extractReportId(url: string): string | null {
  const match = url.match(/raidbots\.com\/simbot\/report\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectReportType(data: RBData): "mplus" | "raid" {
  const difficulty =
    data.simbot?.meta?.rawFormData?.droptimizer?.difficulty ?? "";
  if (difficulty.startsWith("raid-")) return "raid";
  return "mplus";
}

// ---------------------------------------------------------------------------
// Core parsing
// ---------------------------------------------------------------------------

function parseReport(data: RBData): VoidcoreAdvisorResult {
  const reportType = detectReportType(data);

  const profilesetMetric = data.sim.options?.profileset_metric ?? "dps";
  const baseline =
    profilesetMetric === "raid_dps"
      ? (data.sim.statistics?.raid_dps?.mean ??
        data.sim.players[0].collected_data.dps.mean)
      : data.sim.players[0].collected_data.dps.mean;

  const results = data.sim.profilesets.results;
  const itemLibrary = data.simbot.meta.itemLibrary;
  const instanceLibrary = data.simbot.meta.instanceLibrary;

  // Build lookup maps
  const itemMap = new Map<number, RBItem>();
  const catalystSources = new Map<number, Set<number>>(); // itemId → real instanceIds

  for (const item of itemLibrary) {
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
        if (src.instanceId > 0) set.add(src.instanceId);
      }
    }
  }

  const instanceMap = new Map<number, RBInstance>();
  for (const inst of instanceLibrary) {
    instanceMap.set(inst.id, inst);
  }

  // For M+: accumulate best VoidcoreItem per (instanceId, itemId)
  // key = instanceId (dungeon)
  // For Raid: accumulate best VoidcoreItem per (instanceId:encounterId, itemId)
  // key = `${instanceId}:${encounterId}`

  // targetItems: targetKey → Map<itemId, VoidcoreItem>  (filtered: dpsGain >= 100)
  const targetItems = new Map<string, Map<number, VoidcoreItem>>();
  // allSimmedItems: targetKey → Map<itemId, best raw dpsGain (unclamped)>
  // Tracks ALL simmed items regardless of the >= 100 filter, used for avg calculation.
  const allSimmedItems = new Map<string, Map<number, number>>();
  // targetMeta: targetKey → { instanceId, encounterId?, instanceName, bossName? }
  const targetMeta = new Map<
    string,
    {
      instanceId: number;
      instanceName: string;
      encounterId?: number;
      bossName?: string;
    }
  >();

  const upsert = (
    targetKey: string,
    itemId: number,
    entry: VoidcoreItem,
    meta: {
      instanceId: number;
      instanceName: string;
      encounterId?: number;
      bossName?: string;
    }
  ) => {
    if (!targetItems.has(targetKey)) {
      targetItems.set(targetKey, new Map());
    }
    if (!targetMeta.has(targetKey)) {
      targetMeta.set(targetKey, meta);
    }
    const existing = targetItems.get(targetKey)!;
    const prev = existing.get(itemId);
    if (!prev || entry.dpsGain > prev.dpsGain) {
      existing.set(itemId, entry);
    }
  };

  // Track all simmed items for avg calculation (regardless of the >= 100 filter).
  // Keeps the best (highest) raw dpsGain per itemId per targetKey.
  const upsertSimmed = (targetKey: string, itemId: number, rawDpsGain: number) => {
    if (!allSimmedItems.has(targetKey)) {
      allSimmedItems.set(targetKey, new Map());
    }
    const existing = allSimmedItems.get(targetKey)!;
    const prev = existing.get(itemId);
    if (prev === undefined || rawDpsGain > prev) {
      existing.set(itemId, rawDpsGain);
    }
  };

  for (const result of results) {
    const parts = result.name.split("/");
    if (parts.length < 7) continue;

    const nameInstanceId = parseInt(parts[0], 10);
    const nameEncounterId = parseInt(parts[1], 10);
    const itemId = parseInt(parts[3], 10);
    const ilvl = parseInt(parts[4], 10) || 0;
    const slot = parts[6];
    if (!itemId || !slot) continue;

    const dpsGain = Math.round(result.mean - baseline);

    const item = itemMap.get(itemId);
    if (!item) continue;

    const isCatalyst = catalystSources.has(itemId);

    if (reportType === "raid") {
      // Raid: instanceId and encounterId come directly from the profileset name
      if (nameInstanceId <= 0 || nameEncounterId <= 0) continue;

      const instance = instanceMap.get(nameInstanceId);
      if (!instance) continue;

      const encounter = instance.encounters.find(
        (e) => e.id === nameEncounterId
      );
      const bossName = encounter?.name ?? "Unknown Boss";

      if (isCatalyst) {
        // Catalyst in raid: the source item drops from a boss — use sourceItem sources
        const sourceInstanceIds = catalystSources.get(itemId)!;
        for (const srcInstanceId of sourceInstanceIds) {
          const srcInstance = instanceMap.get(srcInstanceId);
          if (!srcInstance) continue;
          // Find which encounter(s) the source item drops from
          for (const src of item.sourceItem?.sources ?? []) {
            if (src.instanceId !== srcInstanceId) continue;
            const srcEncounter = srcInstance.encounters.find(
              (e) => e.id === src.encounterId
            );
            const srcBoss = srcEncounter?.name ?? "Unknown Boss";
            const targetKey = `raid-${srcInstanceId}-${src.encounterId}`;
            upsertSimmed(targetKey, itemId, dpsGain);
            if (dpsGain >= 100) {
              upsert(
                targetKey,
                itemId,
                {
                  id: itemId,
                  name: item.name,
                  icon: item.icon,
                  slot,
                  ilvl,
                  dpsGain,
                  isCatalyst: true,
                  bossName: srcBoss,
                },
                {
                  instanceId: srcInstanceId,
                  instanceName: srcInstance.name,
                  encounterId: src.encounterId,
                  bossName: srcBoss,
                }
              );
            }
          }
        }
      } else {
        const targetKey = `raid-${nameInstanceId}-${nameEncounterId}`;
        upsertSimmed(targetKey, itemId, dpsGain);
        if (dpsGain >= 100) {
          upsert(
            targetKey,
            itemId,
            {
              id: itemId,
              name: item.name,
              icon: item.icon,
              slot,
              ilvl,
              dpsGain,
              isCatalyst: false,
              bossName,
            },
            {
              instanceId: nameInstanceId,
              instanceName: instance.name,
              encounterId: nameEncounterId,
              bossName,
            }
          );
        }
      }
    } else {
      // M+: profileset name has -1/-1 for instance/encounter.
      // Attribute via item.sources (or sourceItem.sources for catalysts).
      if (isCatalyst) {
        const sourceInstanceIds = catalystSources.get(itemId)!;
        for (const srcInstanceId of sourceInstanceIds) {
          const srcInstance = instanceMap.get(srcInstanceId);
          if (!srcInstance) continue;
          const targetKey = `mplus-${srcInstanceId}`;
          upsertSimmed(targetKey, itemId, dpsGain);
          if (dpsGain >= 100) {
            upsert(
              targetKey,
              itemId,
              {
                id: itemId,
                name: item.name,
                icon: item.icon,
                slot,
                ilvl,
                dpsGain,
                isCatalyst: true,
              },
              {
                instanceId: srcInstanceId,
                instanceName: srcInstance.name,
              }
            );
          }
        }
      } else {
        for (const src of item.sources) {
          if (src.instanceId <= 0) continue;
          const srcInstance = instanceMap.get(src.instanceId);
          if (!srcInstance) continue;
          const encounter = srcInstance.encounters.find(
            (e) => e.id === src.encounterId
          );
          const targetKey = `mplus-${src.instanceId}`;
          upsertSimmed(targetKey, itemId, dpsGain);
          if (dpsGain >= 100) {
            upsert(
              targetKey,
              itemId,
              {
                id: itemId,
                name: item.name,
                icon: item.icon,
                slot,
                ilvl,
                dpsGain,
                isCatalyst: false,
                bossName: encounter?.name,
              },
              {
                instanceId: src.instanceId,
                instanceName: srcInstance.name,
              }
            );
          }
        }
      }
    }
  }

  // Build RollTargets
  const voidcoreCost: 1 | 2 = reportType === "mplus" ? 1 : 2;
  const targets: RollTarget[] = [];

  for (const [targetKey, itemsMap] of targetItems.entries()) {
    const meta = targetMeta.get(targetKey)!;
    const allItems = Array.from(itemsMap.values()).sort(
      (a, b) => b.dpsGain - a.dpsGain
    );
    const topItem = allItems[0];
    // avgDps: expected value per roll = sum of clamped gains over ALL simmed items
    // (including those that didn't pass the >= 100 filter, treated as 0).
    const simmedForTarget = allSimmedItems.get(targetKey);
    const avgDps = simmedForTarget && simmedForTarget.size > 0
      ? Array.from(simmedForTarget.values()).reduce((sum, g) => sum + Math.max(0, g), 0) / simmedForTarget.size
      : allItems.reduce((sum, it) => sum + it.dpsGain, 0) / allItems.length;
    targets.push({
      key: targetKey,
      reportType,
      instanceId: meta.instanceId,
      instanceName: meta.instanceName,
      encounterId: meta.encounterId,
      bossName: meta.bossName,
      voidcoreCost,
      topItem,
      allItems,
      dpsPerVoidcore: Math.round(topItem.dpsGain / voidcoreCost),
      avgDpsPerVoidcore: Math.round(avgDps / voidcoreCost),
    });
  }

  targets.sort((a, b) => b.avgDpsPerVoidcore - a.avgDpsPerVoidcore);

  return {
    char: data.simbot.meta.player,
    spec: data.simbot.meta.spec,
    reportType,
    targets,
  };
}

// ---------------------------------------------------------------------------
// Public fetch function
// ---------------------------------------------------------------------------

export async function fetchAndParseForVoidcore(
  reportId: string
): Promise<VoidcoreAdvisorResult> {
  const url = `https://www.raidbots.com/reports/${reportId}/data.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch report: ${res.status} ${res.statusText}`);
  }
  const data: RBData = await res.json();
  return parseReport(data);
}

// ---------------------------------------------------------------------------
// Merge two results (M+ + Raid) into a single sorted target list
// ---------------------------------------------------------------------------

export function mergeResults(
  a: VoidcoreAdvisorResult,
  b: VoidcoreAdvisorResult
): VoidcoreAdvisorResult {
  const merged = [...a.targets, ...b.targets].sort(
    (x, y) => y.avgDpsPerVoidcore - x.avgDpsPerVoidcore
  );
  return {
    char: a.char || b.char,
    spec: a.spec || b.spec,
    reportType: a.reportType, // mixed; caller should handle display
    targets: merged,
  };
}
