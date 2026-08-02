"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Category,
  eventById,
  events,
  formatYear,
  HistoryEvent,
  journeys,
} from "./history-data";
import {
  HistoryMissionDialog,
  readOralMissionRecords,
  type LearningMission,
  type MissionMaterial,
  type OralMissionRecord,
} from "./history-mission";
import { TimeQuiz } from "./time-quiz";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const categoryMarks: Record<Category, string> = {
  政治: "制",
  思想: "思",
  科技: "器",
  交流: "路",
  战争: "戈",
  社会: "人",
};

type HistoryFigure = {
  id: string;
  name: string;
  years: string;
  anchorYear: number;
  periodId: string;
  track: "china" | "world";
  identity: string;
  summary: string;
  milestones: Array<{ year: string; text: string }>;
  relatedEventId: string;
  question: string;
  /** 可选：归位玩法使用的代表年份；未填写时使用 anchorYear。 */
  placementYear?: number;
  /** 可选：设为 false 时不生成归位题卡。 */
  placementEnabled?: boolean;
};

const figures: HistoryFigure[] = [
  { id: "confucius", name: "孔子", years: "公元前551—前479年", anchorYear: -500, periodId: "origins", track: "china", identity: "思想家、教育家", summary: "身处礼崩乐坏的时代，以仁、礼与教育回应秩序危机。", milestones: [{ year: "前551", text: "生于鲁国陬邑" }, { year: "约前497", text: "周游列国，游说诸侯" }, { year: "前479", text: "逝世，弟子继续整理和传播思想" }], relatedEventId: "hundred-schools", question: "孔子的思想为什么能超越他生活的时代？" },
  { id: "qin-shihuang", name: "秦始皇", years: "公元前259—前210年", anchorYear: -221, periodId: "origins", track: "china", identity: "秦朝建立者", summary: "完成六国统一，并以皇帝、郡县和统一标准重构政治秩序。", milestones: [{ year: "前246", text: "即秦王位" }, { year: "前221", text: "统一六国，称始皇帝" }, { year: "前210", text: "东巡途中去世" }], relatedEventId: "qin-unification", question: "统一制度为什么比一次军事胜利影响更久？" },
  { id: "zhang-qian", name: "张骞", years: "生年不详—公元前114年", anchorYear: -139, periodId: "empires", track: "china", identity: "汉代使者", summary: "两次出使西域，把汉朝的认识与欧亚内陆交通网络连接起来。", milestones: [{ year: "前139", text: "奉命首次出使西域" }, { year: "前126", text: "历经羁留后返回长安" }, { year: "前119", text: "再次出使西域" }], relatedEventId: "silk-road", question: "一次没有完成原定目标的远行，为什么仍能改变历史？" },
  { id: "cai-lun", name: "蔡伦", years: "约63—121年", anchorYear: 105, periodId: "empires", track: "china", identity: "东汉官员、造纸技术改进者", summary: "传统文献记载他总结并改进造纸方法，使纸张更便于推广。", milestones: [{ year: "约75", text: "进入宫廷任职" }, { year: "105", text: "向朝廷奏报改进造纸方法" }, { year: "121", text: "去世" }], relatedEventId: "paper", question: "技术改进者和最初发明者是同一个概念吗？" },
  { id: "xuanzang", name: "玄奘", years: "602—664年", anchorYear: 629, periodId: "medieval", track: "china", identity: "僧人、旅行者、翻译家", summary: "穿越中亚抵达印度求法，归国后长期主持佛经翻译。", milestones: [{ year: "629", text: "离开长安西行" }, { year: "645", text: "携经卷返回长安" }, { year: "664", text: "在玉华宫圆寂" }], relatedEventId: "tang-changan", question: "玄奘的旅程为什么也是一条知识传播路线？" },
  { id: "bi-sheng", name: "毕昇", years: "约970—1051年", anchorYear: 1040, periodId: "medieval", track: "china", identity: "北宋发明家", summary: "以胶泥活字探索更灵活的排印方法，其技术由沈括记录。", milestones: [{ year: "约1040", text: "试制胶泥活字" }, { year: "1041—1048", text: "活字方法用于排印实验" }, { year: "1088", text: "沈括在《梦溪笔谈》中记录其方法" }], relatedEventId: "movable-type", question: "为什么有些发明不会在当时立即普及？" },
  { id: "genghis-khan", name: "成吉思汗", years: "约1162—1227年", anchorYear: 1206, periodId: "medieval", track: "world", identity: "蒙古帝国奠基者", summary: "统一蒙古诸部并发动跨区域征服，重塑欧亚大陆政治版图。", milestones: [{ year: "1206", text: "被推举为成吉思汗" }, { year: "1219", text: "开始西征花剌子模" }, { year: "1227", text: "征西夏期间去世" }], relatedEventId: "mongol-empire", question: "如何同时评价征服的破坏与大陆连接的扩大？" },
  { id: "zheng-he-figure", name: "郑和", years: "1371—1433年", anchorYear: 1405, periodId: "encounters", track: "china", identity: "明代航海家、外交使者", summary: "七次率领大型船队远航西太平洋和印度洋。", milestones: [{ year: "1405", text: "首次率船队从太仓启航" }, { year: "1413", text: "第四次航行抵达更远的印度洋地区" }, { year: "1433", text: "第七次航行期间去世" }], relatedEventId: "zheng-he", question: "郑和个人的航海能力与明朝国家目标是什么关系？" },
  { id: "columbus-figure", name: "哥伦布", years: "1451—1506年", anchorYear: 1492, periodId: "encounters", track: "world", identity: "热那亚航海者", summary: "在西班牙支持下横渡大西洋，开启欧洲与美洲持续接触。", milestones: [{ year: "1492", text: "首次横渡大西洋抵达加勒比地区" }, { year: "1493", text: "率更大规模船队再次航行" }, { year: "1506", text: "在西班牙去世" }], relatedEventId: "columbus", question: "为什么应从原住民视角重新理解“发现”？" },
  { id: "ricci-figure", name: "利玛窦", years: "1552—1610年", anchorYear: 1582, periodId: "encounters", track: "world", identity: "耶稣会传教士、知识交流者", summary: "在华生活近三十年，以地图、数学和翻译参与中西文化交流。", milestones: [{ year: "1582", text: "抵达澳门，开始进入中国" }, { year: "1601", text: "获准进入北京" }, { year: "1610", text: "在北京去世" }], relatedEventId: "ricci", question: "跨文化交流为什么需要重新翻译概念？" },
  { id: "newton", name: "牛顿", years: "1643—1727年", anchorYear: 1687, periodId: "encounters", track: "world", identity: "物理学家、数学家", summary: "以数学方法统一解释地面运动与天体运行。", milestones: [{ year: "1665—1666", text: "发展微积分、光学与引力问题的早期思路" }, { year: "1687", text: "出版《自然哲学的数学原理》" }, { year: "1703", text: "当选皇家学会会长" }], relatedEventId: "scientific-revolution", question: "牛顿的成果为什么离不开此前的观测和学术网络？" },
  { id: "watt", name: "詹姆斯·瓦特", years: "1736—1819年", anchorYear: 1769, periodId: "industry", track: "world", identity: "工程师、蒸汽机改良者", summary: "通过分离冷凝器等改进显著提高蒸汽机效率。", milestones: [{ year: "1765", text: "形成分离冷凝器的改良思路" }, { year: "1769", text: "取得相关蒸汽机专利" }, { year: "1775", text: "与博尔顿合作推广蒸汽机" }], relatedEventId: "industrial-revolution", question: "改良效率为什么比单纯“发明机器”更能推动工业化？" },
  { id: "lin-zexu", name: "林则徐", years: "1785—1850年", anchorYear: 1839, periodId: "industry", track: "china", identity: "清代官员", summary: "主持禁烟并组织了解西方信息，身处中英冲突的关键转折。", milestones: [{ year: "1838", text: "受命为钦差大臣赴广东禁烟" }, { year: "1839", text: "主持虎门销烟" }, { year: "1842", text: "被遣戍新疆" }], relatedEventId: "opium-war", question: "个人意志能在多大程度上改变结构性的中外冲突？" },
  { id: "marx", name: "卡尔·马克思", years: "1818—1883年", anchorYear: 1848, periodId: "industry", track: "world", identity: "思想家、革命家", summary: "分析工业资本主义矛盾，并参与国际工人运动。", milestones: [{ year: "1848", text: "与恩格斯发表《共产党宣言》" }, { year: "1864", text: "参与创建第一国际" }, { year: "1867", text: "《资本论》第一卷出版" }], relatedEventId: "marx-1848", question: "思想理论为什么会在工业城市中获得现实力量？" },
  { id: "sun-yat-sen", name: "孙中山", years: "1866—1925年", anchorYear: 1911, periodId: "industry", track: "china", identity: "民主革命先行者", summary: "长期组织革命活动，推动共和理念和辛亥革命。", milestones: [{ year: "1894", text: "建立兴中会" }, { year: "1905", text: "组织中国同盟会" }, { year: "1912", text: "就任中华民国临时大总统" }], relatedEventId: "xinhai", question: "推翻旧制度后，为什么建设新制度更加困难？" },
  { id: "lenin", name: "列宁", years: "1870—1924年", anchorYear: 1917, periodId: "wars", track: "world", identity: "俄国革命家", summary: "领导布尔什维克在战争和社会危机中夺取政权。", milestones: [{ year: "1903", text: "布尔什维克派形成" }, { year: "1917", text: "领导十月革命" }, { year: "1922", text: "苏维埃社会主义共和国联盟成立" }], relatedEventId: "russian-revolution", question: "列宁的政治主张为什么在1917年获得支持？" },
  { id: "koo", name: "顾维钧", years: "1888—1985年", anchorYear: 1919, periodId: "wars", track: "china", identity: "外交家", summary: "在巴黎和会上据理力争，拒绝在损害中国权益的和约上签字。", milestones: [{ year: "1919", text: "作为中国代表出席巴黎和会" }, { year: "1922", text: "参加华盛顿会议交涉山东问题" }, { year: "1945", text: "参与联合国制宪会议" }], relatedEventId: "may-fourth", question: "外交官的谈判为什么会与街头的学生运动彼此影响？" },
  { id: "cao-cao", name: "曹操", years: "155—220年", anchorYear: 220, periodId: "empires", track: "china", identity: "东汉末年政治家、军事家", summary: "在东汉秩序崩解中统一北方，其政治与军事行动奠定曹魏基础。", milestones: [{ year: "196", text: "迎汉献帝至许县，整合政治资源" }, { year: "200", text: "官渡之战后逐步统一北方" }, { year: "220", text: "去世，同年曹丕代汉建魏" }], relatedEventId: "three-kingdoms", question: "为什么曹操既是汉臣，又成为新政治秩序的奠基者？" },
  { id: "xiaowen", name: "孝文帝", years: "467—499年", anchorYear: 494, periodId: "empires", track: "china", identity: "北魏皇帝", summary: "迁都洛阳并推动制度与文化改革，是北方民族交往交流交融的重要人物。", milestones: [{ year: "471", text: "即北魏皇帝位" }, { year: "494", text: "迁都洛阳" }, { year: "495后", text: "持续推进官制、服饰与姓氏等改革" }], relatedEventId: "xiaowen-reform", question: "主动改变语言、制度与生活方式，会给国家带来什么机会和张力？" },
  { id: "tang-taizong", name: "唐太宗", years: "598—649年", anchorYear: 626, periodId: "medieval", track: "china", identity: "唐朝皇帝", summary: "以制度建设、纳谏和对外交通推动唐初稳定，为开放繁荣奠定基础。", milestones: [{ year: "626", text: "即皇帝位，次年改元贞观" }, { year: "630", text: "东突厥政权瓦解，北方形势改变" }, { year: "649", text: "去世" }], relatedEventId: "tang-changan", question: "贞观之治为什么既与个人选择有关，也依赖隋唐制度遗产？" },
  { id: "zhao-kuangyin", name: "赵匡胤", years: "927—976年", anchorYear: 960, periodId: "medieval", track: "china", identity: "北宋建立者", summary: "建立宋朝并加强中央集权，为此后文官政治与经济发展塑造条件。", milestones: [{ year: "960", text: "陈桥兵变后建立宋朝" }, { year: "963—975", text: "逐步结束南方多个割据政权" }, { year: "976", text: "去世" }], relatedEventId: "song-founded", question: "宋初为什么把防止武将割据放在制度设计的中心？" },
  { id: "kublai", name: "忽必烈", years: "1215—1294年", anchorYear: 1271, periodId: "medieval", track: "china", identity: "元朝建立者", summary: "定国号为元，以大都为中心治理辽阔疆域并连接欧亚交通网络。", milestones: [{ year: "1260", text: "即大蒙古国汗位" }, { year: "1271", text: "定国号为大元" }, { year: "1279", text: "南宋灭亡，全国重新统一" }], relatedEventId: "yuan-network", question: "草原帝国如何适应农耕地区的治理传统？" },
  { id: "zhu-yuanzhang", name: "朱元璋", years: "1328—1398年", anchorYear: 1368, periodId: "encounters", track: "china", identity: "明朝建立者", summary: "在元末社会动荡中建立明朝，重建王朝秩序并强化皇权。", milestones: [{ year: "1352", text: "参加反元起义" }, { year: "1368", text: "在应天称帝，建立明朝" }, { year: "1380", text: "废除中书省丞相，加强皇权" }], relatedEventId: "ming-founded", question: "从乱世中建立的新王朝，为什么往往更强调控制与秩序？" },
  { id: "kangxi", name: "康熙帝", years: "1654—1722年", anchorYear: 1681, periodId: "encounters", track: "china", identity: "清朝皇帝", summary: "在统一、边疆治理与中西知识交流中塑造清前期政治格局。", milestones: [{ year: "1661", text: "即皇帝位" }, { year: "1681", text: "平定三藩之乱" }, { year: "1689", text: "中俄签订《尼布楚条约》" }], relatedEventId: "qing-entry", question: "清朝如何同时依靠继承与创新治理一个多民族国家？" },
  { id: "mao-zedong", name: "毛泽东", years: "1893—1976年", anchorYear: 1949, periodId: "today", track: "china", identity: "中华人民共和国主要缔造者", summary: "领导中国革命并参与建立中华人民共和国，深刻影响20世纪中国道路。", milestones: [{ year: "1921", text: "参加中国共产党第一次全国代表大会" }, { year: "1935", text: "遵义会议后逐步成为中共中央主要领导人" }, { year: "1949", text: "在北京宣告中华人民共和国成立" }], relatedEventId: "prc-founded", question: "国家建立为何是长期革命、战争与社会动员共同作用的结果？" },
  { id: "deng-xiaoping", name: "邓小平", years: "1904—1997年", anchorYear: 1978, periodId: "today", track: "china", identity: "中国改革开放的重要推动者", summary: "推动工作重心转移与改革开放，影响中国此后的发展道路。", milestones: [{ year: "1978", text: "支持真理标准讨论与工作重心转移" }, { year: "1980", text: "推动经济特区建设" }, { year: "1992", text: "南方谈话进一步推动改革" }], relatedEventId: "reform-opening", question: "改革为什么既需要方向，也需要局部试验？" },
  { id: "tim-berners-lee", name: "蒂姆·伯纳斯-李", years: "1955年至今", anchorYear: 1991, periodId: "today", track: "world", identity: "计算机科学家、万维网发明者", summary: "提出并实现万维网，使互联网信息可以通过网页相互连接。", milestones: [{ year: "1989", text: "在欧洲核子研究中心提出万维网构想" }, { year: "1991", text: "首个网站向公众开放" }, { year: "1994", text: "创建万维网联盟" }], relatedEventId: "internet-age", question: "开放标准为什么能让一种技术迅速成为全球基础设施？" },
];

