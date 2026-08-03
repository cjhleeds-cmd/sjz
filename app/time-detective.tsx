"use client";

import { useEffect, useRef, useState } from "react";
import {
  findDynastyForYear,
  formatYear,
  getCausalPartners,
  type HistoryEvent,
  type Track,
} from "./history-data";

export type TimeDetectiveProps = {
  events: HistoryEvent[];
};

type Phase = "answering" | "result";
type QType = "contemporary" | "causal" | "sequence";

type Question = {
  type: QType;
  focus: HistoryEvent;
  options: HistoryEvent[];
  correctId: string;
  causalDescription?: string;
  sequenceDirection?: "before" | "after";
};

/* ---------- time helpers ---------- */

function midpoint(e: HistoryEvent): number {
  return e.endYear ? (e.year + e.endYear) / 2 : e.year;
}
function rangeStart(e: HistoryEvent): number {
  return e.year;
}
function rangeEnd(e: HistoryEvent): number {
  return e.endYear ?? e.year;
}
function rangesOverlap(a: HistoryEvent, b: HistoryEvent): boolean {
  return rangeStart(a) <= rangeEnd(b) && rangeStart(b) <= rangeEnd(a);
}
function isContemporary(a: HistoryEvent, b: HistoryEvent): boolean {
  return rangesOverlap(a, b) || Math.abs(midpoint(a) - midpoint(b)) <= 100;
}
function gapBetween(a: HistoryEvent, b: HistoryEvent): number {
  return Math.max(rangeStart(a) - rangeEnd(b), rangeStart(b) - rangeEnd(a), 0);
}
function isFarDistractor(a: HistoryEvent, b: HistoryEvent): boolean {
  return !isContemporary(a, b) && gapBetween(a, b) >= 80;
}
function isCloseDistractor(a: HistoryEvent, b: HistoryEvent): boolean {
  return gapBetween(a, b) >= 30 && gapBetween(a, b) <= 300;
}
function formatRange(e: HistoryEvent): string {
  return e.endYear
    ? `${formatYear(e.year)}—${formatYear(e.endYear)}`
    : formatYear(e.year);
}

/* ---------- random helpers ---------- */

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- question builders ---------- */

function buildContemporaryQuestion(
  chinaEvents: HistoryEvent[],
  worldEvents: HistoryEvent[],
  focusTrack: Track,
): Question | null {
  const otherTrack: Track = focusTrack === "china" ? "world" : "china";
  const focusPool = focusTrack === "china" ? chinaEvents : worldEvents;
  const otherPool = otherTrack === "china" ? chinaEvents : worldEvents;
  if (!focusPool.length || !otherPool.length) return null;

  for (const focus of shuffle(focusPool)) {
    const contemporaries = otherPool.filter((e) => isContemporary(focus, e));
    if (!contemporaries.length) continue;

    const correct = pickRandom(contemporaries);
    const distractorPool = otherPool.filter(
      (e) => e.id !== correct.id && isFarDistractor(focus, e),
    );
    if (distractorPool.length < 3) continue;

    const distractors = shuffle(distractorPool).slice(0, 3);
    const options = shuffle([correct, ...distractors]).sort(
      (a, b) => a.year - b.year,
    );
    return { type: "contemporary", focus, options, correctId: correct.id };
  }
  return null;
}

function buildCausalQuestion(
  allEvents: HistoryEvent[],
): Question | null {
  const withCausal = allEvents.filter((e) => getCausalPartners(e.id).length > 0);
  if (!withCausal.length) return null;

  for (const focus of shuffle(withCausal)) {
    const partners = getCausalPartners(focus.id);
    if (!partners.length) continue;

    const { partner, description } = pickRandom(partners);
    const distractorPool = allEvents.filter(
      (e) => e.id !== focus.id && e.id !== partner.id && isCloseDistractor(focus, e),
    );
    if (distractorPool.length < 3) continue;

    const distractors = shuffle(distractorPool).slice(0, 3);
    const options = shuffle([partner, ...distractors]).sort(
      (a, b) => a.year - b.year,
    );
    return { type: "causal", focus, options, correctId: partner.id, causalDescription: description };
  }
  return null;
}

