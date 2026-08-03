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
type QType = "contemporary" | "causal" | "sequence" | "timeEvent";

type Question = {
  type: QType;
  focus: HistoryEvent;
  options: HistoryEvent[];
  correctId: string;
  causalDescription?: string;
  sequenceDirection?: "before" | "after";
  givenYear?: number;
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
function formatRange(e: HistoryEvent): string {
  return e.endYear
    ? `${formatYear(e.year)}—${formatYear(e.endYear)}`
    : formatYear(e.year);
}

/* ---------- distractor helpers (compressed time spans) ---------- */

/**
 * Contemporary-question distractors: close in era but NOT overlapping.
 * Compressed to 50–400 years so options stay in a recognisable window.
 */
function isContemporaryDistractor(focus: HistoryEvent, option: HistoryEvent): boolean {
  const gap = gapBetween(focus, option);
  return gap >= 50 && gap <= 400;
}

/**
 * Causal / sequence distractors: tight window around the focus.
 * Compressed to 30–250 years.
 */
function isCloseDistractor(a: HistoryEvent, b: HistoryEvent): boolean {
  const gap = gapBetween(a, b);
  return gap >= 30 && gap <= 250;
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
  // 20世纪事件密集且时间跨度短，同期匹配容易产生歧义，故排除
  const focusPool = (focusTrack === "china" ? chinaEvents : worldEvents).filter(
    (e) => e.year < 1900,
  );
  const otherPool = (otherTrack === "china" ? chinaEvents : worldEvents).filter(
    (e) => e.year < 1900,
  );
  if (!focusPool.length || !otherPool.length) return null;

  for (const focus of shuffle(focusPool)) {
    const contemporaries = otherPool.filter((e) => isContemporary(focus, e));
    if (!contemporaries.length) continue;

    const correct = pickRandom(contemporaries);
    // Compressed: distractors within 50–400 years (not overlapping)
    const distractorPool = otherPool.filter(
      (e) => e.id !== correct.id && isContemporaryDistractor(focus, e),
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
    // Compressed: distractors within 30–250 years
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
    if (gapBetween(focus, correct) > 300) continue;

    // Compressed: distractors within 30–250 years
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

/**
 * Time-to-event question: given a year, pick the event that happened then.
 * Distractors are from a compressed 50–500 year window so the era is similar.
 */
function buildTimeEventQuestion(allEvents: HistoryEvent[]): Question | null {
  // Skip prehistoric events (years >= 10000) — too imprecise for this format
  const candidates = allEvents.filter((e) => Math.abs(e.year) < 10000);
  if (candidates.length < 4) return null;

  for (const correct of shuffle(candidates)) {
    const correctYear = correct.year;

    // Distractors: different year, within 50–500 years of the correct event
    const distractorPool = allEvents.filter(
      (e) =>
        e.id !== correct.id &&
        e.year !== correctYear &&
        Math.abs(e.year - correctYear) >= 50 &&
        Math.abs(e.year - correctYear) <= 500,
    );
    if (distractorPool.length < 3) continue;

    const distractors = shuffle(distractorPool).slice(0, 3);
    const options = shuffle([correct, ...distractors]).sort(
      (a, b) => a.year - b.year,
    );
    return {
      type: "timeEvent",
      focus: correct,
      options,
      correctId: correct.id,
      givenYear: correctYear,
    };
  }
  return null;
}

function buildQuestion(
  chinaEvents: HistoryEvent[],
  worldEvents: HistoryEvent[],
  allEvents: HistoryEvent[],
  focusTrack: Track,
): Question | null {
  const types: QType[] = shuffle(["contemporary", "causal", "sequence", "timeEvent"]);
  for (const type of types) {
    let q: Question | null = null;
    if (type === "contemporary") {
      q = buildContemporaryQuestion(chinaEvents, worldEvents, focusTrack);
    } else if (type === "causal") {
      q = buildCausalQuestion(allEvents);
    } else if (type === "sequence") {
      q = buildSequenceQuestion(chinaEvents, worldEvents, focusTrack);
    } else {
      q = buildTimeEventQuestion(allEvents);
    }
    if (q) return q;
  }
  return buildContemporaryQuestion(chinaEvents, worldEvents, focusTrack);
}

const OPTION_LABELS = ["A", "B", "C", "D"];

const QTYPE_LABELS: Record<QType, { badge: string }> = {
  contemporary: { badge: "同期匹配" },
  causal: { badge: "因果推理" },
  sequence: { badge: "前后关系" },
  timeEvent: { badge: "时间定位" },
};

/* ---------- component ---------- */

export function TimeDetective({ events }: TimeDetectiveProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [ready, setReady] = useState(false);
  const focusTrackRef = useRef<Track>("china");
  const eventsRef = useRef(events);
  const topRef = useRef<HTMLDivElement>(null);
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
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!question) {
    return (
      <div className="time-detective" ref={topRef}>
        <p className="detective-prompt">
          {ready
            ? "暂无足够的事件来出题，请补充更多历史事件数据。"
            : "正在生成题目…"}
        </p>
      </div>
    );
  }

  const { focus, options, correctId, type, causalDescription, sequenceDirection, givenYear } = question;
  const correctEvent = options.find((o) => o.id === correctId) ?? focus;
  const isCorrect = selectedId === correctId;
  const focusDynasty = findDynastyForYear(focus.year);
  const correctDynasty = findDynastyForYear(correctEvent.year);
  const overlap = rangesOverlap(focus, correctEvent);
  const midpointDiff = Math.round(
    Math.abs(midpoint(focus) - midpoint(correctEvent)),
  );
  const qtypeLabel = QTYPE_LABELS[type];

  // Build the prompt HTML based on question type
  const promptHtml: string = (() => {
    if (type === "timeEvent") {
      return `以下哪一事件发生在<b>这一年</b>？`;
    }
    if (type === "sequence") {
      return sequenceDirection === "before"
        ? `以下事件中，哪一件紧接在上方焦点事件<b>之前</b>发生？`
        : `以下事件中，哪一件紧接在上方焦点事件<b>之后</b>发生？`;
    }
    if (type === "contemporary") {
      const otherLabel = focus.track === "china" ? "世界" : "中国";
      return `以下均为${otherLabel}事件，其中哪一件与上方焦点事件<b>时间最为接近</b>？`;
    }
    // causal
    return `以下事件中，哪一件与上方焦点事件存在<b>因果关系</b>？`;
  })();

  const isTimeEvent = type === "timeEvent";

  return (
    <div className="time-detective" ref={topRef}>
      {/* Focus card — event for most types, year display for timeEvent */}
      {isTimeEvent ? (
        <section className="detective-focus-card time-event-focus">
          <div className="detective-focus-meta">
            <span className="detective-qtype-badge">{qtypeLabel.badge}</span>
          </div>
          <div className="time-event-year-display">{formatYear(givenYear!)}</div>
        </section>
      ) : (
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
      )}

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
                    {option.track === "china" ? "中国" : "世界"} · {option.category}
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

          {isTimeEvent ? (
            <div className="detective-result-pair">
              <div className="detective-result-event focus">
                <span className="detective-result-tag">给定时间</span>
                <strong className="detective-result-time-big">
                  {formatYear(givenYear!)}
                </strong>
                <span className="detective-result-meta">
                  {correctDynasty.label}
                </span>
              </div>
              <div className="detective-result-event match">
                <span className="detective-result-tag">正确事件</span>
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
          ) : (
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
          )}

          {type === "causal" && causalDescription && (
            <p className="detective-result-note">
              <b>因果关系：</b>{causalDescription}
            </p>
          )}

          {type === "contemporary" && (
            <p className="detective-result-diff">
              {overlap
                ? `两事件时间区间重叠，时间最为接近（时间中点相差约 ${midpointDiff} 年）`
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

          {type === "timeEvent" && (
            <p className="detective-result-diff">
              {correctEvent.title} 发生在 {formatYear(givenYear!)}，属{correctDynasty.label}
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