const contentFilters = ["全部", "中国", "世界"] as const;
export type AppView = "home" | "timeline" | "journeys" | "records";

function materialTypeFor(title: string) {
  if (/(统计|数据|图表|名册|档案)/.test(title)) return "档案数据";
  if (/(地图|航海图|画像|照片|清明上河图)/.test(title)) return "图像地图";
  if (/(遗址|遗迹|墓葬|器|鼎|俑|玉琮|碑|建筑|炮台|古城|纸|丝织品)/.test(title)) return "遗址实物";
  if (/(《|条约|诏|法|宣言|通电|章程|文告|卜辞|简|文书|记述|日记|记录|文献)/.test(title)) return "文献史料";
  return "历史记录";
}

function materialIntroFor(title: string, type: string, subjectTitle: string) {
  if (type === "文献史料") return `“${title}”保留了当时人的制度、行动或观念，可与后世解释相互核对。`;
  if (type === "遗址实物") return `“${title}”留下形制、位置或使用痕迹，能补充文字没有记录的社会细节。`;
  if (type === "档案数据") return `“${title}”可比较“${subjectTitle}”的规模与变化，帮助判断影响是否真实发生。`;
  if (type === "图像地图") return `“${title}”呈现路线、方位或画面细节，能把“${subjectTitle}”放回具体空间。`;
  return `“${title}”可核对“${subjectTitle}”发生的过程，并补充当时的时代条件。`;
}

