"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { HistoryEvent, TemporalType, Track } from "./history-data";

export type PlacementFigure = {
  id: string;
  name: string;
  anchorYear: number;
  track: Track;
  identity: string;
  summary: string;
  relatedEventId?: string;
  placementYear?: number;
  placementEndYear?: number;
  placementTemporalType?: TemporalType;
  placementEnabled?: boolean;
};

export type PlacementDynasty = {
  id: string;
  label: string;
  shortLabel: string;
  dates: string;
  start: number;
  end: number;
};

type TimePlacementProps = {
  events: HistoryEvent[];
  figures: PlacementFigure[];
  dynasties: PlacementDynasty[];
  formatYear: (year: number) => string;
  findDynastyForYear: (year: number) => PlacementDynasty;
  initialItemKey?: string;
  onOpenEvent?: (event: HistoryEvent) => void;
  onRecordSaved?: (record: InsertionRecord) => void;
};

type PlacementItem = {
  key: string;
  id: string;
  kind: "event" | "figure";
  title: string;
  startYear: number;
  endYear?: number;
  temporalType: TemporalType;
  track: Track;
  category: string;
  summary: string;
  event?: HistoryEvent;
  relatedEventId?: string;
};

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  year: number;
  overTimeline: boolean;
};

export type InsertionRecord = {
  id: string;
  itemKey: string;
  title: string;
  kind: PlacementItem["kind"];
  placedYear: number;
  actual: string;
  relation: string;
  completedAt: number;
};

const STORAGE_KEY = "history-river-time-insertions-v1";
const CURRENT_YEAR = new Date().getFullYear();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function centuryForYear(year: number) {
  if (year < 0) return `公元前${Math.ceil(Math.abs(year) / 100)}世纪`;
  return `${Math.max(1, Math.ceil(year / 100))}世纪`;
}

function dynastyEnd(dynasty: PlacementDynasty) {
  return dynasty.end > 2200 ? CURRENT_YEAR : dynasty.end;
}

function phaseForYear(dynasty: PlacementDynasty, year: number) {
  const end = dynastyEnd(dynasty);
  const ratio = clamp((year - dynasty.start) / Math.max(1, end - dynasty.start), 0, 1);
  if (ratio < 0.34) return "前期";
  if (ratio < 0.67) return "中期";
  return "后期";
}

function actualLabel(item: PlacementItem, formatYear: (year: number) => string) {
  return item.endYear === undefined
    ? formatYear(item.startYear)
    : `${formatYear(item.startYear)}—${formatYear(item.endYear)}`;
}

function relationCopy(item: PlacementItem, placedYear: number) {
  if (item.endYear !== undefined) {
    if (placedYear >= item.startYear && placedYear <= item.endYear) return "落在事件区间内";
    const distance = placedYear < item.startYear ? item.startYear - placedYear : placedYear - item.endYear;
    return `距事件区间 ${distance} 年`;
  }
  const distance = Math.abs(placedYear - item.startYear);
  return distance === 0 ? "落在事件年份" : `相差 ${distance} 年`;
}

