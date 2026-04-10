# Contributing to japan-seasons-mcp

Thank you for your interest in contributing! This project welcomes contributions of all kinds — bug fixes, new data, documentation improvements, and feature ideas.

## Ways to Contribute

### 1. Data contributions (highest impact)
- **Flower spots** — Add missing spots to `public/flowers.json` (wisteria, hydrangea, plum, iris, lavender, sunflower, cosmos, nanohana)
- **Festival entries** — Add notable recurring festivals to `public/festivals.json`
- **Fruit farm corrections** — Farms move or close; PRs to update `public/fruit-farms.json` are very welcome

Each JSON entry includes `name`, `nameJa`, `lat`, `lon`, `prefecture`, `region`, `url` (official site), and type-specific fields. See existing entries for the format.

### 2. New tools / API coverage
- Koyo spots currently require a prefecture — a "best spots near a city" variant would be useful
- Plum blossom (ume) live data from JMC exists but is not yet integrated
- Tulip / autumn flower festivals

### 3. Bug reports
Open a GitHub issue with:
- The tool / endpoint that misbehaved
- What you expected vs what you got
- Date and time (bloom data is time-sensitive)

### 4. Documentation
README examples, typo fixes, and translation improvements are always welcome.

## Development Setup

```bash
git clone https://github.com/haomingkoo/japan-seasons-mcp.git
cd japan-seasons-mcp
npm install
npm run build
npm start          # stdio MCP mode
npm run start:http # HTTP MCP mode on port 3000
```

## Pull Request Guidelines

- Keep PRs focused — one fix or feature per PR
- For data changes: verify coordinates using Google Maps or GSI before submitting
- For code changes: run `npm run build` and confirm no TypeScript errors
- Update the relevant section of `README.md` if you add a new tool or data type

## Data Format Reference

### flowers.json spot
```json
{
  "type": "wisteria",
  "name": "Ashikaga Flower Park",
  "nameJa": "あしかがフラワーパーク",
  "prefecture": "Tochigi",
  "region": "Kanto",
  "lat": 36.3167,
  "lon": 139.5167,
  "peakStart": "Late Apr",
  "peakEnd": "Mid May",
  "note": "Japan's most famous wisteria tunnel. Timed-entry tickets required.",
  "url": "https://www.ashikaga.co.jp/english/"
}
```

### festivals.json entry
```json
{
  "type": "fireworks",
  "name": "Sumida River Fireworks",
  "nameJa": "隅田川花火大会",
  "prefecture": "Tokyo",
  "region": "Kanto",
  "months": [7],
  "typicalDate": "Last Saturday of July",
  "attendance": 900000,
  "lat": 35.7106,
  "lon": 139.8036,
  "note": "One of Tokyo's oldest and largest fireworks festivals (since 1733).",
  "url": "https://www.sumidagawa-hanabi.com/"
}
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
