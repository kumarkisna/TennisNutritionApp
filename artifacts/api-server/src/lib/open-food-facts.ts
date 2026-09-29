const API_ORIGIN = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_en,brands,nutriments";
const SEARCH_LIMIT_PER_MINUTE = 8;
const PRODUCT_LIMIT_PER_MINUTE = 12;
const CACHE_LIFETIME_MS = 5 * 60 * 1000;

export type DiscoveredFood = {
  code: string;
  name: string;
  brand?: string;
  sourceUrl: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  fiberKnown: boolean;
};

export class FoodSourceRateLimitError extends Error {}
export class FoodSourceUnavailableError extends Error {}

const searchCache = new Map<string, { expiresAt: number; products: DiscoveredFood[] }>();
const searchRequests: number[] = [];
const productRequests: number[] = [];

function reserveRequest(timestamps: number[], limit: number): void {
  const now = Date.now();
  while (timestamps.length && timestamps[0] <= now - 60_000) timestamps.shift();
  if (timestamps.length >= limit) {
    throw new FoodSourceRateLimitError("Food search is busy. Try again in a minute.");
  }
  timestamps.push(now);
}

function numeric(value: unknown, max: number): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeProduct(raw: unknown): DiscoveredFood | null {
  if (!raw || typeof raw !== "object") return null;
  const product = raw as Record<string, unknown>;
  const code = typeof product.code === "string" ? product.code : "";
  const nameValue = product.product_name || product.product_name_en;
  const name = typeof nameValue === "string" ? nameValue.trim().slice(0, 120) : "";
  if (!/^\d{6,20}$/.test(code) || !name) return null;
  const nutrients =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};
  const kcal = numeric(nutrients["energy-kcal_100g"], 1000);
  const energyKj = numeric(nutrients.energy_100g, 4184);
  const calories = kcal ?? (energyKj === null ? null : energyKj / 4.184);
  const protein = numeric(nutrients.proteins_100g, 100);
  const carbs = numeric(nutrients.carbohydrates_100g, 100);
  const fat = numeric(nutrients.fat_100g, 100);
  if (calories === null || protein === null || carbs === null || fat === null) {
    return null;
  }
  const fiber = numeric(nutrients.fiber_100g, 100);
  const brand = typeof product.brands === "string" ? product.brands.trim().slice(0, 100) : "";
  return {
    code,
    name,
    ...(brand ? { brand } : {}),
    sourceUrl: `${API_ORIGIN}/product/${code}`,
    caloriesPer100g: round1(calories),
    proteinPer100g: round1(protein),
    carbsPer100g: round1(carbs),
    fatPer100g: round1(fat),
    fiberPer100g: fiber === null ? 0 : round1(fiber),
    fiberKnown: fiber !== null,
  };
}

async function fetchSource(url: URL, appOrigin: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": `ClearAccessFoodPlanner/1.0 (${appOrigin})`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new FoodSourceUnavailableError("The food database is temporarily unavailable.");
  }
  if (response.status === 429) {
    throw new FoodSourceRateLimitError("Food search is busy. Try again in a minute.");
  }
  if (!response.ok) {
    throw new FoodSourceUnavailableError("The food database is temporarily unavailable.");
  }
  try {
    return await response.json();
  } catch {
    throw new FoodSourceUnavailableError("The food database sent an unreadable response.");
  }
}

export async function discoverFoods(search: string, appOrigin: string): Promise<DiscoveredFood[]> {
  const key = search.trim().toLocaleLowerCase();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.products;

  reserveRequest(searchRequests, SEARCH_LIMIT_PER_MINUTE);
  const url = new URL("/cgi/search.pl", API_ORIGIN);
  url.searchParams.set("search_terms", search.trim());
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "40");
  url.searchParams.set("fields", FIELDS);
  const result = await fetchSource(url, appOrigin);
  if (!result || typeof result !== "object" || !Array.isArray((result as { products?: unknown }).products)) {
    throw new FoodSourceUnavailableError("The food database sent an unreadable response.");
  }

  const byCode = new Map<string, DiscoveredFood>();
  for (const raw of (result as { products: unknown[] }).products) {
    const product = normalizeProduct(raw);
    if (product) byCode.set(product.code, product);
  }
  const products = [...byCode.values()].slice(0, 24);
  if (searchCache.size >= 120) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, { expiresAt: Date.now() + CACHE_LIFETIME_MS, products });
  return products;
}

export async function findFoodByCode(code: string, appOrigin: string): Promise<DiscoveredFood | null> {
  for (const cached of searchCache.values()) {
    if (cached.expiresAt <= Date.now()) continue;
    const product = cached.products.find((item) => item.code === code);
    if (product) return product;
  }

  reserveRequest(productRequests, PRODUCT_LIMIT_PER_MINUTE);
  const url = new URL(`/api/v2/product/${code}.json`, API_ORIGIN);
  url.searchParams.set("fields", FIELDS);
  const result = await fetchSource(url, appOrigin);
  if (!result || typeof result !== "object") {
    throw new FoodSourceUnavailableError("The food database sent an unreadable response.");
  }
  return normalizeProduct((result as { product?: unknown }).product);
}