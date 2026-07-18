#!/usr/bin/env node
/** Capture README demo GIF via Playwright + ffmpeg. */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/demo-frames");
const gifPath = path.join(root, "docs/demo.gif");
const baseURL = process.env.DEMO_URL ?? "http://127.0.0.1:3000";

async function capture() {
  const demoDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedstarter-demo-"));
  process.env.SEEDSTARTER_DB_DIR = demoDbDir;

  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".png")) fs.unlinkSync(path.join(outDir, f));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(baseURL);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outDir, "01-home.png") });

  await page.getByLabel("ZIP code").fill("55423");
  await page.getByRole("checkbox", { name: "Tomato", exact: true }).click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await page.getByText("Zone 5A", { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText(/Sow Tomato/i).waitFor();
  await page.screenshot({ path: path.join(outDir, "02-results.png") });

  await page.getByRole("button", { name: "Save plan" }).click();
  await page.getByLabel("Plan name").fill("Demo plan");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /plan saved/i }).first().waitFor({ timeout: 10_000 });
  await page.screenshot({ path: path.join(outDir, "03-saved.png") });

  await browser.close();
  fs.rmSync(demoDbDir, { recursive: true, force: true });

  const frames = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(outDir, f));

  const listFile = path.join(outDir, "frames.txt");
  fs.writeFileSync(
    listFile,
    frames.map((f) => `file '${f}'\nduration 2`).join("\n") + "\n",
  );

  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "fps=0.5,scale=960:-1:flags=lanczos", gifPath],
    { stdio: "inherit" },
  );
  if (ff.status !== 0) {
    console.error("ffmpeg failed — PNG frames kept in docs/demo-frames/");
    process.exit(1);
  }
  console.log(`Wrote ${gifPath}`);
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
