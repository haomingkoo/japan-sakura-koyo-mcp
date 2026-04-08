import { logger } from "./logger.js";

const USER_AGENT = "japan-sakura-koyo-mcp/0.1.0";
const FETCH_TIMEOUT_MS = 10_000; // 10 second timeout per request
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

// Simple rate limiter: max N outbound requests per second
const OUTBOUND_RATE_LIMIT = 5; // max 5 upstream API calls per second
let outboundCount = 0;
let outboundResetAt = 0;

async function waitForOutboundSlot(): Promise<void> {
  const now = Date.now();
  if (now > outboundResetAt) {
    outboundCount = 0;
    outboundResetAt = now + 1000;
  }
  if (outboundCount >= OUTBOUND_RATE_LIMIT) {
    const waitMs = outboundResetAt - now;
    await new Promise((r) => setTimeout(r, waitMs));
    outboundCount = 0;
    outboundResetAt = Date.now() + 1000;
  }
  outboundCount++;
}

/**
 * Fetch with timeout, retry, and outbound rate limiting.
 * Use this for ALL upstream API calls.
 */
export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  await waitForOutboundSlot();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          ...options?.headers,
        },
      });

      if (res.ok) return res;

      // Don't retry client errors (4xx)
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`API error ${res.status}: ${res.statusText} (${url})`);
      }

      // Server error (5xx) — retry
      lastError = new Error(`API error ${res.status}: ${res.statusText}`);
      logger.warn(`Upstream ${res.status} on attempt ${attempt + 1} for ${url}`);
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        lastError = new Error(`Upstream timeout after ${FETCH_TIMEOUT_MS}ms: ${url}`);
        logger.warn(`Timeout on attempt ${attempt + 1} for ${url}`);
      } else if (e.message?.includes("API error")) {
        throw e; // Don't retry 4xx
      } else {
        lastError = e;
        logger.warn(`Fetch error on attempt ${attempt + 1}: ${e.message}`);
      }
    }

    // Wait before retry
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
