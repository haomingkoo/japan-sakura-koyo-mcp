#!/usr/bin/env node
// Takes screenshots of seasons.kooexperience.com for the README
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots', { recursive: true });

const BASE = 'https://seasons.kooexperience.com';

async function shot(page, name, fn) {
  await fn();
  await page.waitForTimeout(2000); // let map render
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`✓ ${name}.png`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// 1. Cherry blossom — default view
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/01-sakura-map.png' });
console.log('✓ 01-sakura-map.png');

// 2. Click a sakura marker and capture popup
await page.evaluate(() => {
  // Trigger the first visible marker click by finding a Leaflet marker
  const markers = document.querySelectorAll('.leaflet-marker-icon');
  if (markers.length > 0) markers[3]?.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/02-sakura-popup.png' });
console.log('✓ 02-sakura-popup.png');

// 3. Fruit picking
await page.click('#btn-fruit');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/03-fruit-picking.png' });
console.log('✓ 03-fruit-picking.png');

// 4. Flowers
await page.click('#btn-flowers');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/04-flowers.png' });
console.log('✓ 04-flowers.png');

// 5. What's On
await page.click('#btn-whatson');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/05-whatson.png' });
console.log('✓ 05-whatson.png');

// 6. Autumn leaves
await page.click('#btn-koyo');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/06-koyo-map.png' });
console.log('✓ 06-koyo-map.png');

// 7. Mobile view — cherry blossom
await ctx.close();
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobile = await mobileCtx.newPage();
await mobile.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await mobile.waitForTimeout(3000);
await mobile.screenshot({ path: 'screenshots/07-mobile.png' });
console.log('✓ 07-mobile.png');

await browser.close();
console.log('\nAll screenshots saved to screenshots/');
