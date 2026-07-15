const USER_AGENT = "mcp-immo-france/0.1 (+https://github.com/zeddparis/mcp-immo-france)";

interface CacheEntry {
  at: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 60;

function cacheGet(key: string, ttlMs: number): unknown | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit) cache.delete(key);
  return undefined;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    // Drop the oldest entry to bound memory (commune CSVs can be several MB).
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

async function request(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function fetchJson<T>(url: string, ttlMs = 5 * 60_000): Promise<T> {
  const cached = cacheGet(url, ttlMs);
  if (cached !== undefined) return cached as T;
  const res = await request(url);
  const data = (await res.json()) as T;
  cacheSet(url, data);
  return data;
}

export async function fetchText(url: string, ttlMs = 6 * 60 * 60_000): Promise<string> {
  const cached = cacheGet(url, ttlMs);
  if (cached !== undefined) return cached as string;
  const res = await request(url);
  const text = await res.text();
  cacheSet(url, text);
  return text;
}
