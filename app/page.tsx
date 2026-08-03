"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  dynasties,
  eventById,
  events,
  findDynastyForYear,
  formatYear,
} from "./history-data";
import { TimeQuiz } from "./time-quiz";
import { TimeDetective } from "./time-detective";

export type AppView = "home" | "quiz" | "timeline" | "detective";

const STORAGE_KEY_MASTERED = "history-mastered-ids";
const STORAGE_KEY_WRONG = "history-wrong-ids";

export function useQuizState() {
  const [masteredIds, setMasteredIds] = useState<string[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const readyRef = useRef(false);

  useEffect(() => {
    try {
      setMasteredIds(JSON.parse(localStorage.getItem(STORAGE_KEY_MASTERED) ?? "[]"));
      setWrongIds(JSON.parse(localStorage.getItem(STORAGE_KEY_WRONG) ?? "[]"));
    } catch {
      setMasteredIds([]);
      setWrongIds([]);
    }
    readyRef.current = true;
  }, []);

  function markMastered(id: string) {
    setMasteredIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(STORAGE_KEY_MASTERED, JSON.stringify(next));
      return next;
    });
    setWrongIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((item) => item !== id);
      localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(next));
      return next;
    });
  }

  function markWrong(id: string) {
    setWrongIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(next));
      return next;
    });
  }

  function resetAll() {
    setMasteredIds([]);
    setWrongIds([]);
    localStorage.removeItem(STORAGE_KEY_MASTERED);
    localStorage.removeItem(STORAGE_KEY_WRONG);
  }

  return { masteredIds, wrongIds, markMastered, markWrong, resetAll, readyRef };
}

function getEventStatus(eventId: string, masteredIds: string[], wrongIds: string[]): "mastered" | "wrong" | "unanswered" {
  if (masteredIds.includes(eventId)) return "mastered";
  if (wrongIds.includes(eventId)) return "wrong";
  return "unanswered";
}

function getDailyEventIds(count: number): string[] {
  const shuffled = [...events];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((e) => e.id);
}

const DAILY_COUNT = 5;

