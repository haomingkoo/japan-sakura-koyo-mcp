#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer } from "http";
import { logger } from "./lib/logger.js";
import {
  getSakuraForecast,
  getSakuraSpots,
  getKawazuForecast,
  findCities,
  findBestRegions,
  findPrefCode,
  getAvailablePrefectures,
  formatDate,
  type SakuraCity,
} from "./lib/sakura-forecast.js";
import { getKoyoForecast, getKoyoSpots, formatDate as formatKoyoDate } from "./lib/koyo.js";
import { getWeatherForecast } from "./lib/weather.js";
import { WEATHER_CITY_IDS } from "./lib/areas.js";

// ─── Shared tool & prompt registration ───────────────────────────────────────

function registerAllTools(server: McpServer) {

  // ── Prompt: plan_sakura_trip ──

  server.prompt(
    "plan_sakura_trip",
    "Guide for planning a cherry blossom viewing trip to Japan. Use this when someone wants to see sakura in Japan.",
    { travel_dates: z.string().optional().describe("Travel date range, e.g. 'April 5-12'") },
    async ({ travel_dates }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Help me plan a cherry blossom trip to Japan${travel_dates ? ` for ${travel_dates}` : ""}.

Use the japan-sakura-koyo-mcp tools in this order:

1. **get_sakura_forecast** — Big picture: 48 cities with forecast vs actual bloom dates and historical averages.
2. **get_sakura_best_dates** — Match your travel dates to cities with peak bloom.
3. **get_sakura_spots** — Drill into specific parks/temples (1,012 spots) with bloom % and GPS.
4. **get_kawazu_cherry** — For Jan-Feb trips: early-blooming deep pink Kawazu cherry in Izu Peninsula.
5. **get_weather_forecast** — Check rain (rain = petals fall faster).
6. **get_koyo_forecast** / **get_koyo_spots** — For autumn trips (Oct-Dec): maple & ginkgo at 687 spots.

Bloom scale (official from Japan Meteorological Corporation):
- Bloom rate 0-59% bud → 60-84% swelling → 85-99% opening → 100% first bloom
- Full rate 0-19% just opened → 20-39% 30% → 40-69% 50% → 70-89% 70% → 90-100% full bloom (mankai)

Key: Somei-Yoshino (standard cherry) blooms Mar-May. Kawazu-zakura (deep pink) blooms Jan-Feb. Sakura front moves north from Okinawa to Hokkaido. Blossoms last only 7-10 days.`,
        },
      }],
    })
  );

  // ── Tool: get_sakura_forecast ──

  server.tool(
    "get_sakura_forecast",
    "Get cherry blossom (sakura) bloom forecast for 48 major Japanese cities. Returns forecast dates, actual observation dates, historical averages, and current bloom status. Start here for the big picture, then use get_sakura_spots to drill into specific viewing spots. Data from Japan Meteorological Corporation, updated daily.",
    {
      city: z.string().optional().describe(
        "City or region to search (e.g. 'Tokyo', 'Kyoto', 'Hokkaido', 'Tohoku'). Omit to get all cities."
      ),
    },
    async ({ city }) => {
      try {
        const forecast = await getSakuraForecast();
        if (city) {
          const cities = findCities(forecast, city);
          if (cities.length === 0) {
            return { content: [{ type: "text", text: `No sakura forecast found for "${city}". Try city, prefecture, or region names.` }] };
          }
          return { content: [{ type: "text", text: formatCityResults(cities) }] };
        }
        let output = `# Sakura Forecast ${new Date().getFullYear()}\nSource: ${forecast.source}\nTotal observation cities: ${forecast.totalCities}\n\n`;
        for (const region of forecast.regions) {
          output += `## ${region.nameEn} (${region.name})\n`;
          if (region.comment.length > 0) output += `> ${region.comment[0]}\n\n`;
          output += formatCityResults(region.cities) + "\n";
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_sakura_spots ──

  server.tool(
    "get_sakura_spots",
    "Get detailed cherry blossom info for individual viewing spots in a Japanese prefecture. Returns 1000+ spots across Japan with bloom percentage (0-100%), full bloom percentage, GPS coordinates, and forecast dates. Data from Japan Meteorological Corporation, updated daily at 9 AM JST.",
    {
      prefecture: z.string().describe("Prefecture name or code (e.g. 'Tokyo', 'Kyoto', '13')."),
    },
    async ({ prefecture }) => {
      try {
        const prefCode = findPrefCode(prefecture);
        if (!prefCode) {
          return { content: [{ type: "text", text: `Prefecture "${prefecture}" not found.\n\n${getAvailablePrefectures().join("\n")}` }], isError: true };
        }
        const result = await getSakuraSpots(prefCode);
        let output = `# Sakura Spots — ${result.prefecture}\nSource: ${result.source}\nLast updated: ${result.lastUpdated}\nTotal spots: ${result.spots.length}\n\n`;
        output += `## Bloom Scale\nBloom rate: 0-59% bud → 60-84% swelling → 85-99% opening → 100% first bloom\nFull bloom rate: 0-19% just opened → 20-39% 30% → 40-69% 50% → 70-89% 70% → 90-100% full bloom\n\n`;
        if (result.jmaStation) {
          const jma = result.jmaStation;
          output += `## JMA Station: ${jma.name}\n- Bloom: **${jma.bloomRate}%** | Full bloom: **${jma.fullRate}%**\n`;
          output += `- Bloom: ${formatDate(jma.bloomForecast)}${jma.bloomObservation ? ` → observed ${formatDate(jma.bloomObservation)}` : ""} (avg ${jma.bloomNormal ?? "N/A"})\n`;
          output += `- Full bloom: ${formatDate(jma.fullForecast)}${jma.fullObservation ? ` → observed ${formatDate(jma.fullObservation)}` : ""} (avg ${jma.fullNormal ?? "N/A"})\n\n`;
        }
        output += `## Spots\n\n`;
        for (const spot of result.spots) {
          output += `### ${spot.name}${spot.nameReading ? ` (${spot.nameReading})` : ""}\n`;
          output += `- **${spot.status}**\n`;
          output += `- Bloom: **${spot.bloomRate}%** → Full bloom: **${spot.fullRate}%**\n`;
          output += `- Forecast: ${formatDate(spot.bloomForecast)}${spot.fullBloomForecast ? ` → full ${formatDate(spot.fullBloomForecast)}` : ""}\n`;
          output += `- 📍 ${spot.lat}, ${spot.lon}\n`;
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_sakura_best_dates ──

  server.tool(
    "get_sakura_best_dates",
    "Find the best cities to visit for cherry blossoms given your travel dates. Matches your dates against full bloom dates across 48 major cities. Best viewing is typically full bloom ± 3 days. Follow up with get_sakura_spots.",
    {
      start_date: z.string().describe("Travel start date (YYYY-MM-DD)"),
      end_date: z.string().describe("Travel end date (YYYY-MM-DD)"),
    },
    async ({ start_date, end_date }) => {
      try {
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return { content: [{ type: "text", text: "Invalid date format. Use YYYY-MM-DD." }], isError: true };
        }
        const forecast = await getSakuraForecast();
        const matches = findBestRegions(forecast, startDate, endDate);
        if (matches.length === 0) {
          return { content: [{ type: "text", text: `No cities in bloom during ${start_date} to ${end_date}.\n\nSeason: Okinawa Jan-Feb, Kyushu/Kansai late Mar, Kanto early Apr, Tohoku mid Apr, Hokkaido late Apr-May.\nTry get_kawazu_cherry for Jan-Feb early blooms.` }] };
        }
        let output = `# Best cities for sakura: ${start_date} to ${end_date}\n\n${matches.length} cities with bloom in your window.\nUse get_sakura_spots to find specific parks.\n\n`;
        output += formatCityResults(matches);
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_kawazu_cherry ──

  server.tool(
    "get_kawazu_cherry",
    "Get Kawazu cherry blossom (河津桜) forecast — the early-blooming deep pink variety in Izu Peninsula, Shizuoka. Blooms January-February, months before standard Somei-Yoshino. 9 spots with bloom percentages. Data from Japan Meteorological Corporation.",
    {},
    async () => {
      try {
        const result = await getKawazuForecast();
        let output = `# Kawazu Cherry (河津桜) Forecast\nSource: ${result.source}\nLast updated: ${result.lastUpdated}\n\n`;
        output += `Kawazu cherry is a deep pink variety blooming Jan-Feb in Izu Peninsula, south of Mt. Fuji.\n\n`;
        if (result.forecastComment) output += `## Forecast\n${result.forecastComment}\n\n`;
        output += `## Map\n${result.forecastMapUrlEn || result.forecastMapUrl}\n\n`;
        output += `## Spots (${result.spots.length})\n\n`;
        for (const spot of result.spots) {
          output += `### ${spot.name}\n- **${spot.status}**\n- Bloom: **${spot.bloomRate}%** → Full: **${spot.fullRate}%**\n`;
          output += `- Forecast: ${formatDate(spot.bloomForecast)} → full ${formatDate(spot.fullBloomForecast)}\n- 📍 ${spot.lat}, ${spot.lon}\n`;
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_koyo_forecast ──

  server.tool(
    "get_koyo_forecast",
    "Get autumn leaves (koyo/紅葉) forecast for Japan. Per-city maple and ginkgo dates, forecast maps, and regional commentary. 50+ observation cities. For Oct-Dec trips. Follow up with get_koyo_spots for specific viewing spots. Data from Japan Meteorological Corporation.",
    {},
    async () => {
      try {
        const forecast = await getKoyoForecast();
        let output = `# Autumn Leaves (Koyo) Forecast\nSource: ${forecast.source}\nLast updated: ${forecast.lastUpdated}\n\n`;
        if (forecast.forecastComment) output += `## Summary\n${forecast.forecastComment}\n\n`;
        output += `## Maps\n- Maple: ${forecast.mapleForecastMapUrlEn || forecast.mapleForecastMapUrl}\n- Ginkgo: ${forecast.ginkgoForecastMapUrlEn || forecast.ginkgoForecastMapUrl}\n\n`;
        for (const region of forecast.regions) {
          output += `## ${region.name}\n`;
          for (const city of region.cities) {
            output += `### ${city.name} (${city.prefName})\n`;
            if (city.maple) {
              output += `- **Maple (${city.maple.species}):** ${formatKoyoDate(city.maple.forecast)} — ${city.maple.normalDiffClass}`;
              if (city.maple.normalDiffDays > 0) output += ` (${city.maple.normalDiffDays} days)`;
              output += `\n`;
            }
            if (city.ginkgo) {
              output += `- **Ginkgo:** ${formatKoyoDate(city.ginkgo.forecast)} — ${city.ginkgo.normalDiffClass}`;
              if (city.ginkgo.normalDiffDays > 0) output += ` (${city.ginkgo.normalDiffDays} days)`;
              output += `\n`;
            }
          }
          output += `\n`;
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_koyo_spots ──

  server.tool(
    "get_koyo_spots",
    "Get autumn leaves viewing spots in a Japanese prefecture. 687 spots across Japan with best viewing window (start/peak/end dates), leaf type, popularity rating, and GPS. Famous spots like Arashiyama, Eikando, Tofukuji. Data from Japan Meteorological Corporation.",
    {
      prefecture: z.string().describe("Prefecture name or code (e.g. 'Kyoto', 'Tokyo', '26')."),
    },
    async ({ prefecture }) => {
      try {
        const prefCode = findPrefCode(prefecture);
        if (!prefCode) {
          return { content: [{ type: "text", text: `Prefecture "${prefecture}" not found.` }], isError: true };
        }
        const result = await getKoyoSpots(prefCode);
        let output = `# Autumn Leaves — ${result.prefecture}\nSource: ${result.source}\nTotal spots: ${result.spots.length}\n\n`;
        for (const spot of result.spots) {
          output += `### ${spot.name}${spot.nameReading ? ` (${spot.nameReading})` : ""}\n`;
          output += `- **${spot.status}**\n`;
          output += `- ${spot.leafType}${spot.popularity > 0 ? ` | ${"★".repeat(spot.popularity)}` : ""}\n`;
          output += `- Best: ${formatKoyoDate(spot.bestStart)} → peak ${formatKoyoDate(spot.bestPeak)} → end ${formatKoyoDate(spot.bestEnd)}\n`;
          output += `- 📍 ${spot.lat}, ${spot.lon}\n`;
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Tool: get_weather_forecast ──

  server.tool(
    "get_weather_forecast",
    "Get 3-day weather forecast for a Japanese city. Temperature, rain probability, wind. Rain during bloom = faster petal fall. Data from Japan Meteorological Agency.",
    {
      city: z.string().describe(`City name. Available: ${Object.keys(WEATHER_CITY_IDS).join(", ")}`),
    },
    async ({ city }) => {
      try {
        const forecast = await getWeatherForecast(city);
        let output = `# ${forecast.title}\nPublished: ${forecast.publicTime}\n\n`;
        if (forecast.description) output += `${forecast.description}\n\n`;
        for (const day of forecast.forecasts) {
          output += `### ${day.dateLabel} (${day.date})\n**${day.telop}**\n`;
          if (day.detail.weather) output += `${day.detail.weather}\n`;
          const minC = day.temperature.min.celsius;
          const maxC = day.temperature.max.celsius;
          if (minC || maxC) output += `Temp: ${minC ?? "—"}°C / ${maxC ?? "—"}°C\n`;
          output += `Rain: ${day.chanceOfRain.T00_06} | ${day.chanceOfRain.T06_12} | ${day.chanceOfRain.T12_18} | ${day.chanceOfRain.T18_24}\n\n`;
        }
        return { content: [{ type: "text", text: output }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
}

// ─── Formatting helper ───────────────────────────────────────────────────────

function formatCityResults(cities: SakuraCity[]): string {
  let output = "";
  for (const city of cities) {
    output += `### ${city.cityName} (${city.prefName})\n`;
    output += `- **Status:** ${city.status}\n`;
    output += `- **Bloom:** forecast ${formatDate(city.bloom.forecast)}`;
    if (city.bloom.observation) output += ` → observed ${formatDate(city.bloom.observation)}`;
    output += ` (avg ${city.bloom.normal ?? "N/A"})\n`;
    output += `- **Full bloom:** forecast ${formatDate(city.fullBloom.forecast)}`;
    if (city.fullBloom.observation) output += ` → observed ${formatDate(city.fullBloom.observation)}`;
    output += ` (avg ${city.fullBloom.normal ?? "N/A"})\n`;
  }
  return output;
}

// ─── Server startup ──────────────────────────────────────────────────────────

const isHttpMode = process.argv.includes("--http") || !!process.env.PORT;

// Register tools on the module-level server (for stdio mode)
const server = new McpServer({ name: "japan-sakura-koyo-mcp", version: "0.1.0" });
registerAllTools(server);

async function main() {
  if (isHttpMode) {
    await startHttpServer();
  } else {
    logger.info("Starting japan-sakura-koyo-mcp (stdio)");
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

async function startHttpServer() {
  const port = parseInt(process.env.PORT ?? "3000");
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "japan-sakura-koyo-mcp", version: "0.1.0" }));
      return;
    }

    if (url.pathname === "/mcp") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Reuse existing session
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId)!.handleRequest(req, res);
        return;
      }

      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };

      const sessionServer = new McpServer({ name: "japan-sakura-koyo-mcp", version: "0.1.0" });
      registerAllTools(sessionServer);
      await sessionServer.connect(transport);

      if (transport.sessionId) transports.set(transport.sessionId, transport);
      await transport.handleRequest(req, res);
      return;
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>japan-sakura-koyo-mcp</title></head>
<body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:0 20px">
<h1>🌸 japan-sakura-koyo-mcp</h1>
<p>MCP server for Japanese cherry blossom &amp; autumn leaves forecasting.</p>
<p><b>MCP endpoint:</b> <code>https://${req.headers.host}/mcp</code></p>
<p><b>7 tools:</b> sakura forecast, 1,012 sakura spots, best dates, Kawazu cherry, koyo forecast, 687 koyo spots, weather</p>
<p>Add to Claude/ChatGPT: use the MCP endpoint URL above.</p>
</body></html>`);
      return;
    }

    res.writeHead(404).end("Not found");
  });

  httpServer.listen(port, () => {
    logger.info(`japan-sakura-koyo-mcp HTTP server on port ${port}`);
    logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
  });
}

main().catch((e) => {
  logger.error(`Fatal: ${e.message}`);
  process.exit(1);
});
