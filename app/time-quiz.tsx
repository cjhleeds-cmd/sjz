"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { formatYear, type HistoryEvent } from "./history-data";

type EventContext = {
  before?: HistoryEvent;
  after?: HistoryEvent;
  simultaneous?: HistoryEvent;
};

function itemEnd(event: HistoryEvent) {
  return event.endYear ?? event.year;
}

function computeContext(event: HistoryEvent, allEvents: HistoryEvent[]): EventContext {
  const others = allEvents.filter((e) => e.id !== event.id);
  const sameTrack = others.filter((e) => e.track === event.track);
  const endYear = itemEnd(event);

  const beforePool = sameTrack.some((e) => itemEnd(e) < event.year) ? sameTrack : others;
  const afterPool = sameTrack.some((e) => e.year > endYear) ? sameTrack : others;

  const before = [...beforePool]
    .filter((e) => itemEnd(e) < event.year)
    .sort((a, b) => itemEnd(b) - itemEnd(a))[0];

  const after = [...afterPool]
    .filter((e) => e.year > endYear)
    .sort((a, b) => a.year - b.year)[0];

  const midpoint = (event.year + endYear) / 2;
  const simultaneous = [...others]
    .filter((e) => e.track !== event.track && e.id !== before?.id && e.id !== after?.id)
    .sort((a, b) => {
      const aOverlaps = a.year <= endYear && itemEnd(a) >= event.year;
      const bOverlaps = b.year <= endYear && itemEnd(b) >= event.year;
      if (aOverlaps !== bOverlaps) return aOverlaps ? -1 : 1;
      return Math.abs(a.year - midpoint) - Math.abs(b.year - midpoint);
    })[0];

  return { before, after, simultaneous };
}

/* ── Quiz mode determination ── */

type QuizMode =
  | "single"          // 普通事件，问年份
  | "endpoint"        // 区间事件，随机问开始或结束年
  | "intervalChoice"  // 区间事件，选择题：选正确区间
  | "centuryChoice";  // 超大跨度事件，选择题：选正确世纪/时代

function pickQuizMode(event: HistoryEvent): QuizMode {
  if (!event.endYear) return "single";

  const span = Math.abs(event.endYear - event.year);

  // 超大跨度（≥1000年）：世纪选择题
  if (span >= 1000) return "centuryChoice";

  // 中/小跨度：随机选 endpoint 或 intervalChoice
  return Math.random() < 0.5 ? "endpoint" : "intervalChoice";
}

/* ── Hint choices for single-year questions ── */

