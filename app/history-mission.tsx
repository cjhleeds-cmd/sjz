"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

export type MissionMaterial = {
  id: string;
  type: string;
  date: string;
  title: string;
  focus: string;
  intro: string;
  context: string;
  summary: string;
  keywords?: string[];
};

export type MissionRelation = {
  id: string;
  title: string;
  meta: string;
  relation: string;
};

export type LearningMission = {
  key: string;
  subjectId: string;
  subjectType: "event" | "figure";
  unlockId: string;
  track: "china" | "world";
  mark: string;
  category: string;
  place: string;
  period: string;
  title: string;
  summary: string;
  heroImage?: string;
  role: string;
  roleBackground: string;
  timePrompt: string;
  question: string;
  keyPoints: string[];
  materials: MissionMaterial[];
  impact: string;
  relations: MissionRelation[];
};

export type OralMissionRecord = {
  id: string;
  missionKey: string;
  subjectId: string;
  subjectType: LearningMission["subjectType"];
  title: string;
  role: string;
  materialIds: string[];
  materialTitles: string[];
  usedMaterialIds: string[];
  transcript: string;
  outcome: "followup" | "support" | "ready" | "unlocked";
  feedback: string;
  updatedAt: number;
};

type MissionStage = "materials" | "oral" | "unlock";

type MissionAssessment = {
  level: "pass" | "followup" | "support";
  title: string;
  message: string;
  usedMaterialIds: string[];
  followUp?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type HistoryMissionDialogProps = {
  mission: LearningMission;
  wasUnlocked: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClose: () => void;
  onUnlock: (unlockId: string) => void;
  onOpenRelated: (eventId: string) => void;
  onRecordSaved?: (record: OralMissionRecord) => void;
};

export const ORAL_RECORDS_STORAGE_KEY = "history-river-oral-records-v1";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[，。！？、；：“”‘’《》〈〉（）()\s·—-]/g, "");
}

function conceptAppears(text: string, concept: string) {
  const normalizedText = normalizeText(text);
  const normalizedConcept = normalizeText(concept);
  if (!normalizedConcept) return false;
  if (normalizedText.includes(normalizedConcept)) return true;
  const pairs = Array.from({ length: Math.max(0, normalizedConcept.length - 1) }, (_, index) => normalizedConcept.slice(index, index + 2));
  const threshold = normalizedConcept.length <= 4 ? 1 : 2;
  return pairs.filter((pair) => normalizedText.includes(pair)).length >= threshold;
}

