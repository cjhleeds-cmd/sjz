import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders development preview metadata", async () => {
  const response = await render("/");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders the split product routes", async () => {
  const routes = [
    ["/timeline", "一条时间轴"],
    ["/placement", "事件嵌入时间"],
    ["/journeys", "历史不是散落的点"],
    ["/records", "每说清一段历史"],
  ];

  for (const [pathname, expectedText] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(expectedText), pathname);
  }
});

test("keeps the historical mission in background-material-oral-unlock order", async () => {
  const [missionSource, pageSource, styles] = await Promise.all([
    readFile(new URL("../app/history-mission.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const label of ["本次身份", "材料", "口述", "解锁", "先看背景，选一份材料", "用自己的话讲清这件事", "解锁这个事件"]) {
    assert.match(missionSource, new RegExp(label));
  }
  assert.doesNotMatch(missionSource, /选择历史身份|chooseRole|调整材料/);
  assert.doesNotMatch(missionSource, /HISTORICAL MATERIALS|FEYNMAN TEACH-BACK|HISTORY UNLOCKED|鼠标、触屏或空格键均可|建议讲 20—90 秒/);
  assert.match(missionSource, /disabled=\{selectedMaterialIds\.length < 1\}/);
  assert.match(missionSource, /setSelectedMaterialIds\(\[materialId\]\)/);
  assert.match(missionSource, /usedMaterials\.length >= 1/);
  assert.match(missionSource, /\{selected && <div className="mission-material-clue"/);
  assert.match(missionSource, /className="mission-material-context"/);
  assert.match(missionSource, /时间 → 材料 → 关系/);
  assert.match(missionSource, /mission\.timePrompt/);
  assert.match(missionSource, /<details className="speaking-frame">/);
  assert.match(missionSource, /className="unlock-record-detail"/);
  assert.match(missionSource, /不保存原始录音/);
  assert.match(pageSource, /roleBackground: event\.scene/);
  assert.equal((missionSource.match(/className="mission-back-button"/g) ?? []).length, 3);
  assert.ok(missionSource.indexOf("transcript-box") < missionSource.indexOf("mission-recorder"));
  assert.doesNotMatch(missionSource, /得分|分数|score/i);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.transcript-box textarea \{ min-height: 150px; font-size: 16px;/);
  assert.match(styles, /具体事件讲述/);
  assert.match(styles, /\.mission-recorder \.hold-to-talk \{ min-height: 88px;/);
  assert.match(styles, /\.mission-material-grid \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.era-stop\.is-collapsed \{ min-height: 0;/);
  assert.doesNotMatch(styles, /\.era-stop\.is-expanded \{ min-height: (?:620|650)px;/);
});

test("inserts events directly into one time chain without scoring", async () => {
  const [placementSource, styles] = await Promise.all([
    readFile(new URL("../app/time-placement.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(placementSource, /onPointerDown=\{beginDrag\}/);
  assert.match(placementSource, /onPointerMove=\{moveDrag\}/);
  assert.match(placementSource, /onPointerUp=\{finishDrag\}/);
  assert.match(placementSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(placementSource, /className=\{`insertion-cursor/);
  assert.match(placementSource, /className="insertion-actual-range"/);
  assert.match(placementSource, /落在事件区间内/);
  assert.match(placementSource, /把它说成一句话/);
  assert.match(placementSource, /此前\$\{context\.before/);
  assert.match(placementSource, /STORAGE_KEY = "history-river-time-insertions-v1"/);
  assert.doesNotMatch(placementSource, /选朝代|确认落点|整张方块都可放置/);
  assert.doesNotMatch(placementSource, /得分|分数|score/i);
  assert.match(styles, /事件嵌入主模块/);
  assert.match(styles, /\.insertion-card \{[\s\S]*touch-action: none;/);
  assert.match(styles, /\.insertion-loupe \{/);
  assert.match(styles, /\.insertion-ghost \{/);
  assert.match(styles, /\.insertion-relations \{/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.insertion-layout \{ display: block;/);
});

test("uses the joint-exam parchment visual system with image-ready surfaces", async () => {
  const [pageSource, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /className=\{`site-shell view-\$\{view\}`\}/);
  for (const token of ["--card-paper", "--paper-shadow", "--card-radius", "--art-home", "--art-timeline", "--art-placement", "--art-journeys", "--art-records", "--art-event"]) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /联考版本视觉语言/);
  assert.match(styles, /font-family: -apple-system, BlinkMacSystemFont/);
  assert.match(styles, /\.portal-grid a::before/);
  assert.match(styles, /\.today-action,[\s\S]*background: linear-gradient\(135deg, var\(--red\), #a75a28\)/);
});

test("ships the restrained historical illustration set", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const assets = [
    ["--art-home", "home-history-river.webp"],
    ["--art-timeline", "timeline-dynasties.webp"],
    ["--art-placement", "time-placement.webp"],
    ["--art-journeys", "journeys-silk-road.webp"],
    ["--art-records", "records-scroll.webp"],
    ["--art-event", "event-archive.webp"],
  ];

  for (const [token, filename] of assets) {
    assert.match(styles, new RegExp(`${token}: url\\("/historical-art/${filename}\\"\\)`));
    const image = await readFile(new URL(`../public/historical-art/${filename}`, import.meta.url));
    assert.ok(image.length > 30_000, filename);
  }
});