export function HistoryApp({ view = "home" }: { view?: AppView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentFilter, setContentFilter] = useState<"全部" | "中国" | "世界">("全部");
  const [expandedDynastyIds, setExpandedDynastyIds] = useState<string[]>([]);
  const { masteredIds, wrongIds, markMastered, markWrong, resetAll } = useQuizState();

  function toggleDynasty(id: string) {
    setExpandedDynastyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className={`site-shell view-${view}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="历史长河首页">
          <span className="brand-seal" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 12c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 18c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/></svg></span>
          <span>
            <strong>历史长河</strong>
            <small>HISTORY IN CONTEXT</small>
          </span>
        </Link>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="主要导航">
          <Link className={view === "quiz" ? "active" : ""} href="/quiz" onClick={() => setMenuOpen(false)}>时间填空</Link>
          <Link className={view === "timeline" ? "active" : ""} href="/timeline" onClick={() => setMenuOpen(false)}>历史时间轴</Link>
          <Link className={view === "detective" ? "active" : ""} href="/detective" onClick={() => setMenuOpen(false)}>时空侦探</Link>
        </nav>
        <div className="header-actions">
          <button className="menu-button" type="button" aria-label="展开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
      </header>

      {view === "home" && <HomeView masteredIds={masteredIds} wrongIds={wrongIds} markMastered={markMastered} markWrong={markWrong} />}
      {view === "quiz" && <QuizView masteredIds={masteredIds} wrongIds={wrongIds} markMastered={markMastered} markWrong={markWrong} resetAll={resetAll} />}
      {view === "timeline" && <TimelineView masteredIds={masteredIds} wrongIds={wrongIds} contentFilter={contentFilter} setContentFilter={setContentFilter} expandedDynastyIds={expandedDynastyIds} toggleDynasty={toggleDynasty} />}
      {view === "detective" && <DetectiveView />}
    </main>
  );
}

function HomeView({ masteredIds, wrongIds, markMastered, markWrong }: {
  masteredIds: string[];
  wrongIds: string[];
  markMastered: (id: string) => void;
  markWrong: (id: string) => void;
}) {
  const [dailyEventIds, setDailyEventIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setDailyEventIds(getDailyEventIds(DAILY_COUNT));
  }, []);

  const currentEvent = dailyEventIds.length > 0
    ? (eventById.get(dailyEventIds[currentIdx]) ?? events[0])
    : events[0];

  function nextDaily() {
    if (currentIdx + 1 >= dailyEventIds.length) {
      setShowCelebration(true);
      setTimeout(() => {
        setCompleted(true);
        setShowCelebration(false);
        document.getElementById("home-portals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 2500);
      return;
    }
    // 每次随机抽一道与当前不同的题
    const currentId = dailyEventIds[currentIdx];
    const pool = events.filter((e) => e.id !== currentId);
    const randomEvent = pool[Math.floor(Math.random() * pool.length)];
    const nextIds = [...dailyEventIds];
    nextIds[currentIdx + 1] = randomEvent.id;
    setDailyEventIds(nextIds);
    setCurrentIdx((prev) => prev + 1);
    document.getElementById("home-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section className="hero" id="top">
        <div className="hero-kicker"><span /> 填空记时间 · 时间轴看全貌 · 侦探连世界</div>
        <div className="hero-copy">
          <div>
            <h1>记住时间，<br /><em>理解历史。</em></h1>
            <p>通过填空题记住每个事件的年代，答对的事件在时间轴上点亮完整信息。在时空侦探中，找出与中外事件同期的另一端，理解历史的全球脉络。</p>
          </div>
        </div>
        <div className="hero-ornament" aria-hidden="true">
          <span className="mountain one" />
          <span className="mountain two" />
          <span className="sun" />
          <span className="boat">━━━━</span>
        </div>
      </section>

      {!completed && dailyEventIds.length > 0 && (
        <section className="home-daily-section" id="home-quiz">
          <div className="home-daily-wrap">
            <div className="today-quiz-card">
              <div className="today-card-top">
                <span className="today-label">每日五题 · 第 {currentIdx + 1} / {dailyEventIds.length} 题</span>
              </div>
              <div className="daily-progress-bar">
                {dailyEventIds.map((_, i) => (
                  <span key={i} className={`daily-progress-dot ${i < currentIdx ? "done" : ""} ${i === currentIdx ? "current" : ""}`} />
                ))}
              </div>
              <TimeQuiz
                event={currentEvent}
                allEvents={events}
                masteredIds={masteredIds}
                wrongIds={wrongIds}
                markMastered={markMastered}
                markWrong={markWrong}
                onNext={nextDaily}
              />
            </div>
          </div>
        </section>
      )}

      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <div className="celebration-check">✓</div>
            <h2>恭喜完成！</h2>
            <p>今日五题已全部答完</p>
            <div className="celebration-confetti">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 0.5}s`, background: ["var(--red)", "var(--gold)", "var(--jade)"][i % 3] }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="home-portals" id="home-portals">
        <div className="portal-grid">
          <Link href="/quiz" className="portal-card portal-card-red">
            <span className="portal-num">01</span>
            <strong>时间填空</strong>
            <p>随机出现事件，填写时间，答对点亮时间轴</p>
            <i>开始答题 →</i>
          </Link>
          <Link href="/timeline" className="portal-card portal-card-gold">
            <span className="portal-num">02</span>
            <strong>历史时间轴</strong>
            <p>沿朝代纵览全貌，已掌握的事件完整显示</p>
            <i>查看时间轴 →</i>
          </Link>
          <Link href="/detective" className="portal-card portal-card-jade">
            <span className="portal-num">03</span>
            <strong>时空侦探</strong>
            <p>给时间选事件，或给事件找同期、因果、前后关系</p>
            <i>开始侦探 →</i>
          </Link>
        </div>
      </section>
    </>
  );
}

