"use client";

import { useMemo, useState } from "react";
import type { HistoryEvent } from "./history-data";

export type QuizMode = "fill" | "choice";
export type QuizPhase = "answering" | "result";

export type TimeQuizProps = {
  event: HistoryEvent;
  allEvents: HistoryEvent[];
  formatYear: (year: number) => string;
  findDynastyForYear: (year: number) => { label: string; id: string };
  onOpenEvent?: (event: HistoryEvent) => void;
  onNext?: () => void;
};

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

function generateChoices(event: HistoryEvent, allEvents: HistoryEvent[]): number[] {
  const correct = event.year;
  const pool = allEvents
    .filter((e) => e.id !== event.id && Math.abs(e.year - correct) >= 20)
    .map((e) => e.year);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  return [...shuffled, correct].sort(() => Math.random() - 0.5);
}

function relationCopy(event: HistoryEvent, answer: number) {
  if (event.endYear !== undefined) {
    if (answer >= event.year && answer <= event.endYear) return "落在事件区间内";
    const distance = answer < event.year ? event.year - answer : answer - event.endYear;
    return `距事件区间 ${distance} 年`;
  }
  const distance = Math.abs(answer - event.year);
  return distance === 0 ? "完全正确" : `相差 ${distance} 年`;
}

function centuryForYear(year: number) {
  if (year < 0) return `公元前${Math.ceil(Math.abs(year) / 100)}世纪`;
  return `${Math.max(1, Math.ceil(year / 100))}世纪`;
}

export function TimeQuiz({
  event,
  allEvents,
  formatYear,
  findDynastyForYear,
  onOpenEvent,
  onNext,
}: TimeQuizProps) {
  const [mode, setMode] = useState<QuizMode>("fill");
  const [phase, setPhase] = useState<QuizPhase>("answering");
  const [fillValue, setFillValue] = useState("");
  const [choiceValue, setChoiceValue] = useState<number | null>(null);
  const [choices, setChoices] = useState<number[]>(() => generateChoices(event, allEvents));

  const context = useMemo(() => computeContext(event, allEvents), [event, allEvents]);
  const dynasty = findDynastyForYear(event.year);
  const actualLabel = event.endYear
    ? `${formatYear(event.year)}—${formatYear(event.endYear)}`
    : formatYear(event.year);

  const answer = mode === "fill" ? parseInt(fillValue, 10) : choiceValue;
  const hasAnswer = mode === "fill" ? fillValue.trim() !== "" && !isNaN(answer as number) : choiceValue !== null;
  const isCorrect = hasAnswer && answer === event.year;
  const relation = hasAnswer ? relationCopy(event, answer as number) : null;

  function switchMode(next: QuizMode) {
    if (next === mode) return;
    setMode(next);
    setPhase("answering");
    setFillValue("");
    setChoiceValue(null);
    if (next === "choice") {
      setChoices(generateChoices(event, allEvents));
    }
  }

  function submit() {
    if (!hasAnswer) return;
    setPhase("result");
  }

  function reset() {
    setPhase("answering");
    setFillValue("");
    setChoiceValue(null);
    setChoices(generateChoices(event, allEvents));
  }

  const memorySentence = `${event.title}发生在${dynasty.label}，大约是${centuryForYear(event.year)}；此前${context.before?.title ?? "历史条件正在形成"}，此后${context.after?.title ?? "新的变化继续展开"}${context.simultaneous ? `；同期${context.simultaneous.title}` : ""}。`;

  return (
    <div className="time-quiz">
      {/* Mode switcher */}
      <div className="quiz-mode-switch" role="tablist" aria-label="答题模式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "fill"}
          className={mode === "fill" ? "active" : ""}
          onClick={() => switchMode("fill")}
        >填空题</button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "choice"}
          className={mode === "choice" ? "active" : ""}
          onClick={() => switchMode("choice")}
        >选择题</button>
      </div>

      {/* Event card */}
      <div className="quiz-event-card">
        <div className="quiz-event-meta">
          <span>{event.track === "china" ? "中国" : "世界"}</span>
          <i>·</i>
          <span>{event.category}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{event.summary}</p>
        <div className="quiz-event-prompt">它发生在哪一年？</div>
      </div>

      {/* Answer area */}
      {phase === "answering" && (
        <div className="quiz-answer-area">
          {mode === "fill" ? (
            <div className="quiz-fill-input">
              <input
                type="number"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="输入年份，如 1405"
                aria-label="输入年份"
              />
              <span className="quiz-fill-hint">负数表示公元前，如 -221</span>
            </div>
          ) : (
            <div className="quiz-choices">
              {choices.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={choiceValue === year ? "selected" : ""}
                  onClick={() => setChoiceValue(year)}
                >
                  {formatYear(year)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="quiz-submit"
            disabled={!hasAnswer}
            onClick={submit}
          >提交答案 →</button>
        </div>
      )}

      {/* Result area */}
      {phase === "result" && hasAnswer && (
        <div className="quiz-result" aria-live="polite">
          <div className="quiz-result-header">
            <div className={`quiz-result-badge ${isCorrect ? "correct" : "incorrect"}`}>
              {isCorrect ? "完全正确" : relation}
            </div>
            <div className="quiz-result-time">
              <div className="quiz-result-your">
                <span>你的答案</span>
                <strong>{formatYear(answer as number)}</strong>
              </div>
              <div className="quiz-result-actual">
                <span>真实时间</span>
                <strong>{actualLabel}</strong>
              </div>
            </div>
          </div>

          <div className="quiz-description">
            <span>事件描述</span>
            <p>{event.scene}</p>
          </div>

          <div className="quiz-memory">
            <span>把它说成一句话</span>
            <p>{memorySentence}</p>
          </div>

          <div className="quiz-relations">
            <span className="quiz-relations-label">点击查看前后事件与同期世界</span>
            <div className="quiz-relations-grid">
              <button
                type="button"
                disabled={!context.before}
                onClick={() => context.before && onOpenEvent?.(context.before)}
              >
                <span>此前</span>
                <strong>{context.before?.title ?? "历史条件正在形成"}</strong>
              </button>
              <i aria-hidden="true">→</i>
              <button
                type="button"
                className="focus"
                onClick={() => onOpenEvent?.(event)}
              >
                <span>{actualLabel}</span>
                <strong>{event.title}</strong>
              </button>
              <i aria-hidden="true">→</i>
              <button
                type="button"
                disabled={!context.after}
                onClick={() => context.after && onOpenEvent?.(context.after)}
              >
                <span>此后</span>
                <strong>{context.after?.title ?? "新的变化继续展开"}</strong>
              </button>
              {context.simultaneous && (
                <button
                  type="button"
                  className="simultaneous"
                  onClick={() => onOpenEvent?.(context.simultaneous)}
                >
                  <span>同期{context.simultaneous.track === "china" ? "中国" : "世界"}</span>
                  <strong>{context.simultaneous.title}</strong>
                </button>
              )}
            </div>
          </div>

          <div className="quiz-actions">
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