const materialLearningSteps = [
  { focus: "背景与条件", label: "先看事件为何会出现" },
  { focus: "行动与变化", label: "再看事件发生了什么" },
  { focus: "结果与影响", label: "最后看它改变了什么" },
] as const;

function eventMaterials(event: HistoryEvent): MissionMaterial[] {
  const period = `${formatYear(event.year)}${event.endYear ? `—${formatYear(event.endYear)}` : ""}`;
  return event.evidence.map((title, index) => {
    const type = materialTypeFor(title);
    const summary = event.keyPoints[index] ?? event.impact;
    const step = materialLearningSteps[index] ?? { focus: "补充证据", label: "把材料放回事件脉络" };
    const defaultContext = index === 0
      ? `${step.label}：${event.scene}`
      : index === 1
        ? `${step.label}：${event.summary}`
        : index === 2
          ? `${step.label}：${event.impact}`
          : `${step.label}：${summary}`;
    const note = event.materialNotes?.[index];
    return {
      id: `${event.id}-material-${index + 1}`,
      type,
      date: period,
      title,
      focus: note?.focus ?? step.focus,
      intro: materialIntroFor(title, type, event.title),
      context: note?.context ?? defaultContext,
      summary: `阅读时留意：${note?.clue ?? summary}`,
      keywords: [title, summary, note?.context ?? "", note?.clue ?? ""],
    };
  });
}

function eventTimePrompt(event: HistoryEvent) {
  const startDynasty = findDynastyForYear(event.year);
  const endDynasty = findDynastyForYear(event.endYear ?? event.year);
  const dynastyPosition = startDynasty.id === endDynasty.id ? startDynasty.label : `${startDynasty.label}至${endDynasty.label}`;
  const relativePosition = event.track === "world" ? `放到中国时间轴上约在${dynastyPosition}` : `处在${dynastyPosition}`;
  if (event.endYear) return `${formatYear(event.year)}至${formatYear(event.endYear)}，${relativePosition}；说清开始、结束与持续过程。`;
  return `${formatYear(event.year)}，${relativePosition}；可再联系此前或此后的一件变化。`;
}

