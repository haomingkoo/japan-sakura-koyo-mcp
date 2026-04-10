#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto('https://seasons.kooexperience.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000); // wait for map + data

// Click the first cluster or marker that appears
const marker = page.locator('.leaflet-marker-icon').first();
if (await marker.count() > 0) {
  await marker.click();
  await page.waitForTimeout(1500);
}

// Try clicking a spot in the sidebar to pan to it and open popup
const spotItem = page.locator('.spot-item').first();
if (await spotItem.count() > 0) {
  await spotItem.click();
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'screenshots/02-sakura-popup.png' });
console.log('✓ 02-sakura-popup.png');

// Also take a zoomed-in map view showing individual markers more clearly
await page.evaluate(() => { window.mapInstance?.setZoom(9); });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/08-sakura-zoomed.png' });
console.log('✓ 08-sakura-zoomed.png');

await browser.close();