function buildSequenceQuestion(
  chinaEvents: HistoryEvent[],
  worldEvents: HistoryEvent[],
  focusTrack: Track,
): Question | null {
  const focusPool = focusTrack === "china" ? chinaEvents : worldEvents;
  if (focusPool.length < 2) return null;

  const sorted = [...focusPool].sort((a, b) => a.year - b.year);

  for (const focus of shuffle(focusPool)) {
    const idx = sorted.findIndex((e) => e.id === focus.id);
    if (idx < 0) continue;

    const direction: "before" | "after" = Math.random() < 0.5 ? "before" : "after";
    const correctIdx = direction === "before" ? idx - 1 : idx + 1;
    if (correctIdx < 0 || correctIdx >= sorted.length) continue;

    const correct = sorted[correctIdx];
    if (gapBetween(focus, correct) > 500) continue;

    const distractorPool = focusPool.filter(
      (e) => e.id !== focus.id && e.id !== correct.id && isCloseDistractor(focus, e),
    );
    if (distractorPool.length < 3) continue;

    const distractors = shuffle(distractorPool).slice(0, 3);
    const options = shuffle([correct, ...distractors]).sort(
      (a, b) => a.year - b.year,
    );
    return { type: "sequence", focus, options, correctId: correct.id, sequenceDirection: direction };
  }
  return null;
}

function buildQuestion(
  chinaEvents: HistoryEvent[],
  worldEvents: HistoryEvent[],
  allEvents: HistoryEvent[],
  focusTrack: Track,
): Question | null {
  const types: QType[] = shuffle(["contemporary", "causal", "sequence"]);
  for (const type of types) {
    let q: Question | null = null;
    if (type === "contemporary") {
      q = buildContemporaryQuestion(chinaEvents, worldEvents, focusTrack);
    } else if (type === "causal") {
      q = buildCausalQuestion(allEvents);
    } else {
      q = buildSequenceQuestion(chinaEvents, worldEvents, focusTrack);
    }
    if (q) return q;
  }
  return buildContemporaryQuestion(chinaEvents, worldEvents, focusTrack);
}

const OPTION_LABELS = ["A", "B", "C", "D"];

const QTYPE_LABELS: Record<QType, { badge: string; prompt: (track: Track) => string }> = {
  contemporary: {
    badge: "同期匹配",
    prompt: (track) => `以下均为${track === "china" ? "世界" : "中国"}事件，其中哪一件与上方焦点事件处于<b>同一时期</b>？`,
  },
  causal: {
    badge: "因果推理",
    prompt: () => `以下事件中，哪一件与上方焦点事件存在<b>因果关系</b>？`,
  },
  sequence: {
    badge: "前后关系",
    prompt: () => `以下事件中，哪一件紧接在上方焦点事件<b>之后</b>发生？`,
  },
};

/* ---------- component ---------- */