function QuizView({ masteredIds, wrongIds, markMastered, markWrong, resetAll }: {
  masteredIds: string[];
  wrongIds: string[];
  markMastered: (id: string) => void;
  markWrong: (id: string) => void;
  resetAll: () => void;
}) {
  const [currentEventId, setCurrentEventId] = useState<string>(events[0].id);
  const [fromTimeline, setFromTimeline] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get("event");
      if (eventParam && eventById.has(eventParam)) {
        setCurrentEventId(eventParam);
        setFromTimeline(true);
        return;
      }
    } catch {}
    setFromTimeline(false);
    setCurrentEventId(events[Math.floor(Math.random() * events.length)].id);
  }, []);

  const currentEvent = eventById.get(currentEventId) ?? events[0];

  function nextEvent() {
    const pool = events.filter((e) => e.id !== currentEventId);
    setCurrentEventId(pool[Math.floor(Math.random() * pool.length)].id);
    setFromTimeline(false);
  }

  return (
    <section className="quiz-section" id="quiz">
      <div className="section-heading quiz-heading">
        <div>
          <span className="eyebrow">01 · QUIZ</span>
          <h2>填写年份，记住每个历史时刻</h2>
        </div>
        <p>随机出现一个历史事件，输入它发生的年份。答对的事件会在时间轴上点亮完整信息。答错的事件自动进入错题记录，方便复习。</p>
      </div>

      {fromTimeline && (
        <Link href="/timeline" className="quiz-back-link">← 返回时间轴</Link>
      )}

      <div className="today-quiz-card">
        <TimeQuiz
          event={currentEvent}
          allEvents={events}
          masteredIds={masteredIds}
          wrongIds={wrongIds}
          markMastered={markMastered}
          markWrong={markWrong}
          onNext={nextEvent}
          onSwap={fromTimeline ? undefined : nextEvent}
        />
      </div>
      <div className="wrong-records">
        <div className="wrong-records-header">
          <h3>错题记录</h3>
          {wrongIds.length > 0 ? (
            <span className="wrong-records-count">{wrongIds.length} 个待复习</span>
          ) : (
            <span className="wrong-records-count empty">暂无错题</span>
          )}
        </div>
        {wrongIds.length > 0 ? (
          <>
            <div className="wrong-records-list">
              {wrongIds.map((id) => {
                const event = eventById.get(id);
                if (!event) return null;
                return (
                  <button type="button" key={id} className="wrong-record-card" onClick={() => {
                    setCurrentEventId(id);
                    document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}>
                    <span className="wrong-record-tag">待复习</span>
                    <strong>{event.title}</strong>
                    <small>{event.track === "china" ? "中国" : "世界"} · {event.category}</small>
                    <span className="wrong-record-action">点击重新作答 →</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="reset-button" onClick={resetAll}>清除全部记录</button>
          </>
        ) : (
          <div className="wrong-records-empty">
            <span>答错的题目会自动记录在这里，方便复习</span>
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineView({ masteredIds, wrongIds, contentFilter, setContentFilter, expandedDynastyIds, toggleDynasty }: {
  masteredIds: string[];
  wrongIds: string[];
  contentFilter: "全部" | "中国" | "世界";
  setContentFilter: (v: "全部" | "中国" | "世界") => void;
  expandedDynastyIds: string[];
  toggleDynasty: (id: string) => void;
}) {
  function expandAll() { setExpandedDynastyIdsLocal(dynasties.map((d) => d.id)); }
  function collapseAll() { setExpandedDynastyIdsLocal([]); }
  const [expandedDynastyIdsLocal, setExpandedDynastyIdsLocal] = useState(expandedDynastyIds);

  useEffect(() => {
    setExpandedDynastyIdsLocal(expandedDynastyIds);
  }, [expandedDynastyIds]);

  const totalEvents = events.length;
  const totalMastered = events.filter((e) => masteredIds.includes(e.id)).length;
  const globalPercent = totalEvents ? Math.round((totalMastered / totalEvents) * 100) : 0;

  return (
    <section className="timeline-section vertical-timeline-section" id="timeline">
      <div className="section-heading vertical-heading">
        <div>
          <span className="eyebrow">02 · TIMELINE</span>
          <h2>一条时间轴，细看中国朝代与同期世界</h2>
        </div>
        <p>点击任意事件卡片即可进入填空题。答对的事件在这里点亮，完整显示时间、标签与简介。每个朝代显示解锁进度。</p>
      </div>

      <div className="global-progress-card">
        <div className="global-progress-top">
          <span className="global-progress-label">总体掌握进度</span>
          <span className="global-progress-count">{totalMastered} / {totalEvents} 已掌握 · {globalPercent}%</span>
        </div>
        <div className="global-progress-bar">
          <i style={{ width: `${globalPercent}%` }} />
        </div>
        <div className="global-progress-hint">
          {totalMastered === 0 ? "开始答题，点亮你在时间轴上的第一个事件吧！" : globalPercent < 50 ? "继续努力，已掌握的事件会在这里点亮完整信息。" : globalPercent < 100 ? "进度过半！再接再厉，掌握全部历史事件。" : "全部事件已掌握，你已是历史达人！"}
        </div>
      </div>

      <div className="river-controls">
        <div className="scroll-instruction"><span>↓</span><p><strong>向下滚动</strong><small>穿越朝代</small></p></div>
        <div className="river-control-actions">
          <div className="content-filters" role="group" aria-label="筛选时间轴内容">
            {(["全部", "中国", "世界"] as const).map((item) => (
              <button type="button" key={item} className={contentFilter === item ? "active" : ""} onClick={() => setContentFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="collapse-actions" role="group" aria-label="展开或折叠朝代">
            <button type="button" onClick={expandAll}>全部展开</button>
            <button type="button" onClick={collapseAll}>全部折叠</button>
          </div>
        </div>
      </div>

      <div className="history-river">
        {dynasties.map((dynasty, dynastyIndex) => {
          const allDynastyEvents = events.filter((e) => findDynastyForYear(e.year).id === dynasty.id).sort((a, b) => a.year - b.year);
          const visibleEvents = allDynastyEvents.filter((e) => contentFilter === "全部" || (contentFilter === "中国" && e.track === "china") || (contentFilter === "世界" && e.track === "world"));
          const masteredCount = allDynastyEvents.filter((e) => masteredIds.includes(e.id)).length;
          const totalCount = allDynastyEvents.length;
          const isExpanded = expandedDynastyIdsLocal.includes(dynasty.id);

          return (
            <article className={`era-stop ${isExpanded ? "is-expanded" : "is-collapsed"}`} id={`era-${dynasty.id}`} key={dynasty.id}>
              <div className="axis-column" aria-hidden="true">
                <span>{String(dynastyIndex + 1).padStart(2, "0")}</span>
                <i />
              </div>
              <div className="era-content">
                <header className="era-header">
                  <button className="dynasty-toggle" type="button" aria-expanded={isExpanded} onClick={() => toggleDynasty(dynasty.id)}>
                    <span className="dynasty-copy">
                      <span className="era-range">{dynasty.dates}</span>
                      <span className="dynasty-title-row"><strong>{dynasty.label}</strong><small>{dynasty.phase}</small></span>
                      <span className="dynasty-summary">{dynasty.summary}</span>
                      <span className="dynasty-progress-row">
                        <span className="dynasty-progress-bar"><i style={{ width: `${totalCount ? (masteredCount / totalCount) * 100 : 0}%` }} /></span>
                        <span className="dynasty-progress-text">{masteredCount} / {totalCount} 已掌握</span>
                      </span>
                      <span className="contemporary-world"><b>同期世界</b>{dynasty.world}</span>
                    </span>
                    <span className="dynasty-toggle-side">
                      <span className="toggle-label">{isExpanded ? "收起" : "展开"}</span>
                      <span className="toggle-mark" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </span>
                  </button>
                </header>

                {isExpanded && (
                  <div className="era-rail-wrap">
                    <div className="era-rail era-rail-vertical">
                      {visibleEvents.map((event) => {
                        const status = getEventStatus(event.id, masteredIds, wrongIds);
                        const isLit = status === "mastered";
                        return (
                          <Link
                            key={event.id}
                            href={`/quiz?event=${event.id}`}
                            className={`river-card event-card ${event.track} status-${status} ${isLit ? "is-lit" : "is-dim"} clickable`}
                          >
                            {isLit ? (
                              <>
                                <div className="event-card-row1">
                                  <time className="event-card-time">{formatYear(event.year)}{event.endYear ? `—${formatYear(event.endYear)}` : ""}</time>
                                  <span className="event-card-tag">{event.track === "china" ? "中国" : "世界"} · {event.category}</span>
                                </div>
                                <h4>{event.title}</h4>
                                {event.summary && <p className="event-card-summary">{event.summary}</p>}
                                {event.image && <img className="event-card-image" src={event.image} alt={event.title} loading="lazy" />}
                              </>
                            ) : (
                              <>
                                <h4>{event.title}</h4>
                                {event.summary && <p className="event-card-summary">{event.summary}</p>}
                              </>
                            )}
                            <span className="event-card-quiz-hint">
                              <span className="quiz-hint-icon">✎</span>
                              <span className="quiz-hint-text">{isLit ? "再答一次" : "点击答题"}</span>
                              <span className="quiz-hint-arrow">→</span>
                            </span>
                          </Link>
                        );
                      })}
                      {!visibleEvents.length && <div className="empty-rail">这个时代暂时没有符合筛选的内容。</div>}
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        <div className="river-to-today"><span>今</span><div><strong>时间继续流动</strong><small>历史不止发生在过去，也正在被我们创造。</small></div></div>
      </div>
    </section>
  );
}

function DetectiveView() {
  return (
    <section className="detective-section" id="detective">
      <div className="section-heading">
        <div>
          <span className="eyebrow">03 · DETECTIVE</span>
          <h2>同期、因果与前后关系</h2>
        </div>
        <p>给定一个中外历史事件，从四个选项中找出与它同时期、有因果关系或前后相继的另一事件。理解历史的全球脉络与因果链条。</p>
      </div>
      <TimeDetective events={events} />
    </section>
  );
}

export default function Home() {
  return <HistoryApp view="home" />;
}