function recordDate(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function readTimeInsertionRecords() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as InsertionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function itemEnd(item: PlacementItem) {
  return item.endYear ?? item.startYear;
}

export function TimePlacement({
  events,
  figures,
  dynasties,
  formatYear,
  findDynastyForYear,
  initialItemKey,
  onOpenEvent,
  onRecordSaved,
}: TimePlacementProps) {
  const allItems = useMemo<PlacementItem[]>(() => [
    ...events
      .filter((event) => event.placementEnabled !== false)
      .map((event) => {
        const startYear = event.placementYear ?? event.year;
        const endYear = event.placementEndYear ?? event.endYear;
        return {
          key: `event:${event.id}`,
          id: event.id,
          kind: "event" as const,
          title: event.title,
          startYear,
          endYear,
          temporalType: event.temporalType ?? (endYear === undefined ? "point" : "range"),
          track: event.track,
          category: event.category,
          summary: event.summary,
          event,
        };
      }),
    ...figures
      .filter((figure) => figure.placementEnabled !== false)
      .map((figure) => ({
        key: `figure:${figure.id}`,
        id: figure.id,
        kind: "figure" as const,
        title: figure.name,
        startYear: figure.placementYear ?? figure.anchorYear,
        endYear: figure.placementEndYear,
        temporalType: figure.placementTemporalType ?? (figure.placementEndYear === undefined ? "point" : "range"),
        track: figure.track,
        category: figure.identity,
        summary: figure.summary,
        relatedEventId: figure.relatedEventId,
      })),
  ], [events, figures]);

  const initialIndex = Math.max(0, allItems.findIndex((item) => item.key === initialItemKey));
  const [itemIndex, setItemIndex] = useState(initialIndex);
  const [panel, setPanel] = useState<"game" | "records">("game");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [placedYear, setPlacedYear] = useState<number | null>(null);
  const [notice, setNotice] = useState("按住卡片，拖进下方时间链");
  const [records, setRecords] = useState<InsertionRecord[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const item = allItems[itemIndex] ?? allItems[0];
  const dynasty = item ? findDynastyForYear(item.startYear) : dynasties[0];
  const windowStart = dynasty?.start ?? 0;
  const windowEnd = Math.max(dynasty ? dynastyEnd(dynasty) : CURRENT_YEAR, item ? itemEnd(item) : CURRENT_YEAR);

  useEffect(() => {
    let active = true;
    const saved = readTimeInsertionRecords();
    queueMicrotask(() => {
      if (active) setRecords(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const context = useMemo(() => {
    if (!item) return { anchors: [], before: undefined, after: undefined, simultaneous: undefined };
    const others = allItems.filter((candidate) => candidate.key !== item.key);
    const sameTrack = others.filter((candidate) => candidate.track === item.track);
    const beforePool = sameTrack.some((candidate) => itemEnd(candidate) < item.startYear) ? sameTrack : others;
    const afterPool = sameTrack.some((candidate) => candidate.startYear > itemEnd(item)) ? sameTrack : others;
    const before = [...beforePool]
      .filter((candidate) => itemEnd(candidate) < item.startYear)
      .sort((a, b) => itemEnd(b) - itemEnd(a))[0];
    const after = [...afterPool]
      .filter((candidate) => candidate.startYear > itemEnd(item))
      .sort((a, b) => a.startYear - b.startYear)[0];
    const midpoint = (item.startYear + itemEnd(item)) / 2;
    const simultaneous = [...others]
      .filter((candidate) => candidate.track !== item.track && candidate.key !== before?.key && candidate.key !== after?.key)
      .sort((a, b) => {
        const aOverlaps = a.startYear <= itemEnd(item) && itemEnd(a) >= item.startYear;
        const bOverlaps = b.startYear <= itemEnd(item) && itemEnd(b) >= item.startYear;
        if (aOverlaps !== bOverlaps) return aOverlaps ? -1 : 1;
        return Math.abs(a.startYear - midpoint) - Math.abs(b.startYear - midpoint);
      })[0];
    const anchors = others
      .filter((candidate) => candidate.startYear >= windowStart && candidate.startYear <= windowEnd)
      .filter((candidate) => {
        if (item.kind === "event" && candidate.kind === "figure" && candidate.relatedEventId === item.id) return false;
        if (item.kind === "figure" && candidate.kind === "event" && item.relatedEventId && candidate.id === item.relatedEventId) return false;
        return true;
      })
      .sort((a, b) => Math.abs(a.startYear - midpoint) - Math.abs(b.startYear - midpoint))
      .filter((candidate, index, list) => list.findIndex((other) => other.startYear === candidate.startYear) === index)
      .slice(0, 5)
      .sort((a, b) => a.startYear - b.startYear);
    return { anchors, before, after, simultaneous };
  }, [allItems, item, windowEnd, windowStart]);

  if (!item || !dynasty) {
    return <section className="placement-section"><p>暂时没有可用于时间嵌入的事件。</p></section>;
  }

  function timelineRatio(year: number) {
    return clamp((year - windowStart) / Math.max(1, windowEnd - windowStart), 0, 1);
  }

  function timelinePercent(year: number) {
    return 7 + timelineRatio(year) * 86;
  }

  function timelineLeft(year: number) {
    return `${timelinePercent(year)}%`;
  }

  function writeDrag(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function dragAt(pointerId: number, clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const axisStart = rect.left + rect.width * 0.07;
    const axisWidth = rect.width * 0.86;
    const ratio = clamp((clientX - axisStart) / axisWidth, 0, 1);
    const year = Math.round(windowStart + ratio * (windowEnd - windowStart));
    const overTimeline = clientX >= rect.left - 18
      && clientX <= rect.right + 18
      && clientY >= rect.top - 95
      && clientY <= rect.bottom + 50;
    return { pointerId, clientX, clientY, year, overTimeline };
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlacedYear(null);
    setNotice("移动时间针，松手放下");
    writeDrag(dragAt(event.pointerId, event.clientX, event.clientY));
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    writeDrag(dragAt(event.pointerId, event.clientX, event.clientY));
  }

  function saveInsertion(year: number) {
    setPlacedYear(year);
    setNotice("已嵌入，看看它与前后事件的距离");
    const nextRecord: InsertionRecord = {
      id: `${Date.now()}-${item.key}`,
      itemKey: item.key,
      title: item.title,
      kind: item.kind,
      placedYear: year,
      actual: actualLabel(item, formatYear),
      relation: relationCopy(item, year),
      completedAt: Date.now(),
    };
    setRecords((current) => {
      const next = [nextRecord, ...current].slice(0, 80);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 本地记录不可用时，只保留当前结果。
      }
      return next;
    });
    onRecordSaved?.(nextRecord);
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const last = dragAt(event.pointerId, event.clientX, event.clientY) ?? dragRef.current;
    writeDrag(null);
    if (!last.overTimeline) {
      setNotice("再试一次：拖到右侧时间链");
      return;
    }
    saveInsertion(last.year);
  }

  function cancelDrag() {
    writeDrag(null);
    setNotice("按住卡片，拖进下方时间链");
  }

  function resetCurrent() {
    setPlacedYear(null);
    writeDrag(null);
    setNotice("按住卡片，重新放一次");
  }

  function nextItem() {
    setItemIndex((current) => (current + 1) % allItems.length);
    setPlacedYear(null);
    writeDrag(null);
    setNotice("按住卡片，拖进下方时间链");
    setPanel("game");
  }

  function openItem(candidate: PlacementItem | undefined) {
    if (!candidate || !onOpenEvent) return;
    if (candidate.event) {
      onOpenEvent(candidate.event);
      return;
    }
    const related = events.find((event) => event.id === candidate.relatedEventId);
    if (related) onOpenEvent(related);
  }

  const actual = actualLabel(item, formatYear);
  const result = placedYear === null ? null : relationCopy(item, placedYear);
  const periodPhase = phaseForYear(dynasty, item.startYear);
  const eventType = item.temporalType === "point" ? "时间点" : item.temporalType === "series" ? "系列事件" : "时间段";
  const actualStart = timelinePercent(item.startYear);
  const actualEnd = timelinePercent(itemEnd(item));
  const spokenPosition = item.track === "china"
    ? `${dynasty.label}${periodPhase}`
    : `世界史中，对照中国约在${dynasty.label}${periodPhase}`;
  const memorySentence = `${item.title}发生在${spokenPosition}，大约是${centuryForYear(item.startYear)}；此前${context.before?.title ?? "历史条件正在形成"}，此后${context.after?.title ?? "新的变化继续展开"}${context.simultaneous ? `；同期${context.simultaneous.title}` : ""}。`;

  return (
    <section className="placement-section insertion-section" id="placement">
      <div className="section-heading placement-heading insertion-heading">
        <div>
          <span className="eyebrow">02 · INSERT IT IN TIME</span>
          <h2>进入时空</h2>
        </div>
        <p>把事件落入已有时间链。位置、前后关系和同期世界会一起留下记忆。</p>
      </div>

      <div className="placement-shell insertion-shell">
        <div className="placement-tabs insertion-tabs" role="tablist" aria-label="进入时空模块">
          <button type="button" role="tab" aria-selected={panel === "game"} className={panel === "game" ? "active" : ""} onClick={() => setPanel("game")}>事件嵌入</button>
          <button type="button" role="tab" aria-selected={panel === "records"} className={panel === "records" ? "active" : ""} onClick={() => setPanel("records")}>做题记录 <span>{records.length}</span></button>
        </div>

        {panel === "game" ? (
          <div className="insertion-game">
            <div className="insertion-guide" aria-label="操作步骤">
              <span><b>1</b>按住事件</span><i />
              <span><b>2</b>拖进时间链</span><i />
              <span><b>3</b>松手看关系</span>
            </div>

            <div className="insertion-toolbar">
              <div><span>第 {itemIndex + 1} / {allItems.length} 张</span><b>{item.kind === "figure" ? "人物" : eventType}</b></div>
              <button type="button" className="insertion-swap" onClick={nextItem}>换一张 <span>↻</span></button>
            </div>

            <div className="insertion-layout">
              <aside className="insertion-source">
                <span className="insertion-source-label">待嵌入{item.kind === "figure" ? "人物" : "事件"}</span>
                <button
                  type="button"
                  className={`insertion-card ${drag ? "is-dragging" : ""}`}
                  aria-label={`拖动${item.title}，放进时间链`}
                  onPointerDown={beginDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={finishDrag}
                  onPointerCancel={cancelDrag}
                >
                  <span className="insertion-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                  <span className="insertion-type">{item.track === "china" ? "中国" : "世界"} · {item.kind === "figure" ? "人物" : eventType}</span>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <span className="insertion-drag-action">按住拖动 <b>↘</b></span>
                </button>
                <p className="insertion-notice" aria-live="polite"><span>↓</span>{notice}</p>
              </aside>

              <div className="insertion-timeline-panel">
                <div className="insertion-timeline-heading">
                  <div><span>把它插在哪里？</span><strong>{dynasty.label} · {formatYear(windowStart)}—{formatYear(windowEnd)}</strong></div>
                  <small>只可拖动放置</small>
                </div>

                <div ref={boardRef} className={`insertion-board ${drag?.overTimeline ? "is-ready" : ""} ${placedYear !== null ? "has-result" : ""}`}>
                  <div className="insertion-axis" aria-hidden="true"><i /><i /></div>

                  {context.anchors.map((anchor, index) => (
                    <div
                      className={`insertion-anchor ${index % 2 === 0 ? "upper" : "lower"} ${anchor.track}`}
                      style={{ left: timelineLeft(anchor.startYear) }}
                      key={anchor.key}
                    >
                      <span />
                      <time>{formatYear(anchor.startYear)}</time>
                      <strong>{anchor.title}</strong>
                    </div>
                  ))}

                  {drag && (
                    <div className={`insertion-cursor ${drag.overTimeline ? "active" : ""}`} style={{ left: timelineLeft(drag.year) }} aria-hidden="true">
                      <div className="insertion-loupe"><span>约</span><strong>{formatYear(drag.year)}</strong></div>
                      <i />
                    </div>
                  )}

                  {placedYear !== null && (
                    <>
                      <div className="insertion-chosen" style={{ left: timelineLeft(placedYear) }}><span>你的落点</span><strong>{formatYear(placedYear)}</strong></div>
                      {item.endYear === undefined ? (
                        <div className="insertion-actual-marker" style={{ left: `${actualStart}%` }}><i /><span>{item.title}</span></div>
                      ) : (
                        <div className="insertion-actual-range" style={{ left: `${actualStart}%`, width: `${Math.max(1.2, actualEnd - actualStart)}%` }}><span>{item.title}</span></div>
                      )}
                    </>
                  )}

                  {!drag && placedYear === null && <div className="insertion-drop-hint"><i>＋</i><span>将卡片拖到这里</span></div>}
                </div>
              </div>
            </div>

            {result && placedYear !== null && (
              <div className="insertion-result" aria-live="polite">
                <header>
                  <div className="insertion-result-badge">{result}</div>
                  <div><span>你的落点 {formatYear(placedYear)}</span><h3>真实时间：{actual}</h3></div>
                </header>

                <div className="insertion-memory">
                  <span>把它说成一句话</span>
                  <p>{memorySentence}</p>
                </div>

                <div className="insertion-relations">
                  <span className="insertion-relations-label">点击查看前后事件与同期世界</span>
                  <div className="insertion-relations-grid">
                    <button type="button" disabled={!context.before} onClick={() => openItem(context.before)}><span>此前</span><strong>{context.before?.title ?? "历史条件正在形成"}</strong></button>
                    <i aria-hidden="true">→</i>
                    <button type="button" className="focus" onClick={() => openItem(item)}><span>{actual}</span><strong>{item.title}</strong></button>
                    <i aria-hidden="true">→</i>
                    <button type="button" disabled={!context.after} onClick={() => openItem(context.after)}><span>此后</span><strong>{context.after?.title ?? "新的变化继续展开"}</strong></button>
                    {context.simultaneous && <button type="button" className="simultaneous" onClick={() => openItem(context.simultaneous)}><span>同期{context.simultaneous.track === "china" ? "中国" : "世界"}</span><strong>{context.simultaneous.title}</strong></button>}
                  </div>
                </div>

                <div className="insertion-actions">
                  <button type="button" className="secondary-action" onClick={resetCurrent}>再放一次</button>
                  <button type="button" className="primary-action" onClick={nextItem}>换下一个{item.kind === "figure" ? "人物" : "事件"} <span>→</span></button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="insertion-records" id="insertion-records">
            <div className="insertion-records-head"><div><h3>做题记录</h3></div><p>保留落点与时间差，方便回看。</p></div>
            {records.length ? (
              <div className="insertion-record-list">
                {records.map((record) => (
                  <article key={record.id}>
                    <time>{formatYear(record.placedYear)}</time>
                    <div><span>{record.kind === "figure" ? "人物" : "事件"} · {recordDate(record.completedAt)}</span><strong>{record.title}</strong><small>真实时间 {record.actual}</small></div>
                    <b>{record.relation}</b>
                  </article>
                ))}
              </div>
            ) : (
              <div className="insertion-record-empty"><span>○</span><p>第一次放下卡片后，记录会出现在这里。</p><button type="button" onClick={() => setPanel("game")}>开始嵌入</button></div>
            )}
          </div>
        )}
      </div>

      {drag && (
        <div className="insertion-ghost" style={{ left: drag.clientX, top: drag.clientY } as CSSProperties} aria-hidden="true">
          <span>{item.kind === "figure" ? "人物" : eventType}</span><strong>{item.title}</strong><small>{drag.overTimeline ? `放在约 ${formatYear(drag.year)}` : "移向时间链"}</small>
        </div>
      )}
    </section>
  );
}