export function TimeDetective({ events }: TimeDetectiveProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [ready, setReady] = useState(false);
  const focusTrackRef = useRef<Track>("china");
  const eventsRef = useRef(events);
  eventsRef.current = events;

  function generateQuestion(): Question | null {
    const evts = eventsRef.current;
    const chinaEvents = evts.filter((e) => e.track === "china");
    const worldEvents = evts.filter((e) => e.track === "world");
    const focusTrack = focusTrackRef.current;
    const otherTrack: Track = focusTrack === "china" ? "world" : "china";
    return (
      buildQuestion(chinaEvents, worldEvents, evts, focusTrack) ??
      buildQuestion(chinaEvents, worldEvents, evts, otherTrack)
    );
  }

  useEffect(() => {
    function generate() {
      const next = generateQuestion();
      setQuestion(next);
      setSelectedId(null);
      setPhase("answering");
      setReady(true);
      focusTrackRef.current = focusTrackRef.current === "china" ? "world" : "china";
    }
    generate();
  }, []);

  function handleSelect(id: string) {
    if (phase !== "answering" || !question) return;
    setSelectedId(id);
    setPhase("result");
  }

  function handleNext() {
    const next = generateQuestion();
    setQuestion(next);
    setSelectedId(null);
    setPhase("answering");
    focusTrackRef.current = focusTrackRef.current === "china" ? "world" : "china";
  }

  if (!question) {
    return (
      <div className="time-detective">
        <p className="detective-prompt">
          {ready
            ? "暂无足够的事件来出题，请补充更多历史事件数据。"
            : "正在生成题目…"}
        </p>
      </div>
    );
  }

  const { focus, options, correctId, type, causalDescription, sequenceDirection } = question;
  const correctEvent = options.find((o) => o.id === correctId) ?? focus;
  const isCorrect = selectedId === correctId;
  const focusDynasty = findDynastyForYear(focus.year);
  const correctDynasty = findDynastyForYear(correctEvent.year);
  const overlap = rangesOverlap(focus, correctEvent);
  const midpointDiff = Math.round(
    Math.abs(midpoint(focus) - midpoint(correctEvent)),
  );
  const optionsTrackLabel = type === "contemporary"
    ? (focus.track === "china" ? "世界" : "中国")
    : "全部";
  const qtypeLabel = QTYPE_LABELS[type];
  const promptHtml = type === "sequence"
    ? `以下事件中，哪一件紧接在上方焦点事件<b>之后</b>发生？`
    : qtypeLabel.prompt(focus.track);

  return (
    <div className="time-detective">
      <section className="detective-focus-card">
        <div className="detective-focus-meta">
          <span className="detective-qtype-badge">{qtypeLabel.badge}</span>
          <i>·</i>
          <span>{focus.track === "china" ? "中国" : "世界"}</span>
          <i>·</i>
          <span>{focus.category}</span>
          <i>·</i>
          <span>{focusDynasty.label}</span>
        </div>
        <div className="detective-focus-time">{formatRange(focus)}</div>
        <h3 className="detective-focus-title">{focus.title}</h3>
        {focus.summary && (
          <p className="detective-focus-summary">{focus.summary}</p>
        )}
      </section>

      <p className="detective-prompt" dangerouslySetInnerHTML={{ __html: promptHtml }} />

      <div className="detective-options">
        {options.map((option, index) => {
          const stateClasses: string[] = [];
          if (phase === "result") {
            if (option.id === selectedId) stateClasses.push("selected");
            if (option.id === correctId) stateClasses.push("correct");
            if (option.id === selectedId && option.id !== correctId)
              stateClasses.push("incorrect");
          }
          return (
            <button
              key={option.id}
              type="button"
              className={`detective-option ${stateClasses.join(" ")}`.trim()}
              onClick={() => handleSelect(option.id)}
              disabled={phase === "result"}
            >
              <span className="detective-option-index">
                {OPTION_LABELS[index] ?? String(index + 1)}
              </span>
              <span className="detective-option-main">
                <span className="detective-option-title">{option.title}</span>
                <span className="detective-option-sub">
                  <span className="detective-option-category">
                    {option.category}
                  </span>
                  {phase === "result" && (
                    <span className="detective-option-time">
                      {formatRange(option)}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {phase === "result" && (
        <div className="detective-result" aria-live="polite">
          <div
            className={`detective-result-badge ${
              isCorrect ? "correct" : "incorrect"
            }`.trim()}
          >
            {isCorrect ? "回答正确" : "回答错误"}
          </div>

          <div className="detective-result-pair">
            <div className="detective-result-event focus">
              <span className="detective-result-tag">焦点事件</span>
              <strong className="detective-result-title">{focus.title}</strong>
              <span className="detective-result-time">{formatRange(focus)}</span>
              <span className="detective-result-meta">
                {focus.track === "china" ? "中国" : "世界"} · {focus.category} ·{" "}
                {focusDynasty.label}
              </span>
              {focus.summary && (
                <p className="detective-result-summary">{focus.summary}</p>
              )}
            </div>

            <div className="detective-result-event match">
              <span className="detective-result-tag">
                {type === "contemporary" ? "同期事件" : type === "causal" ? "因果关联" : "紧接其后"}
              </span>
              <strong className="detective-result-title">
                {correctEvent.title}
              </strong>
              <span className="detective-result-time">
                {formatRange(correctEvent)}
              </span>
              <span className="detective-result-meta">
                {correctEvent.track === "china" ? "中国" : "世界"} ·{" "}
                {correctEvent.category} · {correctDynasty.label}
              </span>
              {correctEvent.summary && (
                  <p className="detective-result-summary">
                    {correctEvent.summary}
                  </p>
                )}
            </div>
          </div>

          {type === "causal" && causalDescription && (
            <p className="detective-result-note">
              <b>因果关系：</b>{causalDescription}
            </p>
          )}

          {type === "contemporary" && (
            <p className="detective-result-diff">
              {overlap
                ? `两事件时间区间重叠，属同一时期（时间中点相差约 ${midpointDiff} 年）`
                : `两事件时间中点相差约 ${midpointDiff} 年`}
            </p>
          )}

          {type === "sequence" && (
            <p className="detective-result-diff">
              {sequenceDirection === "after"
                ? `${correctEvent.title} 紧接在 ${focus.title} 之后发生`
                : `${correctEvent.title} 发生在 ${focus.title} 之前`}
            </p>
          )}

          <div className="detective-actions">
            <button
              type="button"
              className="detective-next"
              onClick={handleNext}
            >
              换一题
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