function relationFor(referenceYear: number, referenceTrack: HistoryEvent["track"], event: HistoryEvent) {
  if (event.track !== referenceTrack) return "同期对照";
  if (event.year < referenceYear) return "此前发生";
  if (event.year > referenceYear) return "此后发生";
  return "同一现场";
}

function eventMission(event: HistoryEvent): LearningMission {
  const role = event.roles[0] ?? "历史现场见证者";
  return {
    key: `event:${event.id}`,
    subjectId: event.id,
    subjectType: "event",
    unlockId: event.id,
    track: event.track,
    mark: categoryMarks[event.category],
    category: event.category,
    place: event.place,
    period: `${formatYear(event.year)}${event.endYear ? ` — ${formatYear(event.endYear)}` : ""}`,
    title: event.title,
    summary: event.summary,
    heroImage: `${basePath}/historical-art/hero-${event.id}.webp`,
    role,
    roleBackground: event.scene,
    timePrompt: eventTimePrompt(event),
    question: event.question,
    keyPoints: event.keyPoints,
    materials: eventMaterials(event),
    impact: event.impact,
    relations: event.relatedIds.map((id) => eventById.get(id)).filter(Boolean).map((related) => ({
      id: related!.id,
      title: related!.title,
      meta: `${formatYear(related!.year)} · ${related!.place}`,
      relation: relationFor(event.year, event.track, related!),
    })),
  };
}

function figureMission(figure: HistoryFigure): LearningMission {
  const relatedEvent = eventById.get(figure.relatedEventId);
  const role = `${figure.name}本人`;
  const milestoneMaterials: MissionMaterial[] = figure.milestones.map((milestone, index) => ({
    id: `${figure.id}-milestone-${index + 1}`,
    type: "生平档案",
    date: milestone.year,
    title: milestone.text,
    focus: index === 0 ? "人物起点" : index === 1 ? "关键转折" : "后续变化",
    intro: `记录了${milestone.year}的关键行动，可用来理解人物选择与时代的关系。`,
    context: index === 0
      ? `${figure.name}的生平时间从这里进入关键阶段：${figure.summary}`
      : index === 1
        ? `把这一节点与前后经历比较，观察人物怎样回应当时的问题。`
        : `把这一节点与人物的长期影响相连，判断哪些变化延续到了后来。`,
    summary: `阅读时留意：这次行动怎样回应了${figure.name}所处时代的问题？`,
    keywords: [milestone.text, milestone.year, figure.name],
  }));
  const contextMaterial = relatedEvent?.evidence[0] ? [{
    id: `${figure.id}-context-1`,
    type: "时代材料",
    date: formatYear(relatedEvent.year),
    title: relatedEvent.evidence[0],
    focus: "时代背景",
    intro: materialIntroFor(relatedEvent.evidence[0], materialTypeFor(relatedEvent.evidence[0]), relatedEvent.title),
    context: `${relatedEvent.summary} ${relatedEvent.impact}`,
    summary: `阅读时留意：${relatedEvent.keyPoints[0] ?? relatedEvent.summary}`,
    keywords: [relatedEvent.evidence[0], relatedEvent.keyPoints[0] ?? ""],
  }] : [];
  const relationEvents = [relatedEvent, ...(relatedEvent?.relatedIds.map((id) => eventById.get(id)) ?? [])]
    .filter((event, index, list): event is HistoryEvent => Boolean(event) && list.findIndex((candidate) => candidate?.id === event?.id) === index)
    .slice(0, 3);

  return {
    key: `figure:${figure.id}`,
    subjectId: figure.id,
    subjectType: "figure",
    unlockId: `figure:${figure.id}`,
    track: figure.track,
    mark: figure.name.slice(0, 1),
    category: figure.identity,
    place: relatedEvent?.place ?? "他的时代",
    period: figure.years,
    title: figure.name,
    summary: figure.summary,
    heroImage: `${basePath}/historical-art/hero-${figure.id}.webp`,
    role,
    roleBackground: `你正处在${figure.name}人生中的关键转折。${figure.summary}`,
    timePrompt: `${figure.years}；至少说出一个关键年份，并说明它是起点、转折还是后续变化。`,
    question: figure.question,
    keyPoints: [figure.summary, relatedEvent?.keyPoints[0] ?? figure.milestones[0]?.text ?? "人物与时代相互作用", relatedEvent?.impact ?? figure.question],
    materials: [...milestoneMaterials, ...contextMaterial],
    impact: relatedEvent?.impact ?? `${figure.name}的经历说明，历史人物的选择既受时代限制，也可能改变后来者的道路。`,
    relations: relationEvents.map((event, index) => ({
      id: event.id,
      title: event.title,
      meta: `${formatYear(event.year)} · ${event.place}`,
      relation: index === 0 ? "人物所在事件" : relationFor(figure.anchorYear, figure.track, event),
    })),
  };
}

type Dynasty = {
  id: string;
  label: string;
  shortLabel: string;
  dates: string;
  start: number;
  end: number;
  phase: string;
  capitals: string;
  summary: string;
  prompt: string;
  keywords: string[];
  world: string;
};

