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
  const offset = 200;
  const choices = new Set<number>([correct]);
  while (choices.size < 4) {
    const delta = Math.floor(Math.random() * (offset * 2)) - offset;
    if (delta === 0) continue;
    choices.add(correct + delta);
  }
  return [...choices].sort((a, b) => a - b);
}

/* ── Shared lit event card (matches timeline mastered card) ── */

function LitEventCard({ event, compact }: { event: HistoryEvent; compact?: boolean }) {
  const timeLabel = event.endYear
    ? `${formatYear(event.year)}—${formatYear(event.endYear)}`
    : formatYear(event.year);
  return (
    <div className={`river-card event-card ${event.track} is-lit ${compact ? "compact" : ""}`}>
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
};

export function TimeQuiz({
  event,
  allEvents,
  masteredIds,
  wrongIds,
  markMastered,
  markWrong,
  onNext,
}: TimeQuizProps) {
  const [fillValue, setFillValue] = useState("");
  const [phase, setPhase] = useState<"answering" | "result">("answering");
  const [answerMode, setAnswerMode] = useState<"input" | "hints">("input");
  const [hints, setHints] = useState<number[]>([]);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);

  const context = useMemo(() => computeContext(event, allEvents), [event, allEvents]);
  const actualLabel = event.endYear
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
  const isCorrect = hasAnswer && answer === event.year;
  const relation = hasAnswer
    ? event.endYear
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
    const correct = value === event.year;
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
              <span className="quiz-context-label">事件简介</span>
              <LitEventCard event={event} />
            </div>

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
                  <LitEventCard event={event} compact />
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
