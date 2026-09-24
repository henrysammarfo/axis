import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../docs/demo-assets");
const out = root;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webm": "video/webm",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/baskets-depth.html";
    const file = path.join(root, rel.replace(/^\//, ""));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const data = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(8765, "127.0.0.1", resolve));
const base = "http://127.0.0.1:8765";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(`${base}/baskets-depth.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.screenshot({
  path: path.join(out, "01-baskets-hero.png"),
  fullPage: false,
});

await page.evaluate(() => window.scrollBy(0, 520));
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(out, "02-fragmentation-usdg.png"),
  fullPage: false,
});

await page.evaluate(() => window.scrollBy(0, 700));
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(out, "03-beachhead-packages.png"),
  fullPage: false,
});

await page.screenshot({
  path: path.join(out, "04-baskets-full.png"),
  fullPage: true,
});

// slow scroll for recording
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const max = document.body.scrollHeight - window.innerHeight;
  for (let y = 0; y <= max; y += 40) {
    window.scrollTo(0, y);
    await sleep(40);
  }
  await sleep(600);
  window.scrollTo(0, 0);
  await sleep(400);
});

const videoPath = await page.video()?.path();
await context.close();
await browser.close();
server.close();

console.log(
  JSON.stringify(
    {
      screenshots: [
        "01-baskets-hero.png",
        "02-fragmentation-usdg.png",
        "03-beachhead-packages.png",
        "04-baskets-full.png",
      ],
      video: videoPath ? path.basename(videoPath) : null,
      dir: out,
    },
    null,
    2,
  ),
);