const dynasties: Dynasty[] = [
  { id: "origin", label: "文明起源", shortLabel: "源", dates: "约公元前3500—前2071年", start: -3500, end: -2071, phase: "王朝之前", capitals: "多中心聚落与早期城址", summary: "农业、城市、公共工程与社会分层逐渐出现，早期国家由此孕育。", prompt: "从聚落到国家，人群为什么愿意共同修建超越一家一户的大工程？", keywords: ["聚落", "水利", "礼制"], world: "两河流域城市兴起，古埃及完成早期统一。" },
  { id: "xia-shang-zhou", label: "夏商周", shortLabel: "夏商周", dates: "约前2070—前221年", start: -2070, end: -222, phase: "早期王朝", capitals: "二里头、殷、镐京、洛邑等", summary: "王朝、文字与礼乐制度逐渐成熟，春秋战国的变革孕育思想与制度突破。", prompt: "从青铜礼器到百家争鸣，权力秩序为什么会催生新的思想？", keywords: ["青铜", "礼乐", "分封", "百家"], world: "希腊城邦、波斯帝国与罗马共和国先后兴起。" },
  { id: "qin-han", label: "秦汉", shortLabel: "秦汉", dates: "前221—220年", start: -221, end: 219, phase: "统一帝国", capitals: "咸阳、长安、洛阳", summary: "大一统国家确立，郡县、文书与统一标准塑造此后两千年的基本政治框架。", prompt: "一个庞大帝国，如何让远方的人遵守同一套规则？", keywords: ["一统", "郡县", "丝路", "纸"], world: "地中海由罗马共和国走向帝国，欧亚交通网络扩大。" },
  { id: "division", label: "三国两晋南北朝", shortLabel: "分合", dates: "220—581年", start: 220, end: 580, phase: "分裂与交融", capitals: "洛阳、建康、平城等", summary: "政权并立与人口迁徙重组南北社会，各族群在冲突、迁徙与制度改革中深度交融。", prompt: "为什么分裂时代既有战争破坏，也会带来人口、技术与文化的重新组合？", keywords: ["政权并立", "迁徙", "交融", "改革"], world: "罗马帝国分裂，欧亚大陆进入民族迁徙与宗教传播活跃期。" },
  { id: "sui-tang", label: "隋唐", shortLabel: "隋唐", dates: "581—907年", start: 581, end: 906, phase: "再统一与开放", capitals: "长安、洛阳", summary: "再统一、运河与制度创新连接南北，长安成为多文明汇聚的国际都市。", prompt: "帝国的开放繁荣，依靠的是都城气象，还是更深层的交通与制度？", keywords: ["统一", "运河", "科举", "交流"], world: "伊斯兰文明兴起，巴格达成为跨区域知识与贸易中心。" },
  { id: "song-liao-jin", label: "五代十国·辽宋夏金", shortLabel: "辽宋夏金", dates: "907—1271年", start: 907, end: 1270, phase: "并立与繁荣", capitals: "开封、临安及北方诸都", summary: "多个政权长期并立，城市商业、海上贸易与印刷技术推动社会活力。", prompt: "为什么政治未统一的时代，也能出现高度发达的经济与技术？", keywords: ["并立", "商业", "海贸", "印刷"], world: "十字军东征与蒙古扩张改变欧亚大陆的权力和交通。" },
  { id: "yuan", label: "元", shortLabel: "元", dates: "1271—1368年", start: 1271, end: 1367, phase: "欧亚一体化", capitals: "大都、上都", summary: "中国重新统一并嵌入更辽阔的欧亚帝国网络，人员、物资与知识流动加速。", prompt: "更紧密的大陆连接为什么会同时传播商品、知识与疾病？", keywords: ["统一", "行省", "驿站", "欧亚"], world: "地中海和亚洲商路相连，黑死病沿贸易网络扩散。" },
  { id: "ming", label: "明", shortLabel: "明", dates: "1368—1644年", start: 1368, end: 1643, phase: "帝国重建与海洋相遇", capitals: "南京、北京", summary: "王朝秩序重建，郑和远航与白银贸易把中国更深地带入早期全球联系。", prompt: "郑和与哥伦布都驶向大海，目标和结果为什么如此不同？", keywords: ["皇权", "远航", "白银", "交流"], world: "文艺复兴、地理大发现与宗教改革重塑欧洲。" },
  { id: "qing", label: "清", shortLabel: "清", dates: "1644—1912年", start: 1644, end: 1911, phase: "多民族国家与近代冲击", capitals: "北京", summary: "统一多民族国家得到巩固，也在工业化与帝国扩张的全球浪潮中遭遇深刻危机。", prompt: "同一个王朝为什么会从盛世治理走向近代危机与制度变革？", keywords: ["大一统", "边疆", "工业冲击", "变法"], world: "科学革命、工业革命和民族国家扩张改变全球力量对比。" },
  { id: "republic", label: "民国时期", shortLabel: "民国", dates: "1912—1949年", start: 1912, end: 1948, phase: "共和探索与民族救亡", capitals: "南京等", summary: "共和制度艰难落地，中国在内忧外患、思想激荡与全民抗战中寻找现代国家道路。", prompt: "当旧制度被推翻，为什么建立稳定的新秩序会更加艰难？", keywords: ["共和", "新文化", "抗战", "建国探索"], world: "两次世界大战、俄国革命与战后国际秩序交替出现。" },
  { id: "prc", label: "中华人民共和国", shortLabel: "新中国", dates: "1949年至今", start: 1949, end: 9999, phase: "国家建设与改革开放", capitals: "北京", summary: "新中国完成国家重建，改革开放推动经济社会转型，并在全球化中持续寻找发展道路。", prompt: "国家建设、改革试验与全球连接如何共同塑造今天的中国？", keywords: ["建设", "改革开放", "全球化", "现代化"], world: "冷战、信息革命与全球治理重塑人类共同生活。" },
];

function findDynastyForYear(year: number) {
  return dynasties.find((dynasty) => year >= dynasty.start && year <= dynasty.end) ?? dynasties[dynasties.length - 1];
}