function generateHintChoices(event: HistoryEvent, targetYear?: number): number[] {
  const correct = targetYear ?? event.year;
  const absYear = Math.abs(correct);
  const acceptableYears = event.acceptableYears ?? [correct];

  let minSpacing: number;
  let range: number;
  let roundUnit: number;

  if (absYear >= 100000) {
    roundUnit = 10000;
    minSpacing = Math.max(50000, Math.round(absYear * 0.05 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.3, minSpacing * 4);
  } else if (absYear >= 10000) {
    roundUnit = 1000;
    minSpacing = Math.max(2000, Math.round(absYear * 0.1 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.5, minSpacing * 4);
  } else if (correct < 0 && absYear >= 2000) {
    roundUnit = 50;
    minSpacing = Math.max(100, Math.round(absYear * 0.05 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.3, minSpacing * 5);
  } else {
    roundUnit = correct < 0 ? 10 : 5;
    minSpacing = correct < 0 ? 50 : 20;
    range = Math.max(minSpacing * 6, absYear * 0.15);
  }

  const choices = new Set<number>(acceptableYears);
  let attempts = 0;
  const maxAttempts = 300;

  while (choices.size < 4 && attempts < maxAttempts) {
    attempts++;
    const rawDelta = (Math.random() * 2 - 1) * range;
    const delta = Math.round(rawDelta / roundUnit) * roundUnit;
    if (delta === 0 || acceptableYears.includes(correct + delta)) continue;

    const newChoice = correct + delta;

    if (correct < 0 && newChoice > 0) continue;
    if (correct > 0 && newChoice < 0) continue;

    let tooClose = false;
    for (const c of choices) {
      if (Math.abs(c - newChoice) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    choices.add(newChoice);
  }

  if (choices.size < 4) {
    const multipliers = [-3, -2, 2, 3, -4, 4, -5, 5, -6, 6, -7, 7];
    for (const m of multipliers) {
      if (choices.size >= 4) break;
      const val = correct + m * minSpacing;
      if (acceptableYears.includes(val) || choices.has(val)) continue;
      if (correct < 0 && val > 0) continue;
      if (correct > 0 && val < 0) continue;
      let tooClose = false;
      for (const c of choices) {
        if (Math.abs(c - val) < minSpacing) { tooClose = true; break; }
      }
      if (tooClose) continue;
      choices.add(val);
    }
  }

  if (choices.size < 4) {
    const multipliers = [-3, -2, 2, 3, -4, 4, -5, 5, -6, 6, -7, 7];
    for (const m of multipliers) {
      if (choices.size >= 4) break;
      const val = correct + m * minSpacing;
      if (acceptableYears.includes(val) || choices.has(val)) continue;
      choices.add(val);
    }
  }

  return [...choices].sort((a, b) => a - b);
}

/* ── Interval choices for interval-choice questions ── */

type IntervalOption = {
  start: number;
  end: number;
  isCorrect: boolean;
};

function generateIntervalChoices(event: HistoryEvent): IntervalOption[] {
  const correctStart = event.year;
  const correctEnd = event.endYear!;
  const span = correctEnd - correctStart;

  // Round unit based on span magnitude
  let roundUnit: number;
  if (span >= 100) roundUnit = 10;
  else if (span >= 30) roundUnit = 5;
  else roundUnit = 1;

  const options: IntervalOption[] = [{ start: correctStart, end: correctEnd, isCorrect: true }];
  const used = new Set<string>([`${correctStart}-${correctEnd}`]);

  // Generate distractor offsets
  const maxOffset = Math.max(span * 2, 30);
  let attempts = 0;
  const maxAttempts = 200;

  while (options.length < 4 && attempts < maxAttempts) {
    attempts++;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const offsetMag = Math.round((Math.random() * maxOffset + 10) / roundUnit) * roundUnit;
    const offset = direction * offsetMag;
    if (offset === 0) continue;

    const newStart = correctStart + offset;
    const newEnd = correctEnd + offset;

    // Same era constraint
    if (correctStart < 0 && newStart > 0) continue;
    if (correctStart > 0 && newStart < 0) continue;

    const key = `${newStart}-${newEnd}`;
    if (used.has(key)) continue;

    // Check overlap with correct answer
    const overlaps = newStart <= correctEnd && newEnd >= correctStart;
    if (overlaps) continue;

    // Check overlap with other distractors
    let badOverlap = false;
    for (const opt of options) {
      if (newStart <= opt.end && newEnd >= opt.start) {
        badOverlap = true;
        break;
      }
    }
    if (badOverlap) continue;

    // Check minimum gap between options
    let tooClose = false;
    for (const opt of options) {
      const gap = Math.min(
        Math.abs(newStart - opt.end),
        Math.abs(newEnd - opt.start),
        Math.abs(newStart - opt.start),
        Math.abs(newEnd - opt.end),
      );
      if (gap < Math.max(roundUnit, span * 0.15)) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    used.add(key);
    options.push({ start: newStart, end: newEnd, isCorrect: false });
  }

  // Fallback: fixed offsets
  if (options.length < 4) {
    const offsets = [1, -1, 2, -2, 3, -3, 4, -4];
    for (const m of offsets) {
      if (options.length >= 4) break;
      const offset = m * Math.max(span, roundUnit * 2);
      const newStart = correctStart + offset;
      const newEnd = correctEnd + offset;
      if (correctStart < 0 && newStart > 0) continue;
      if (correctStart > 0 && newStart < 0) continue;
      const key = `${newStart}-${newEnd}`;
      if (used.has(key)) continue;
      const overlaps = newStart <= correctEnd && newEnd >= correctStart;
      if (overlaps) continue;
      let badOverlap = false;
      for (const opt of options) {
        if (newStart <= opt.end && newEnd >= opt.start) { badOverlap = true; break; }
      }
      if (badOverlap) continue;
      used.add(key);
      options.push({ start: newStart, end: newEnd, isCorrect: false });
    }
  }

  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

/* ── Century choices for super-wide events ── */

type CenturyOption = {
  label: string;
  isCorrect: boolean;
};

function generateCenturyChoices(event: HistoryEvent): CenturyOption[] {
  // For super-wide events, ask which "era/century" it belongs to
  // Generate century-based options around the event's midpoint
  const correct = event.year < 0 ? Math.floor(event.year / 100) : Math.floor(event.year / 100);
  const options: CenturyOption[] = [];
  const used = new Set<number>();

  // The correct century index
  const correctCentury = event.year < 0
    ? Math.floor(event.year / 100)
    : Math.floor(event.year / 100);

  function centuryLabel(c: number): string {
    if (c < 0) {
      return `公元前${Math.abs(c)}世纪`;
    }
    return `公元${c + 1}世纪`;
  }

  options.push({ label: centuryLabel(correctCentury), isCorrect: true });
  used.add(correctCentury);

  // Generate nearby century distractors
  const offsets = [-3, 3, -2, 2, -5, 5, -1, 1, -4, 4];
  for (const off of offsets) {
    if (options.length >= 4) break;
    const c = correctCentury + off;
    if (used.has(c)) continue;
    // Don't cross BC/AD boundary
    if (correctCentury < 0 && c >= 0) continue;
    if (correctCentury >= 0 && c < 0) continue;
    used.add(c);
    options.push({ label: centuryLabel(c), isCorrect: false });
  }

  // Fallback: fill from further out
  if (options.length < 4) {
    for (let off = 6; options.length < 4 && off < 20; off++) {
      for (const sign of [-1, 1]) {
        if (options.length >= 4) break;
        const c = correctCentury + sign * off;
        if (used.has(c)) continue;
        if (correctCentury < 0 && c >= 0) continue;
        if (correctCentury >= 0 && c < 0) continue;
        used.add(c);
        options.push({ label: centuryLabel(c), isCorrect: false });
      }
    }
  }

  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

/* ── Shared lit event card ── */

function LitEventCard({ event, compact, focus }: { event: HistoryEvent; compact?: boolean; focus?: boolean }) {
  const timeLabel = event.acceptableYears
    ? event.acceptableYears.map(formatYear).join(" / ")
    : event.endYear
      ? `${formatYear(event.year)}—${formatYear(event.endYear)}`
      : formatYear(event.year);
  return (
    <div className={`river-card event-card ${event.track} is-lit ${compact ? "compact" : ""} ${focus ? "focus-card" : ""}`}>
      <div className="event-card-row1">
        <time className="event-card-time">{timeLabel}</time>
        <span className="event-card-tag">{event.track === "china" ? "中国" : "世界"} · {event.category}</span>
      </div>
      <h4>{event.title}</h4>
      {event.summary && <p className="event-card-summary">{event.summary}</p>}
    </div>
  );
}

/* ── Format an interval option for display ── */

function formatInterval(start: number, end: number): string {
  return `${formatYear(start)}—${formatYear(end)}`;
}

export type TimeQuizProps = {
  event: HistoryEvent;
  allEvents: HistoryEvent[];
  masteredIds: string[];
  wrongIds: string[];
  markMastered: (id: string) => void;
  markWrong: (id: string) => void;
  onNext: () => void;
  onSwap?: () => void;
  nextLabel?: string;
};

export function TimeQuiz({
  event,
  allEvents,
  masteredIds,
  wrongIds,
  markMastered,
  markWrong,
  onNext,
  onSwap,
  nextLabel = "换一个事件",
}: TimeQuizProps) {
  const [fillValue, setFillValue] = useState("");
  const [phase, setPhase] = useState<"answering" | "result">("answering");
  const [answerMode, setAnswerMode] = useState<"input" | "hints" | "intervalChoice" | "centuryChoice">("input");
  const [hints, setHints] = useState<number[]>([]);
  const [intervalOptions, setIntervalOptions] = useState<IntervalOption[]>([]);
  const [centuryOptions, setCenturyOptions] = useState<CenturyOption[]>([]);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);

  // Determine quiz mode for this event (stable per event ID)
  const modeRef = useRef<QuizMode>("single");
  const endpointDirRef = useRef<"start" | "end">("start");
  const modeKey = useRef<string>("");

  const context = useMemo(() => computeContext(event, allEvents), [event, allEvents]);

  // Pick mode when event changes
  useEffect(() => {
    modeKey.current = event.id;
    modeRef.current = pickQuizMode(event);
    if (modeRef.current === "endpoint") {
      endpointDirRef.current = Math.random() < 0.5 ? "start" : "end";
    }

    // Set initial answer mode based on quiz mode
    if (modeRef.current === "intervalChoice") {
      setAnswerMode("intervalChoice");
      setIntervalOptions(generateIntervalChoices(event));
    } else if (modeRef.current === "centuryChoice") {
      setAnswerMode("centuryChoice");
      setCenturyOptions(generateCenturyChoices(event));
    } else {
      setAnswerMode("input");
    }
  }, [event.id]);

  // The target year for endpoint mode
  const targetYear = modeRef.current === "endpoint"
    ? (endpointDirRef.current === "start" ? event.year : event.endYear!)
    : event.year;

  const acceptableYears = event.acceptableYears ?? (modeRef.current === "endpoint" ? [targetYear] : [event.year]);
  const actualLabel = event.acceptableYears
    ? event.acceptableYears.map(formatYear).join(" 或 ")
    : event.endYear
      ? `${formatYear(event.year)}—${formatYear(event.endYear)}`
      : formatYear(event.year);

  useEffect(() => {
    setFillValue("");
    setPhase("answering");
    setHints([]);
    setAnsweredCorrect(false);
  }, [event.id]);

  // For intervalChoice/centuryChoice modes, fillValue holds the label text
  const answer = parseInt(fillValue, 10);
  const isNumericAnswer = !isNaN(answer) && fillValue.trim() !== "";
  const isCorrect = answeredCorrect;
  const relation = phase === "result"
    ? answeredCorrect
      ? "完全正确"
      : modeRef.current === "endpoint"
        ? `相差 ${Math.abs(answer - targetYear)} 年`
        : modeRef.current === "intervalChoice"
          ? "区间不正确"
          : modeRef.current === "centuryChoice"
            ? "世纪不正确"
            : event.endYear && isNumericAnswer
              ? answer >= event.year && answer <= event.endYear
                ? "落在事件区间内"
                : `距事件区间 ${answer < event.year ? event.year - answer : answer - event.endYear} 年`
              : isNumericAnswer
                ? `相差 ${Math.abs(answer - event.year)} 年`
                : null
    : null;

  // The prompt text based on mode
  const promptText = modeRef.current === "endpoint"
    ? (endpointDirRef.current === "start"
        ? "它开始于哪一年？"
        : "它结束于哪一年？")
    : modeRef.current === "intervalChoice"
      ? "选出正确的时间区间"
      : modeRef.current === "centuryChoice"
        ? "它属于哪个世纪？"
        : "它发生在哪一年？";

  function showHintChoices() {
    setHints(generateHintChoices(event, modeRef.current === "endpoint" ? targetYear : undefined));
    setAnswerMode("hints");
  }

  function submitWithValue(value: number) {
    const correct = acceptableYears.includes(value);
    setFillValue(String(value));
    setPhase("result");
    if (correct) {
      setAnsweredCorrect(true);
      markMastered(event.id);
    } else {
      markWrong(event.id);
    }
  }

  function submitIntervalOption(opt: IntervalOption) {
    setPhase("result");
    if (opt.isCorrect) {
      setAnsweredCorrect(true);
      markMastered(event.id);
    } else {
      markWrong(event.id);
    }
    // Store for display
    setFillValue(formatInterval(opt.start, opt.end));
  }

  function submitCenturyOption(opt: CenturyOption) {
    setPhase("result");
    if (opt.isCorrect) {
      setAnsweredCorrect(true);
      markMastered(event.id);
    } else {
      markWrong(event.id);
    }
    setFillValue(opt.label);
  }

  function submit() {
    if (!isNumericAnswer) return;
    setPhase("result");
    const correct = acceptableYears.includes(answer);
    setAnsweredCorrect(correct);
    if (correct) {
      markMastered(event.id);
    } else {
      markWrong(event.id);
    }
  }

  function reset() {
    setFillValue("");
    setPhase("answering");
    setAnsweredCorrect(false);
    // Re-pick mode for variety on retry
    modeRef.current = pickQuizMode(event);
    if (modeRef.current === "endpoint") {
      endpointDirRef.current = Math.random() < 0.5 ? "start" : "end";
    }
    if (modeRef.current === "intervalChoice") {
      setAnswerMode("intervalChoice");
      setIntervalOptions(generateIntervalChoices(event));
    } else if (modeRef.current === "centuryChoice") {
      setAnswerMode("centuryChoice");
      setCenturyOptions(generateCenturyChoices(event));
    } else {
      setAnswerMode("input");
    }
  }

  const alreadyMastered = masteredIds.includes(event.id);

  return (
    <div className="time-quiz">
      <div className="quiz-event-card">
        <div className="quiz-event-meta">
          <span>{event.track === "china" ? "中国" : "世界"}</span>
          <i>·</i>
          <span>{event.category}</span>
          {onSwap && phase === "answering" && (
            <button type="button" className="quiz-swap-btn" onClick={onSwap}>↻ 换一张</button>
          )}
        </div>
        <h3>{event.title}</h3>
        {alreadyMastered && <span className="quiz-mastered-badge">✓ 已掌握</span>}
        {wrongIds.includes(event.id) && !alreadyMastered && <span className="quiz-wrong-badge">待复习</span>}
        <div className="quiz-event-prompt">{promptText}</div>
      </div>

      {/* Mode: single or endpoint - manual input */}
      {phase === "answering" && answerMode === "input" && (
        <div className="quiz-answer-area">
          <div className="quiz-fill-input">
            <input
              type="number"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="输入年份，如 1405"
              aria-label="输入年份"
              autoFocus
            />
            <span className="quiz-fill-hint">负数表示公元前，如 -221</span>
          </div>

          <div className="quiz-actions-row">
            <button type="button" className="quiz-hint-button" onClick={showHintChoices}>
              需要提示？
            </button>
            <button
              type="button"
              className="quiz-submit"
              disabled={!isNumericAnswer}
              onClick={submit}
            >提交答案 →</button>
          </div>
        </div>
      )}

      {/* Mode: single or endpoint - hint choices */}
      {phase === "answering" && answerMode === "hints" && (
        <div className="quiz-answer-area">
          <div className="quiz-hints-label">选择正确年份</div>
          <div className="quiz-hint-choices">
            {hints.map((year) => (
              <button
                type="button"
                key={year}
                className="quiz-hint-choice"
                onClick={() => submitWithValue(year)}
              >
                {formatYear(year)}
              </button>
            ))}
          </div>
          <button type="button" className="quiz-back-input" onClick={() => setAnswerMode("input")}>
            ← 返回手动输入
          </button>
        </div>
      )}

      {/* Mode: interval choice */}
      {phase === "answering" && answerMode === "intervalChoice" && (
        <div className="quiz-answer-area">
          <div className="quiz-hints-label">选择正确时间区间</div>
          <div className="quiz-hint-choices quiz-interval-choices">
            {intervalOptions.map((opt, idx) => (
              <button
                type="button"
                key={idx}
                className="quiz-hint-choice quiz-interval-choice"
                onClick={() => submitIntervalOption(opt)}
              >
                {formatInterval(opt.start, opt.end)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode: century choice */}
      {phase === "answering" && answerMode === "centuryChoice" && (
        <div className="quiz-answer-area">
          <div className="quiz-hints-label">选择正确世纪</div>
          <div className="quiz-hint-choices">
            {centuryOptions.map((opt, idx) => (
              <button
                type="button"
                key={idx}
                className="quiz-hint-choice"
                onClick={() => submitCenturyOption(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="quiz-result" aria-live="polite">
          <div className="quiz-result-header">
            <div className={`quiz-result-badge ${answeredCorrect ? "correct" : "incorrect"}`}>
              {answeredCorrect ? "✓ 完全正确" : relation ?? "不正确"}
            </div>
            {!answeredCorrect && (
              <div className="quiz-result-time">
                <div className="quiz-result-your">
                  <span>你的答案</span>
                  <strong>{fillValue || "—"}</strong>
                </div>
                <div className="quiz-result-actual">
                  <span>正确时间</span>
                  <strong>{actualLabel}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="quiz-context">
            <div className="quiz-context-section">
              <span className="quiz-context-label">前后与同期事件</span>
              <div className="quiz-context-grid">
                {context.before && (
                  <div className="quiz-context-item">
                    <span className="quiz-context-tag">此前发生</span>
                    <LitEventCard event={context.before} compact />
                  </div>
                )}
                <div className="quiz-context-item">
                  <span className="quiz-context-tag focus-tag">当前事件</span>
                  <LitEventCard event={event} compact focus />
                </div>
                {context.after && (
                  <div className="quiz-context-item">
                    <span className="quiz-context-tag">此后发生</span>
                    <LitEventCard event={context.after} compact />
                  </div>
                )}
                {context.simultaneous && (
                  <div className="quiz-context-item">
                    <span className="quiz-context-tag simultaneous-tag">
                      同期{context.simultaneous.track === "china" ? "中国" : "世界"}
                    </span>
                    <LitEventCard event={context.simultaneous} compact />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="quiz-result-actions">
            <button type="button" className="quiz-reset" onClick={reset}>再答一次</button>
            <button type="button" className="quiz-next" onClick={onNext}>
              {nextLabel} <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
