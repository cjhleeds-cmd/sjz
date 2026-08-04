"use client";

import { useEffect, useMemo, useState } from "react";
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

function generateHintChoices(event: HistoryEvent): number[] {
  const correct = event.year;
  const absYear = Math.abs(correct);
  const acceptableYears = event.acceptableYears ?? [correct];

  // 根据标准答案数值确定最小间距、生成范围和取整粒度
  // 最小间距与答案量级成正比，确保选项有区分度、有做题价值
  let minSpacing: number;
  let range: number;
  let roundUnit: number;

  if (absYear >= 100000) {
    // 史前时代（10万年以上，如旧石器时代约300万年前）：选项以万年为粒度
    roundUnit = 10000;
    minSpacing = Math.max(50000, Math.round(absYear * 0.05 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.3, minSpacing * 4);
  } else if (absYear >= 10000) {
    // 新石器时代等（1万~10万年）：选项以千年为粒度
    roundUnit = 1000;
    minSpacing = Math.max(2000, Math.round(absYear * 0.1 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.5, minSpacing * 4);
  } else if (correct < 0 && absYear >= 2000) {
    // 文明起源（前3500~前2071）：选项以50年为粒度
    roundUnit = 50;
    minSpacing = Math.max(100, Math.round(absYear * 0.05 / roundUnit) * roundUnit);
    range = Math.max(absYear * 0.3, minSpacing * 5);
  } else {
    // 其他时期
    roundUnit = correct < 0 ? 10 : 5;
    minSpacing = correct < 0 ? 50 : 20;
    range = Math.max(minSpacing * 6, absYear * 0.15);
  }

  const choices = new Set<number>(acceptableYears);
  let attempts = 0;
  const maxAttempts = 300;

  while (choices.size < 4 && attempts < maxAttempts) {
    attempts++;
    // 随机偏移，四舍五入到 roundUnit 粒度
    const rawDelta = (Math.random() * 2 - 1) * range;
    const delta = Math.round(rawDelta / roundUnit) * roundUnit;
    if (delta === 0 || acceptableYears.includes(correct + delta)) continue;

    const newChoice = correct + delta;

    // BC/AD 不混用，保持同一纪元
    if (correct < 0 && newChoice > 0) continue;
    if (correct > 0 && newChoice < 0) continue;

    // 检查与所有已有选项的最小间距
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

  // Fallback 1: 使用固定倍数偏移，仍保持最小间距
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

  // Fallback 2: 忽略间距约束，确保至少4个选项，避免卡死
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

/* ── Shared lit event card (matches timeline mastered card) ── */

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

export type TimeQuizProps = {
  event: HistoryEvent;
  allEvents: HistoryEvent[];
  masteredIds: string[];
  wrongIds: string[];
  markMastered: (id: string) => void;
  markWrong: (id: string) => void;
  onNext: () => void;
  onSwap?: () => void;
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
}: TimeQuizProps) {
  const [fillValue, setFillValue] = useState("");
  const [phase, setPhase] = useState<"answering" | "result">("answering");
  const [answerMode, setAnswerMode] = useState<"input" | "hints">("input");
  const [hints, setHints] = useState<number[]>([]);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);

  const context = useMemo(() => computeContext(event, allEvents), [event, allEvents]);
  const acceptableYears = event.acceptableYears ?? [event.year];
  const actualLabel = event.acceptableYears
    ? event.acceptableYears.map(formatYear).join(" 或 ")
    : event.endYear
      ? `${formatYear(event.year)}—${formatYear(event.endYear)}`
      : formatYear(event.year);

  useEffect(() => {
    setFillValue("");
    setPhase("answering");
    setAnswerMode("input");
    setHints([]);
    setAnsweredCorrect(false);
  }, [event.id]);

  const answer = parseInt(fillValue, 10);
  const hasAnswer = fillValue.trim() !== "" && !isNaN(answer);
  const isCorrect = hasAnswer && acceptableYears.includes(answer);
  const relation = hasAnswer
    ? acceptableYears.includes(answer)
      ? "完全正确"
      : event.endYear
        ? answer >= event.year && answer <= event.endYear
          ? "落在事件区间内"
          : `距事件区间 ${answer < event.year ? event.year - answer : answer - event.endYear} 年`
        : Math.abs(answer - event.year) === 0
          ? "完全正确"
          : `相差 ${Math.abs(answer - event.year)} 年`
    : null;

  function showHintChoices() {
    setHints(generateHintChoices(event));
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

  function submit() {
    if (!hasAnswer) return;
    setPhase("result");
    if (isCorrect) {
      setAnsweredCorrect(true);
      markMastered(event.id);
    } else {
      markWrong(event.id);
    }
  }

  function reset() {
    setFillValue("");
    setPhase("answering");
    setAnswerMode("input");
    setHints([]);
    setAnsweredCorrect(false);
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
        <div className="quiz-event-prompt">它发生在哪一年？</div>
      </div>

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
              disabled={!hasAnswer}
              onClick={submit}
            >提交答案 →</button>
          </div>
        </div>
      )}

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

      {phase === "result" && (
        <div className="quiz-result" aria-live="polite">
          <div className="quiz-result-header">
            <div className={`quiz-result-badge ${isCorrect ? "correct" : "incorrect"}`}>
              {isCorrect ? "✓ 完全正确" : relation}
            </div>
            {!isCorrect && (
              <div className="quiz-result-time">
                <div className="quiz-result-your">
                  <span>你的答案</span>
                  <strong>{formatYear(answer)}</strong>
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
              换一个事件 <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