export function HistoryApp({ view = "home" }: { view?: AppView }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<HistoryFigure | null>(null);
  const [contentFilter, setContentFilter] = useState<(typeof contentFilters)[number]>("全部");
  const [expandedDynastyIds, setExpandedDynastyIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayEventId, setTodayEventId] = useState<string>(events[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [oralRecords, setOralRecords] = useState<OralMissionRecord[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string>(journeys[0].id);
  const storageReadyRef = useRef(false);
  const completedTouchedRef = useRef(false);
  const favoriteTouchedRef = useRef(false);
  const selectedEvent = selectedEventId ? eventById.get(selectedEventId) ?? null : null;
  const activeMission = useMemo(() => selectedEvent ? eventMission(selectedEvent) : selectedFigure ? figureMission(selectedFigure) : null, [selectedEvent, selectedFigure]);
  const todayEvent = eventById.get(todayEventId) ?? events[0];

  useEffect(() => {
    setTodayEventId(events[Math.floor(Math.random() * events.length)].id);
    const timeout = window.setTimeout(() => {
      try {
        if (!completedTouchedRef.current) setCompletedIds(JSON.parse(localStorage.getItem("history-river-completed") ?? "[]"));
        if (!favoriteTouchedRef.current) setFavoriteIds(JSON.parse(localStorage.getItem("history-river-favorites") ?? "[]"));
        setOralRecords(readOralMissionRecords());
      } catch {
        setCompletedIds([]);
        setFavoriteIds([]);
        setOralRecords([]);
      }
      storageReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEventId(null);
        setSelectedFigure(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  function openEvent(event: HistoryEvent) {
    setSelectedFigure(null);
    setSelectedEventId(event.id);
  }

  function closeMission() {
    setSelectedEventId(null);
    setSelectedFigure(null);
  }

  function openFigure(figure: HistoryFigure) {
    setSelectedEventId(null);
    setSelectedFigure(figure);
  }

  function rotateTodayEvent() {
    const pool = events.filter((e) => e.id !== todayEventId);
    setTodayEventId(pool[Math.floor(Math.random() * pool.length)].id);
  }

  function toggleDynasty(id: string) {
    setExpandedDynastyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function expandAllDynasties() {
    setExpandedDynastyIds(dynasties.map((dynasty) => dynasty.id));
  }

  function collapseAllDynasties() {
    setExpandedDynastyIds([]);
  }

  function persist(key: string, value: string[]) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function toggleFavorite(id: string) {
    favoriteTouchedRef.current = true;
    let base = favoriteIds;
    if (!storageReadyRef.current) {
      try { base = JSON.parse(localStorage.getItem("history-river-favorites") ?? "[]"); } catch { base = []; }
    }
    const next = base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
    setFavoriteIds(next);
    persist("history-river-favorites", next);
  }

  function completeEvent(id: string) {
    completedTouchedRef.current = true;
    let base = completedIds;
    if (!storageReadyRef.current) {
      try { base = JSON.parse(localStorage.getItem("history-river-completed") ?? "[]"); } catch { base = []; }
    }
    if (base.includes(id)) return;
    const next = [...base, id];
    setCompletedIds(next);
    persist("history-river-completed", next);
  }

  function handleOralRecordSaved(record: OralMissionRecord) {
    setOralRecords((current) => [record, ...current.filter((item) => item.missionKey !== record.missionKey)].slice(0, 80));
  }

  function openOralRecord(record: OralMissionRecord) {
    if (record.subjectType === "event") {
      const event = eventById.get(record.subjectId);
      if (event) openEvent(event);
      return;
    }
    const figure = figures.find((item) => item.id === record.subjectId);
    if (figure) openFigure(figure);
  }

  function openRelatedEvent(id: string) {
    const event = eventById.get(id);
    if (event) openEvent(event);
  }

  return (
    <main className={`site-shell view-${view}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="历史长河共时轴首页">
          <span className="brand-seal" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 12c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 18c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/></svg></span>
          <span>
            <strong>历史长河</strong>
            <small>HISTORY IN CONTEXT</small>
          </span>
        </Link>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="主要导航">
          <Link className={view === "timeline" ? "active" : ""} href="/timeline" onClick={() => setMenuOpen(false)}>历史长河</Link>
          <Link className={view === "journeys" ? "active" : ""} href="/journeys" onClick={() => setMenuOpen(false)}>专题航线</Link>
          <Link className={view === "records" ? "active" : ""} href="/records" onClick={() => setMenuOpen(false)}>时空旅人</Link>
        </nav>
        <div className="header-actions">
          <button className="menu-button" type="button" aria-label="展开导航" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
      </header>

      {view === "home" && <>
      <section className="hero" id="top">
        <div className="hero-kicker"><span /> 纵向走朝代 · 横向看世界</div>
        <div className="hero-copy">
          <div>
            <h1>沿中国朝代，<br /><em>向下走进历史。</em></h1>
            <p>一条时间轴串起中国历史。收起时看王朝更替，展开后左右滑动，同步查看中国、世界与关键人物。</p>
          </div>
          <aside className="today-card today-quiz-card" aria-label="今日一问">
            <div className="today-card-top">
              <span className="today-label">今日一问</span>
              <button type="button" className="today-swap" onClick={rotateTodayEvent} aria-label="换一张今日事件">↻ 换一张</button>
            </div>
            <TimeQuiz
              event={todayEvent}
              allEvents={events}
              formatYear={formatYear}
              findDynastyForYear={findDynastyForYear}
              onOpenEvent={openEvent}
              onNext={rotateTodayEvent}
            />
          </aside>
        </div>
        <div className="hero-ornament" aria-hidden="true">
          <span className="mountain one" />
          <span className="mountain two" />
          <span className="sun" />
          <span className="boat">━━━━</span>
        </div>
      </section>

      <section className="home-portals" aria-labelledby="home-portals-title">
        <div className="home-portals-heading">
          <span>EXPLORE BY MODE</span>
          <h2 id="home-portals-title">三种方式走进历史长河。</h2>
          <p>今日一问直接动手；时间轴纵览全貌；专题航线串联线索；个人记录方便回看。</p>
        </div>
        <div className="portal-grid">
          <Link href="/timeline"><span>01</span><strong>历史长河</strong><p>沿一条纵向时间轴看朝代，展开后横向查看事件与人物。</p><i>进入时间轴 →</i></Link>
          <Link href="/journeys"><span>02</span><strong>专题航线</strong><p>把散落事件串成问题路径，比较不同历史选择。</p><i>选择航线 →</i></Link>
          <Link href="/records"><span>03</span><strong>时空旅人</strong><p>翻看我的点亮、收藏与口述记录。</p><i>查看记录 →</i></Link>
        </div>
      </section>
      </>}

      {view === "timeline" && <section className="timeline-section vertical-timeline-section" id="timeline">
        <div className="section-heading vertical-heading">
          <div>
            <span className="eyebrow">01 · ONE RIVER THROUGH TIME</span>
            <h2>一条时间轴，细看中国朝代与同期世界</h2>
          </div>
          <p>11个朝代与历史阶段都可折叠。向下看更替，展开一个节点后横向查看同期事件、人物与世界坐标。</p>
        </div>

        <div className="river-controls">
          <div className="scroll-instruction"><span>↓</span><p><strong>向下滚动</strong><small>穿越朝代</small></p><i /><span>↔</span><p><strong>展开横滑</strong><small>查看事件与人物</small></p></div>
          <div className="river-control-actions">
            <div className="content-filters" role="group" aria-label="筛选时间轴内容">
              {contentFilters.map((item) => <button type="button" key={item} className={contentFilter === item ? "active" : ""} onClick={() => setContentFilter(item)}>{item}</button>)}
            </div>
            <div className="collapse-actions" role="group" aria-label="展开或折叠朝代">
              <button type="button" onClick={expandAllDynasties}>全部展开</button>
              <button type="button" onClick={collapseAllDynasties}>全部折叠</button>
            </div>
          </div>
        </div>

        <div className="history-river">
          {dynasties.map((dynasty, dynastyIndex) => {
            const allDynastyEvents = events.filter((event) => findDynastyForYear(event.year).id === dynasty.id).sort((a, b) => a.year - b.year);
            const visibleEvents = allDynastyEvents.filter((event) => contentFilter === "全部" || (contentFilter === "中国" && event.track === "china") || (contentFilter === "世界" && event.track === "world"));
            const chinaCount = allDynastyEvents.filter((event) => event.track === "china").length;
            const worldCount = allDynastyEvents.filter((event) => event.track === "world").length;
            const isExpanded = expandedDynastyIds.includes(dynasty.id);

            return (
              <article className={`era-stop ${isExpanded ? "is-expanded" : "is-collapsed"}`} id={`era-${dynasty.id}`} key={dynasty.id}>
                <div className="axis-column" aria-hidden="true">
                  <span>{String(dynastyIndex + 1).padStart(2, "0")}</span>
                  <i />
                </div>
                <div className="era-content">
                  <header className="era-header">
                    <button className="dynasty-toggle" type="button" aria-expanded={isExpanded} aria-controls={`dynasty-panel-${dynasty.id}`} onClick={() => toggleDynasty(dynasty.id)}>
                      <span className="dynasty-copy">
                        <span className="era-range">{dynasty.dates}</span>
                        <span className="dynasty-title-row"><strong>{dynasty.label}</strong><small>{dynasty.phase}</small></span>
                        <span className="dynasty-summary">{dynasty.summary}</span>
                        <span className="dynasty-meta"><span>主要都城 · {dynasty.capitals}</span><span>关键词 · {dynasty.keywords.join(" / ")}</span></span>
                        <span className="contemporary-world"><b>同期世界</b>{dynasty.world}</span>
                      </span>
                      <span className="dynasty-toggle-side">
                        <span className="era-counts"><span><b>{chinaCount}</b> 中国</span><span><b>{worldCount}</b> 世界</span></span>
                        <span className="toggle-label">{isExpanded ? "收起朝代" : "展开朝代"}</span>
                        <span className="toggle-mark" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                      </span>
                    </button>
                  </header>

                  {isExpanded && <div className="era-rail-wrap" id={`dynasty-panel-${dynasty.id}`}>
                    <div className="era-rail" aria-label={`${dynasty.label}事件，左右滑动浏览`} tabIndex={0}>
                      <div className="river-card dynasty-overview-card">
                        <div className="card-topline"><span>朝代概览</span><i>{dynasty.phase}</i></div>
                        <time>{dynasty.dates}</time>
                        <h4>{dynasty.label}的历史坐标</h4>
                        <p>{dynasty.prompt}</p>
                        <div className="overview-details"><span>主要都城</span><strong>{dynasty.capitals}</strong><span>同期世界</span><strong>{dynasty.world}</strong></div>
                        <footer><span>{dynasty.keywords.join(" · ")}</span><strong>展开朝代</strong></footer>
                      </div>
                      {visibleEvents.map((event) => (
                        <div className={`river-card event-card ${event.track}`} key={`event-${event.id}`}>
                          <div className="card-topline"><span>{event.track === "china" ? "中国" : "世界"}</span><i>{event.category} · {categoryMarks[event.category]}</i></div>
                          <time>{formatYear(event.year)}{event.endYear ? `—${formatYear(event.endYear)}` : ""}</time>
                          <h4>{event.title}</h4>
                          <p>{event.summary}</p>
                          <footer><span>{event.place}</span></footer>
                        </div>
                      ))}
                      {!visibleEvents.length && <div className="empty-rail">这个时代暂时没有符合筛选的内容。</div>}
                      <div className="rail-end" aria-hidden="true"><span>继续向下</span><i>↓</i></div>
                    </div>
                  </div>}
                </div>
              </article>
            );
          })}
          <div className="river-to-today"><span>今</span><div><strong>时间继续流动</strong><small>历史不止发生在过去，也正在被我们创造。</small></div></div>
        </div>
      </section>}

      {view === "journeys" && <section className="journeys-section" id="journeys">
        <div className="section-heading light-heading">
          <div>
            <span className="eyebrow">03 · THEME JOURNEYS</span>
            <h2>历史不是散落的点，<br />而是可以追踪的路径。</h2>
          </div>
          <p>每条航线都从一个问题出发。顺着事件前进，比较不同时代的选择，最后用自己的语言重新解释。</p>
        </div>

        <div className="journey-layout">
          <div className="journey-index" role="tablist" aria-label="专题航线">
            {journeys.map((journey, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeJourneyId === journey.id}
                key={journey.id}
                className={activeJourneyId === journey.id ? "active" : ""}
                style={{ "--journey-color": journey.color } as React.CSSProperties}
                onClick={() => setActiveJourneyId(journey.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{journey.title}</strong><small>{journey.subtitle}</small></div>
                <i>→</i>
              </button>
            ))}
          </div>

          {journeys.filter((journey) => journey.id === activeJourneyId).map((journey) => {
            const journeyEvents = journey.eventIds.map((id) => eventById.get(id)).filter(Boolean) as HistoryEvent[];
            const completedCount = journeyEvents.filter((event) => completedIds.includes(event.id)).length;
            return (
              <article className="journey-map" key={journey.id} style={{ "--journey-color": journey.color } as React.CSSProperties}>
                <div className="journey-question">
                  <span>这条航线追问</span>
                  <h3>{journey.question}</h3>
                  <p>{journey.description}</p>
                  <div className="journey-progress"><i style={{ width: `${(completedCount / journeyEvents.length) * 100}%` }} /><span>{completedCount} / {journeyEvents.length} 已点亮</span></div>
                </div>
                <div className="journey-stops">
                  {journeyEvents.map((event, index) => (
                    <button type="button" key={event.id} className={completedIds.includes(event.id) ? "complete" : ""} onClick={() => openEvent(event)}>
                      <span>{completedIds.includes(event.id) ? "✓" : index + 1}</span>
                      <div><small>{formatYear(event.year)} · {event.track === "china" ? "中国" : "世界"}</small><strong>{event.title}</strong></div>
                    </button>
                  ))}
                </div>
                <button type="button" className="journey-start" onClick={() => openEvent(journeyEvents.find((event) => !completedIds.includes(event.id)) ?? journeyEvents[0])}>
                  {completedCount ? "继续这条航线" : "从第一个现场出发"}<span>→</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>}

      {view === "records" && <ProgressSection completedIds={completedIds} favoriteIds={favoriteIds} oralRecords={oralRecords} openEvent={openEvent} openRecord={openOralRecord} />}

      {activeMission && (
        <HistoryMissionDialog
          key={activeMission.key}
          mission={activeMission}
          wasUnlocked={completedIds.includes(activeMission.unlockId)}
          isFavorite={selectedEvent ? favoriteIds.includes(selectedEvent.id) : undefined}
          onToggleFavorite={selectedEvent ? () => toggleFavorite(selectedEvent.id) : undefined}
          onClose={closeMission}
          onUnlock={completeEvent}
          onOpenRelated={openRelatedEvent}
          onRecordSaved={handleOralRecordSaved}
        />
      )}
    </main>
  );
}

export default function Home() {
  return <HistoryApp view="home" />;
}

function ProgressSection({
  completedIds,
  favoriteIds,
  oralRecords,
  openEvent,
  openRecord,
}: {
  completedIds: string[];
  favoriteIds: string[];
  oralRecords: OralMissionRecord[];
  openEvent: (event: HistoryEvent) => void;
  openRecord: (record: OralMissionRecord) => void;
}) {
  const scrolls = [
    { id: "ancient-china", title: "中国古代史", subtitle: "统一、交流与社会生长", mark: "华", events: events.filter((event) => event.track === "china" && event.year < 1840), color: "red" },
    { id: "modern-china", title: "中国近现代史", subtitle: "救亡图存与走向复兴", mark: "新", events: events.filter((event) => event.track === "china" && event.year >= 1840), color: "gold" },
    { id: "world-history", title: "世界史", subtitle: "璀璨群星与全球联结", mark: "世", events: events.filter((event) => event.track === "world"), color: "jade" },
  ];
  const favoriteEvents = favoriteIds.map((id) => eventById.get(id)).filter(Boolean) as HistoryEvent[];
  const badgeStates = [
    { title: "初见共时", note: "解锁第一个历史节点", mark: "一", unlocked: completedIds.length >= 1 },
    { title: "历史侦探", note: "解锁三个历史节点", mark: "证", unlocked: completedIds.length >= 3 },
    { title: "航线行者", note: "解锁六个历史节点", mark: "路", unlocked: completedIds.length >= 6 },
    { title: "长河讲述者", note: "解锁十二个历史节点", mark: "述", unlocked: completedIds.length >= 12 },
  ];

  return (
    <section className="progress-section" id="progress">
      <div className="section-heading">
        <div>
          <span className="eyebrow">04 · MY HISTORY SCROLLS</span>
          <h2>每说清一段历史，<br />就点亮一处长河。</h2>
        </div>
        <div className="progress-summary"><strong>{completedIds.length}</strong><span>个节点已解锁</span><i /><strong>{oralRecords.length}</strong><span>份口述档案</span></div>
      </div>

      <div className="scroll-collection">
        {scrolls.map((scroll) => {
          const completed = scroll.events.filter((event) => completedIds.includes(event.id)).length;
          const percent = Math.round((completed / scroll.events.length) * 100);
          return (
            <article className={`history-scroll ${scroll.color}`} key={scroll.id}>
              <div className="scroll-mark">{scroll.mark}</div>
              <span>{scroll.subtitle}</span>
              <h3>{scroll.title}</h3>
              <div className="scroll-path"><i style={{ width: `${percent}%` }} />{Array.from({ length: 7 }).map((_, index) => <b key={index} className={index / 6 <= percent / 100 ? "lit" : ""} />)}</div>
              <div><strong>{completed} / {scroll.events.length}</strong><small>已点亮 {percent}%</small></div>
              <button type="button" onClick={() => openEvent(scroll.events.find((event) => !completedIds.includes(event.id)) ?? scroll.events[0])}>继续展开 <span>→</span></button>
            </article>
          );
        })}
      </div>

      <div className="achievements-grid">
        <div className="badges-panel">
          <div className="subheading"><span>学习成就</span><strong>不是奖励记忆，而是纪念真正说清楚的时刻。</strong></div>
          <div className="badges">
            {badgeStates.map((badge) => (
              <div className={badge.unlocked ? "badge unlocked" : "badge"} key={badge.title}>
                <span>{badge.unlocked ? badge.mark : "?"}</span><div><strong>{badge.title}</strong><small>{badge.note}</small></div>
              </div>
            ))}
          </div>
        </div>
        <aside className="favorites-panel">
          <div className="subheading"><span>稍后重访</span><strong>收藏的事件与问题</strong></div>
          {favoriteEvents.length ? (
            <div className="favorite-list">{favoriteEvents.slice(0, 4).map((event) => <button type="button" key={event.id} onClick={() => openEvent(event)}><span>★</span><div><strong>{event.title}</strong><small>{formatYear(event.year)} · {event.question}</small></div><i>→</i></button>)}</div>
          ) : (
            <div className="empty-favorites"><span>☆</span><p>在事件卡右上角点亮星标，把想继续追问的历史留在这里。</p></div>
          )}
        </aside>
      </div>

      <div className="oral-record-panel">
        <div className="subheading"><span>口述档案</span><strong>保留身份、所选材料与自己的解释，不保存原始语音。</strong></div>
        {oralRecords.length ? (
          <div className="oral-record-list">
            {oralRecords.slice(0, 8).map((record) => (
              <article className="oral-record-card" key={record.id}>
                <div className="oral-record-heading">
                  <span>{record.subjectType === "figure" ? "人物现场" : "事件现场"}</span>
                  <time>{new Date(record.updatedAt).toLocaleDateString("zh-CN")}</time>
                </div>
                <h3>{record.title}</h3>
                <div className="oral-record-role"><small>本次给定身份</small><strong>{record.role}</strong></div>
                <div className="oral-record-materials"><small>我选择的材料</small><p>{record.materialTitles.map((title, index) => <b className={(record.usedMaterialIds ?? []).includes(record.materialIds[index]) ? "used" : ""} key={`${record.materialIds[index]}-${title}`}>{(record.usedMaterialIds ?? []).includes(record.materialIds[index]) ? "已引用 · " : ""}{title}</b>)}</p></div>
                <blockquote>{record.transcript || "这次记录尚未留下完整口述，可重新进入现场继续。"}</blockquote>
                <p className="oral-record-feedback"><small>上次历史回响</small>{record.feedback}</p>
                <footer><span>{record.outcome === "unlocked" ? "已完成并解锁" : "已保存，可继续"}</span><button type="button" onClick={() => openRecord(record)}>重新进入 <i>→</i></button></footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-oral-records"><span>述</span><p>进入任一事件或人物现场，带着给定身份选一份材料并完成口述；记录会保存在这里。</p></div>
        )}
      </div>

      <footer className="site-footer">
        <div className="brand"><span className="brand-seal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 12c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 18c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/></svg></span><span><strong>历史长河 · 共时轴</strong><small>UNDERSTAND HISTORY IN CONTEXT</small></span></div>
        <p>从一个历史现场出发，看见同一个时代，最终形成自己的解释。</p>
        <span>历史长河学习实验 · 原型 V0.6</span>
      </footer>
    </section>
  );
}