function materialAppears(text: string, material: MissionMaterial) {
  return [material.title, material.focus, material.intro, material.context, material.summary, ...(material.keywords ?? [])].some((concept) => conceptAppears(text, concept));
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function readOralMissionRecords(): OralMissionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORAL_RECORDS_STORAGE_KEY) ?? "[]") as OralMissionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function HistoryMissionDialog({
  mission,
  wasUnlocked,
  isFavorite,
  onToggleFavorite,
  onClose,
  onUnlock,
  onOpenRelated,
  onRecordSaved,
}: HistoryMissionDialogProps) {
  const [stage, setStage] = useState<MissionStage>("materials");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [assessment, setAssessment] = useState<MissionAssessment | null>(null);
  const [oralAttemptCount, setOralAttemptCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [oralSeconds, setOralSeconds] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [oralView, setOralView] = useState<"compose" | "feedback">("compose");
  const dialogRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptBeforeListeningRef = useRef("");
  const sessionStartedAtRef = useRef(0);
  const assessmentRef = useRef<HTMLDivElement>(null);

  const selectedMaterials = mission.materials.filter((material) => selectedMaterialIds.includes(material.id));
  const usedMaterialIds = assessment?.usedMaterialIds ?? [];

  useEffect(() => {
    sessionStartedAtRef.current = Date.now();
    window.setTimeout(() => dialogRef.current?.focus(), 20);
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!isListening) return;
    const timer = window.setInterval(() => setOralSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isListening]);

  useEffect(() => {
    if (assessment && assessmentRef.current) {
      window.setTimeout(() => assessmentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [assessment]);

  useEffect(() => {
    if (stage === "unlock" && celebrating) {
      const timer = window.setTimeout(() => setCelebrating(false), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [stage, celebrating]);

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function goToStage(nextStage: MissionStage) {
    stopListening();
    if (nextStage === "oral") setOralView("compose");
    setStage(nextStage);
    window.setTimeout(() => dialogRef.current?.scrollTo({ top: 250, behavior: "smooth" }), 20);
  }

  function toggleMaterial(materialId: string) {
    setSelectedMaterialIds((current) =>
      current.includes(materialId)
        ? current.filter((id) => id !== materialId)
        : [...current, materialId]
    );
    setAssessment(null);
  }

  function startListening() {
    if (isListening || recognitionRef.current) return;
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechUnavailable(true);
      return;
    }
    const recognition = new Recognition();
    const previousTranscript = transcript.trim();
    transcriptBeforeListeningRef.current = previousTranscript
      ? `${previousTranscript}${/[。！？]$/.test(previousTranscript) ? "" : "。"}\n`
      : "";
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let next = "";
      for (let index = 0; index < event.results.length; index += 1) next += event.results[index][0].transcript;
      setTranscript(`${transcriptBeforeListeningRef.current}${next}`);
    };
    recognition.onerror = () => {
      setSpeechUnavailable(true);
      setIsListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    setAssessment(null);
    setSpeechUnavailable(false);
    setOralSeconds(0);
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setSpeechUnavailable(true);
      setIsListening(false);
    }
  }

  function beginOralHold(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || isListening) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startListening();
  }

  function endOralHold(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    stopListening();
  }

  function beginOralKey(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key !== " " && event.key !== "Enter") || event.repeat || isListening) return;
    event.preventDefault();
    startListening();
  }

  function endOralKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    stopListening();
  }

  function saveRecord(outcome: OralMissionRecord["outcome"], feedback: string, usedIds = assessment?.usedMaterialIds ?? []) {
    const current = readOralMissionRecords();
    const previous = current.find((record) => record.missionKey === mission.key);
    const record: OralMissionRecord = {
      id: previous?.id ?? `oral-record:${mission.key}`,
      missionKey: mission.key,
      subjectId: mission.subjectId,
      subjectType: mission.subjectType,
      title: mission.title,
      role: mission.role,
      materialIds: [...selectedMaterialIds],
      materialTitles: selectedMaterials.map((material) => material.title),
      usedMaterialIds: [...usedIds],
      transcript: transcript.trim(),
      outcome,
      feedback,
      updatedAt: sessionStartedAtRef.current,
    };
    const records = [record, ...current.filter((item) => item.missionKey !== mission.key)].slice(0, 80);
    try {
      window.localStorage.setItem(ORAL_RECORDS_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // 浏览器禁用本地存储时，仍保留本次会话的学习结果。
    }
    onRecordSaved?.(record);
  }

  function assessAnswer() {
    const answer = transcript.trim();
    if (!answer || selectedMaterials.length < 1) return;
    const usedMaterials = selectedMaterials.filter((material) => materialAppears(answer, material));
    const covered = mission.keyPoints.filter((point) => conceptAppears(answer, point)).length;
    const hasRelationship = /(因为|所以|导致|为了|使得|因此|影响|改变|结果|但是|同时|说明|反映)/.test(answer);
    const hasTimeReference = /(?:公元前|公元|前\d|\d{2,4}年|世纪|年代|时期|朝|早期|中期|后期|开始|结束)/.test(answer);
    const canUnlock = normalizeText(answer).length >= 24
      && usedMaterials.length >= 1
      && ((covered >= 1 && hasRelationship) || covered >= 2);

    if (canUnlock) {
      const nextAssessment: MissionAssessment = {
        level: "pass",
        title: "可以解锁了",
        message: hasTimeReference
          ? "你已说出时间坐标、引用材料，并讲清了关键关系。"
          : `你已引用材料并讲清关键关系。下次可再补上时间坐标：${mission.timePrompt}`,
        usedMaterialIds: usedMaterials.map((material) => material.id),
      };
      setAssessment(nextAssessment);
      saveRecord("ready", nextAssessment.message, nextAssessment.usedMaterialIds);
      setOralView("feedback");
      return;
    }

    if (oralAttemptCount === 0) {
      const followUp = usedMaterials.length === 0
        ? `你选择了“${selectedMaterials[0]?.title}”。其中哪条信息能支持你的判断？请引用它，再说明它证明了什么。`
        : !hasTimeReference
          ? `先补一句时间坐标：${mission.timePrompt}`
        : !hasRelationship
          ? `站在“${mission.role}”的立场，把依据和结论连起来：因为这份材料说明了什么，所以你会怎样判断？`
          : "你已经讲到一条关系。再补一句：这个选择或变化后来带来了什么影响？";
      const nextAssessment: MissionAssessment = {
        level: "followup",
        title: "再补一句",
        message: "只回答下面的问题，不用重讲全文。",
        usedMaterialIds: usedMaterials.map((material) => material.id),
        followUp,
      };
      setAssessment(nextAssessment);
      setOralAttemptCount(1);
      saveRecord("followup", followUp, nextAssessment.usedMaterialIds);
      setOralView("feedback");
      return;
    }

    const nextAssessment: MissionAssessment = {
      level: "support",
      title: "回看一条线索",
      message: "选一个支点，用自己的话连接材料与结论。",
      usedMaterialIds: usedMaterials.map((material) => material.id),
    };
    setAssessment(nextAssessment);
    setOralAttemptCount((current) => current + 1);
    saveRecord("support", nextAssessment.message, nextAssessment.usedMaterialIds);
    setOralView("feedback");
  }

  function finishUnlock() {
    if (!assessment || assessment.level !== "pass") return;
    onUnlock(mission.unlockId);
    saveRecord("unlocked", "已完成材料取证与口述，节点正式解锁。");
    setCelebrating(true);
    window.setTimeout(() => goToStage("unlock"), 600);
  }

  function restartMission() {
    stopListening();
    setSelectedMaterialIds([]);
    setTranscript("");
    setAssessment(null);
    setOralAttemptCount(0);
    setSpeechUnavailable(false);
    setOralSeconds(0);
    setCelebrating(false);
    setOralView("compose");
    goToStage("materials");
  }

  function goBack() {
    if (stage === "materials") {
      onClose();
      return;
    }
    if (stage === "oral" && oralView === "feedback") {
      setOralView("compose");
      return;
    }
    goToStage(stage === "oral" ? "materials" : "oral");
  }

  const stageIndex = ["materials", "oral", "unlock"].indexOf(stage);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="event-dialog mission-dialog" role="dialog" aria-modal="true" aria-labelledby="mission-title" tabIndex={-1} ref={dialogRef}>
        {onToggleFavorite && (
          <button type="button" className="dialog-favorite" onClick={onToggleFavorite} aria-label={isFavorite ? "取消收藏" : "收藏事件"}>{isFavorite ? "★" : "☆"}</button>
        )}
        <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭历史情境">×</button>

        {celebrating && (
          <div className="celebration-overlay" aria-hidden="true">
            <div className="confetti-container">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="confetti-piece" style={{ "--delay": `${i * 0.08}s`, "--x": `${(i * 37) % 100}%`, "--color": ["var(--red)", "var(--gold)", "var(--jade)", "#fff8eb"][i % 4] } as CSSProperties} />
              ))}
            </div>
            <div className="celebration-burst" aria-hidden="true" />
          </div>
        )}

        <div className={`dialog-hero mission-dialog-hero ${mission.track}`}>
          {mission.heroImage && <div className="mission-hero-image" style={{ backgroundImage: `url("${mission.heroImage}")` } as CSSProperties} aria-hidden="true" />}
          <div className="mission-hero-mark" aria-hidden="true">{mission.mark}</div>
          <div className="dialog-meta">
            <span>{mission.subjectType === "figure" ? "人物现场" : mission.track === "china" ? "中国" : "世界"}</span>
            {wasUnlocked && <span className="mission-unlocked-meta">已解锁 ✓</span>}
          </div>
          <p>{mission.period} · {mission.place}</p>
          <h2 id="mission-title">{mission.title}</h2>
          <blockquote>{mission.summary}</blockquote>
        </div>

        <nav className="mission-journey" aria-label="历史情境学习步骤">
          {["材料", "口述", "解锁"].map((label, index) => (
            <span className={index < stageIndex ? "complete" : index === stageIndex ? "active" : ""} key={label}>
              <b>{index < stageIndex ? "✓" : index + 1}</b><em>{label}</em>
            </span>
          ))}
        </nav>

        <div className="dialog-content mission-content">
          {stage === "materials" && (
            <section className="mission-stage materials-stage">
              <button type="button" className="mission-back-button" onClick={goBack}><span>←</span> 返回上一页</button>
              <h3>先看背景，选一份材料</h3>
              <div className="mission-role-brief">
                <div className="mission-role-badge"><span>本次身份</span><strong>{mission.role}</strong></div>
                <div><p>{mission.roleBackground}</p></div>
              </div>
              <div className="mission-question"><small>要讲清的问题</small><strong>{mission.question}</strong></div>
              <div className="mission-material-status" aria-live="polite"><span>选择材料作为依据（可多选）</span><strong>{selectedMaterialIds.length ? `已选 ${selectedMaterialIds.length} 份` : "请选择"}</strong></div>
              <div className="mission-material-grid">
                {mission.materials.map((material) => {
                  const selected = selectedMaterialIds.includes(material.id);
                  return (
                    <button type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleMaterial(material.id)} key={material.id}>
                      <span><b>{material.type}</b><time>{material.date}</time></span>
                      <strong>{material.title}</strong>
                      <p className="mission-material-summary">{material.intro}</p>
                      <div className="mission-material-context"><small>{material.focus}</small><p>{material.context}</p></div>
                      <div className="mission-material-clue"><small>{selected ? "口述可引用" : "阅读时留意"}</small><p>{material.summary.replace("阅读时留意：", "")}</p></div>
                      {material.keywords && material.keywords.length > 0 && <div className="mission-material-keywords">{material.keywords.filter(Boolean).slice(0, 4).map((keyword) => <span key={keyword}>{keyword}</span>)}</div>}
                      <em>{selected ? "✓ 已选作依据" : "选择这份材料"}</em>
                    </button>
                  );
                })}
              </div>
              <div className="mission-stage-actions">
                <button type="button" className="primary-action" disabled={selectedMaterialIds.length < 1} onClick={() => goToStage("oral")}>
                  {selectedMaterialIds.length ? `带着 ${selectedMaterialIds.length} 份材料去口述` : "先选 1 份材料"} <span>→</span>
                </button>
              </div>
            </section>
          )}

          {stage === "oral" && selectedMaterials.length > 0 && (
            <section className="mission-stage oral-stage">
              <button type="button" className="mission-back-button" onClick={goBack}><span>←</span> {oralView === "feedback" ? "返回口述" : "返回材料"}</button>

              {oralView === "compose" && (
                <div className="oral-view oral-view-compose" key="compose">
                  <h3>用自己的话讲清这件事</h3>
                  <div className="mission-carrying">
                    <div><span>身份</span><strong>{mission.role}</strong></div>
                    <div><span>依据</span><p>{selectedMaterials.map((material) => <b key={material.id}>{material.title}</b>)}</p></div>
                  </div>
                  <div className="challenge-prompt"><span>时间 → 材料 → 关系</span><strong>{mission.question}</strong><p><b>先说时间</b>{mission.timePrompt}</p></div>
                  <details className="speaking-frame">
                    <summary>需要提示？查看口述支架</summary>
                    <p>先说时间：{mission.timePrompt} 再说：从“{selectedMaterials[0].title}”可以看出……；因为……所以……；这件事后来……</p>
                  </details>
                  <label className="transcript-box">
                    <span>口述转写</span>
                    <textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setAssessment(null); }} placeholder="先说时间，再引用材料讲前因与结果……" rows={5} />
                  </label>
                  <div className={isListening ? "recorder mission-recorder is-listening" : "recorder mission-recorder"}>
                    <button
                      type="button"
                      className="hold-to-talk"
                      aria-pressed={isListening}
                      aria-describedby="mission-speech-privacy"
                      onPointerDown={beginOralHold}
                      onPointerUp={endOralHold}
                      onPointerCancel={endOralHold}
                      onKeyDown={beginOralKey}
                      onKeyUp={endOralKey}
                    >
                      <span aria-hidden="true">{isListening ? "声" : "按"}</span>
                      <div><strong>{isListening ? "正在口述，松开结束" : transcript ? "按住继续补充" : "按住说话"}</strong><small>{isListening ? "保持按住" : "松开即停止"}</small></div>
                      <time>{formatDuration(oralSeconds)}</time>
                    </button>
                  </div>
                  <p className="privacy-note" id="mission-speech-privacy">语音只用于生成转写，不保存原始录音。</p>
                  {speechUnavailable && <p className="speech-fallback" role="status">没有启用麦克风或当前浏览器不支持语音转写。可以直接在上方文本框输入，这不会被当作学习失败。</p>}
                  <button type="button" className="primary-action mission-submit-answer" disabled={!transcript.trim() || isListening} onClick={assessAnswer}>提交讲述 <span>→</span></button>
                </div>
              )}

              {oralView === "feedback" && assessment && (
                <div className="oral-view oral-view-feedback" key="feedback" ref={assessmentRef}>
                  <div className={`assessment mission-assessment assessment-page ${assessment.level}`} aria-live="polite">
                    <div className="assessment-page-header">
                      <span>{assessment.level === "pass" ? "可以解锁" : assessment.level === "followup" ? "一次定向追问" : "理解支点"}</span>
                      <strong>{assessment.title}</strong>
                    </div>
                    <p>{assessment.message}</p>
                    {selectedMaterials.length > 0 && (
                      <div className="assessment-evidence"><small>讲述中的材料依据</small><p>{selectedMaterials.map((material) => <b className={usedMaterialIds.includes(material.id) ? "used" : "unused"} key={material.id}>{usedMaterialIds.includes(material.id) ? "已引用" : "待说明"} · {material.title}</b>)}</p></div>
                    )}
                    {assessment.level === "followup" && assessment.followUp && <blockquote className="assessment-followup-prompt">{assessment.followUp}</blockquote>}
                    {assessment.level === "support" && <ul>{mission.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>}
                  </div>

                  {assessment.level === "pass" ? (
                    <div className="assessment-actions">
                      <button type="button" className="primary-action celebration-trigger" onClick={finishUnlock}>解锁这个事件 <span>→</span></button>
                    </div>
                  ) : (
                    <>
                      <label className="transcript-box">
                        <span>补充口述</span>
                        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="根据上方提示继续补充……" rows={5} />
                      </label>
                      <div className={isListening ? "recorder mission-recorder is-listening" : "recorder mission-recorder"}>
                        <button
                          type="button"
                          className="hold-to-talk"
                          aria-pressed={isListening}
                          aria-describedby="mission-speech-privacy-feedback"
                          onPointerDown={beginOralHold}
                          onPointerUp={endOralHold}
                          onPointerCancel={endOralHold}
                          onKeyDown={beginOralKey}
                          onKeyUp={endOralKey}
                        >
                          <span aria-hidden="true">{isListening ? "声" : "按"}</span>
                          <div><strong>{isListening ? "正在口述，松开结束" : transcript ? "按住继续补充" : "按住说话"}</strong><small>{isListening ? "保持按住" : "松开即停止"}</small></div>
                          <time>{formatDuration(oralSeconds)}</time>
                        </button>
                      </div>
                      <p className="privacy-note" id="mission-speech-privacy-feedback">语音只用于生成转写，不保存原始录音。</p>
                      {speechUnavailable && <p className="speech-fallback" role="status">没有启用麦克风或当前浏览器不支持语音转写。可以直接在上方文本框输入，这不会被当作学习失败。</p>}
                      <div className="assessment-actions">
                        <button type="button" onClick={() => goToStage("materials")}>回看材料</button>
                        <button type="button" className="primary-action" disabled={!transcript.trim() || isListening} onClick={assessAnswer}>提交补充 <span>→</span></button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {stage === "unlock" && (
            <section className={`mission-stage unlock-stage ${celebrating ? "is-celebrating" : ""}`}>
              <button type="button" className="mission-back-button" onClick={goBack}><span>←</span> 返回口述</button>
              <div className="mission-unlock-seal" aria-hidden="true"><span>{mission.mark}</span><b>解锁</b></div>
              <h3>已解锁 · {mission.title}</h3>
              <div className="unlock-impact"><span>历史影响</span><p>{mission.impact}</p></div>
              <details className="unlock-record-detail">
                <summary>查看本次学习记录</summary>
                <div className="unlock-dossier">
                  <div><span>身份</span><strong>{mission.role}</strong></div>
                  <div><span>材料</span><p>{selectedMaterials.map((material) => <b key={material.id}>{material.title}</b>)}</p></div>
                </div>
              </details>
              {mission.relations.length > 0 && (
                <div className="unlock-relations">
                  <span>继续了解</span>
                  <div>{mission.relations.map((relation) => <button type="button" key={relation.id} onClick={() => onOpenRelated(relation.id)}><small>{relation.relation}</small><strong>{relation.title}</strong><span>{relation.meta}</span><i>→</i></button>)}</div>
                </div>
              )}
              <div className="mission-stage-actions split"><button type="button" className="secondary-action" onClick={restartMission}>再学一次</button><button type="button" className="primary-action" onClick={onClose}>完成并返回</button></div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
