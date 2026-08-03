import type { TextSegment } from "@/lib/mock/feed";

/**
 * 카드(리포트) 상세 mock 데이터 — 목업 report-detail.html / variants/report-detail-guest.html.
 *
 * ★★ 실제 API 교체 지점 ★★
 * 카드 상세 API는 미확정(영현 도메인 착수 전, CLAUDE.md §2).
 * - 본문은 API가 content_md(마크다운 원문, DECISION-031 A안)로 내려줄 예정 → 마크다운 렌더러로
 *   .md-viewer(globals.css)에 렌더한다. 본문 mock은 "렌더된 결과"를 흉내내므로 JSX(components/report)에 있다.
 * - 계약 확정 시: lib/repositories/report.ts(단일 seam) 본문을 apiGet 호출로 교체, 타입을 types/ 로
 *   이관하고 이 mock 파일과 body mock 을 삭제한다. 데이터 로드는 repository → 훅(useReportDetail)이
 *   소비하며, 미등록 id 의 404 는 서버 app/report/[id]/page.tsx(reportRouteExists)가 처리한다.
 *
 * 공개 범위(private/public) 분리 — mock 단계 임시:
 * - MOCK_PRIVATE_REPORT: 작성자가 자기 "나만 보기" 브리핑을 보는 화면(개인 관점 문구·개인 시퀀스·내 기록 포함).
 * - MOCK_PUBLIC_REPORT: 공개 브리핑(공개 작성자·공개 댓글만). 비로그인 guest 가 보는 화면.
 * 실제 API 연동 후에는 인증 상태가 아니라 보고서의 visibility 값으로 선택한다
 *   (public → guest 도 열람 / private → 소유자만, guest 차단). 선택 로직은 report-screen.tsx 한 곳.
 */

export type SourceRow = {
  no: string;
  trust: "high" | "mid"; // srcrow .dot / .dot.mid
  name: string;
  pub: string;
  type: string; // .stp 배지
};

/** 출처는 공개 정보 — private/public 공통. */
export const MOCK_SOURCES: { count: string; rows: SourceRow[] } = {
  count: "3건",
  rows: [
    {
      no: "[1]",
      trust: "high",
      name: "한국은행 — 외환시장 동향 공시",
      pub: "한국은행 · 2026-07-09 05:10",
      type: "공식 발표",
    },
    {
      no: "[2]",
      trust: "high",
      name: "달러 약세 전환 보도 2건",
      pub: "주요 경제지 · 2026-07-09 04:42",
      type: "주요 언론",
    },
    {
      no: "[3]",
      trust: "mid",
      name: "야간 거래 반응 스레드",
      pub: "외환 커뮤니티 · 참고용 · 03:58",
      type: "커뮤니티",
    },
  ],
};

export type ReportComment = { avatar: string; name: string; time: string; text: string };
export type ReportRailNext = {
  title: string;
  counter: string;
  item: { title: string; meta: string };
  cta: string;
};
export type ReportRailTrust = {
  title: string;
  rows: { label: string; value: string; ok?: boolean }[];
};
export type ReportRailRelated = { title: string; all: string; items: { title: string; meta: string }[] };

/** 데이터 기반 본문 섹션(bodyKind === "sections" 일 때). */
export type ReportSection = { heading: string; paragraphs: string[] };

/** 상세 화면 1건이 필요한 데이터 묶음(본문 컴포넌트 제외 — JSX 는 components/report). */
export type ReportDetail = {
  visibility: "private" | "public";
  readbar: { backLabel: string; mdCopyLabel: string; shareLabel: string };
  /** .dpill 공개 배지 문구. */
  dpill: string;
  head: { avatar: string; name: string; nameSub: string; meta: string };
  title: string;
  lead: string;
  /** reason = "왜 나에게 왔나" 개인 전달 사유. public 은 null(개인 관점 제거). */
  meta: { sourceCount: string; trust: string; reason: TextSegment[] | null };
  savedInitially: boolean;
  /** 본문 컴포넌트 선택(components/report). fx-*는 원/달러 환율 목업 본문, sections는 데이터 기반. */
  bodyKind: "fx-private" | "fx-public" | "sections";
  /** bodyKind === "sections" 일 때 렌더할 본문 섹션. */
  bodySections?: ReportSection[];
  /** MD 복사용 raw markdown(화면 본문과 동일 내용). 실 API 에서는 content_md 로 대체된다. */
  markdown: string;
  comments: {
    blockTitle: string;
    blockSub: string;
    items: ReportComment[];
    inputAvatar: string;
    inputPlaceholder: string;
    note: string | null;
  };
  /** next(개인 시퀀스)·related(내 기록)는 public 에서 null(숨김). trust 는 공개 공통. */
  rail: { next: ReportRailNext | null; trust: ReportRailTrust; related: ReportRailRelated | null };
  sideFoot: string[];
};

/** 섹션 데이터 → raw markdown(lead + "## 제목" + 문단). sections 보고서의 MD 복사용. */
function sectionsToMarkdown(lead: string, sections: ReportSection[]): string {
  const body = sections
    .map((s) => `## ${s.heading}\n\n${s.paragraphs.join("\n\n")}`)
    .join("\n\n");
  return `${lead}\n\n${body}`;
}

const READBAR = { backLabel: "홈 피드로", mdCopyLabel: "⧉ MD 복사", shareLabel: "↗ 공유" } as const;
const REPORT_TITLE = "원/달러 환율, 밤사이 0.8% 하락";
const TRUST_PANEL: ReportRailTrust = {
  title: "출처 신뢰도 요약",
  rows: [
    { label: "출처", value: "3건" },
    { label: "종합 신뢰도", value: "높음", ok: true },
    { label: "마지막 업데이트", value: "05:10" },
  ],
};
const SIDE_FOOT = ["마크다운으로 생성된 브리핑 본문을 뷰어로 렌더링합니다."];

/** 작성자 "나만 보기" 화면 — 로그인 사용자(소유자) 전용. 목업 report-detail.html. */
export const MOCK_PRIVATE_REPORT: ReportDetail = {
  visibility: "private",
  readbar: READBAR,
  dpill: "나만 보기",
  head: {
    avatar: "나",
    name: "내 아침 브리핑",
    nameSub: "· 항목 1/5",
    meta: "오늘 오전 7:00 생성 · 밤사이 수집 42건 중 선별",
  },
  title: REPORT_TITLE,
  lead: "미 CPI 발표를 앞두고 달러가 약세로 전환, 회원님의 환전 예정 시점과 관련한 변동이 감지됐습니다.",
  meta: {
    sourceCount: "3건",
    trust: "● 신뢰도 높음",
    reason: [
      { text: "왜 나에게 왔나: 관심사 " },
      { text: "‘원/달러 환율’", bold: true },
      { text: " 관련 변동 감지" },
    ],
  },
  savedInitially: true,
  bodyKind: "fx-private",
  markdown: [
    "미 CPI 발표를 앞두고 달러가 약세로 전환, 회원님의 환전 예정 시점과 관련한 변동이 감지됐습니다.",
    "",
    "## 핵심 요약",
    "",
    "밤사이 달러화는 주요 통화 대비 전반적으로 약세를 보였습니다. 오늘 밤 발표되는 미 소비자물가지수(**CPI**)가 시장 예상치를 하회할 것이라는 기대가 채권 시장에서 먼저 가격에 반영되기 시작했고, 이 흐름이 외환 시장으로 이어졌습니다.",
    "",
    "- 원/달러 환율은 새벽 3시 이후 낙폭을 키우며 전일 종가 대비 **0.8% 하락**했습니다.",
    "- 채권 금리 동반 하락 — 시장은 오늘 밤 CPI를 낮게 반영하기 시작했습니다.",
    "  - 미 10년물 **−6bp**, 2년물 −4bp (새벽 3시 기준)",
    "  - 금리·환율이 같은 방향 — 출처 [1][2]",
    "- 회원님의 **환전 예정(이달 말)** 시점과 관련해 확인할 만한 변동입니다.",
    "",
    "> “달러 약세는 원화만의 움직임이 아니라 달러 인덱스 전반의 하락과 동조하고 있다.” — 한국은행 외환시장 동향 공시 인용",
    "",
    "## 통화별 야간 변동",
    "",
    "| 통화 | 야간 변동 | 방향 |",
    "| --- | --- | --- |",
    "| USD/KRW | −0.8% | 하락 |",
    "| USD/JPY | −0.5% | 하락 |",
    "| 달러 인덱스(DXY) | −0.4% | 하락 |",
    "| EUR/USD | +0.3% | 유로 강세 |",
    "",
    "## 왜 지금 중요한가",
    "",
    "회원님이 등록한 환전 예정 시점(이달 말)과 목표 환율을 기준으로 보면 현재 환율은 등록한 범위에 근접해 있습니다. 다만 오늘 밤 CPI 수치가 예상을 웃돌 경우 **단기 반등 변수**가 있어, 이후 흐름은 달라질 수 있습니다.",
  ].join("\n"),
  comments: {
    blockTitle: "댓글 · 메모",
    blockSub: "비공개 상태 — 나만 메모 가능",
    items: [
      {
        avatar: "나",
        name: "Parami",
        time: "방금 · 나만 보는 메모",
        text: "이달 말 환전 · 목표가 근접. CPI 결과 보고 분할로 진행. 트리거 ±0.3%로 좁힐지 검토.",
      },
    ],
    inputAvatar: "나",
    inputPlaceholder: "메모를 입력하세요", // 공개 전환 시 "댓글을 입력하세요" (P1)
    note: "공개 브리핑으로 전환하면 다른 사용자가 댓글을 남길 수 있어요.",
  },
  rail: {
    next: {
      title: "다음 항목",
      counter: "02 / 05",
      item: { title: "오픈소스 LLM 신규 릴리즈 2건 — 벤치마크 갱신", meta: "AI · 출처 2건 · 신뢰도 높음" },
      cta: "다음 항목 읽기 →",
    },
    trust: TRUST_PANEL,
    related: {
      title: "관련 브리핑",
      all: "내 기록",
      items: [
        { title: "미 금리 인하 시점 전망 — 3가지 시나리오", meta: "지난주 보관함 · 거시경제" },
        { title: "달러 인덱스 4개월 최저 — 배경 정리", meta: "2일 전 브리핑 · 환율" },
        { title: "환전 수수료 비교 — 주요 은행 5곳", meta: "3주 전 보관함 · 환테크" },
      ],
    },
  },
  sideFoot: SIDE_FOOT,
};

/**
 * 공개 브리핑 화면 — /report/post-fx-trigger. 작성자는 피드 카드(post-fx-trigger)와 동일한 Parami.
 * 같은 "원/달러 환율" 보고서의 공개 뷰(private = 소유자 나만 보기 / public = 공개).
 */
export const MOCK_PUBLIC_REPORT: ReportDetail = {
  visibility: "public",
  readbar: READBAR,
  dpill: "공개",
  head: {
    avatar: "P",
    name: "Parami",
    nameSub: "@parami",
    meta: "오늘 오전 7:20 · 공개 브리핑",
  },
  title: REPORT_TITLE,
  lead: "미 CPI 발표를 앞두고 달러가 약세로 전환했습니다. 제가 설정해 둔 조건에 걸린 야간 변동을 근거와 함께 정리했어요.",
  meta: {
    sourceCount: "3건",
    trust: "● 신뢰도 높음",
    reason: null, // "왜 나에게 왔나" 개인 전달 사유 제거
  },
  savedInitially: false,
  bodyKind: "fx-public",
  markdown: [
    "미 CPI 발표를 앞두고 달러가 약세로 전환했습니다. 제가 설정해 둔 조건에 걸린 야간 변동을 근거와 함께 정리했어요.",
    "",
    "## 핵심 요약",
    "",
    "밤사이 달러화는 주요 통화 대비 전반적으로 약세를 보였습니다. 오늘 밤 발표되는 미 소비자물가지수(**CPI**)가 시장 예상치를 하회할 것이라는 기대가 채권 시장에서 먼저 가격에 반영되기 시작했고, 이 흐름이 외환 시장으로 이어졌습니다.",
    "",
    "- 원/달러 환율은 새벽 3시 이후 낙폭을 키우며 전일 종가 대비 **0.8% 하락**했습니다.",
    "- 채권 금리 동반 하락 — 시장은 오늘 밤 CPI를 낮게 반영하기 시작했습니다.",
    "  - 미 10년물 **−6bp**, 2년물 −4bp (새벽 3시 기준)",
    "  - 금리·환율이 같은 방향 — 출처 [1][2]",
    "- 환전을 앞두고 있다면 확인할 만한 변동입니다.",
    "",
    "> “달러 약세는 원화만의 움직임이 아니라 달러 인덱스 전반의 하락과 동조하고 있다.” — 한국은행 외환시장 동향 공시 인용",
    "",
    "## 통화별 야간 변동",
    "",
    "| 통화 | 야간 변동 | 방향 |",
    "| --- | --- | --- |",
    "| USD/KRW | −0.8% | 하락 |",
    "| USD/JPY | −0.5% | 하락 |",
    "| 달러 인덱스(DXY) | −0.4% | 하락 |",
    "| EUR/USD | +0.3% | 유로 강세 |",
    "",
    "## 왜 지금 중요한가",
    "",
    "환전 예정이 있다면 목표 환율 대비 현재 위치를 점검해 볼 시점입니다. 다만 오늘 밤 CPI 수치가 예상을 웃돌 경우 **단기 반등 변수**가 있어, 이후 흐름은 달라질 수 있습니다.",
  ].join("\n"),
  comments: {
    blockTitle: "댓글",
    blockSub: "1건",
    items: [
      {
        avatar: "MW",
        name: "macro_watcher",
        time: "2시간 전",
        text: "저도 새벽 낙폭에서 같은 신호를 봤어요. CPI 발표 이후 흐름도 공유 부탁드려요.",
      },
    ],
    inputAvatar: "?",
    // 공개 보고서라 문구는 인증 무관 동일. guest 는 클릭 시 requireAuth 가 GuestGateModal 로 가로챈다.
    inputPlaceholder: "댓글을 입력하세요",
    note: null,
  },
  rail: {
    next: null, // 개인 시퀀스(다음 항목) 숨김
    trust: TRUST_PANEL,
    related: null, // 개인 기록(내 기록) 숨김
  },
  sideFoot: SIDE_FOOT,
};

/**
 * 공개(sections) 보고서 팩토리 — 피드 공개 카드에 1:1로 붙는 상세를 간결히 만든다.
 * head/title/lead/sections 만 넘기면 공개 공통값(공개 배지·출처 신뢰도·공개 댓글 입력)을 채운다.
 * markdown 은 sections 에서 생성해 화면 본문과 어긋나지 않는다.
 */
function makePublicReport(o: {
  head: ReportDetail["head"];
  title: string;
  lead: string;
  sections: ReportSection[];
  comment?: ReportComment;
}): ReportDetail {
  return {
    visibility: "public",
    readbar: READBAR,
    dpill: "공개",
    head: o.head,
    title: o.title,
    lead: o.lead,
    meta: { sourceCount: "3건", trust: "● 신뢰도 높음", reason: null },
    savedInitially: false,
    bodyKind: "sections",
    bodySections: o.sections,
    markdown: sectionsToMarkdown(o.lead, o.sections),
    comments: {
      blockTitle: "댓글",
      blockSub: o.comment ? "1건" : "0건",
      items: o.comment ? [o.comment] : [],
      inputAvatar: "?",
      inputPlaceholder: "댓글을 입력하세요",
      note: null,
    },
    rail: { next: null, trust: TRUST_PANEL, related: null },
    sideFoot: SIDE_FOOT,
  };
}

/** post-us10y — macro_watcher 공개 브리핑. 카드 제목과 일치. */
export const MOCK_PUBLIC_US10Y = makePublicReport({
  head: { avatar: "MW", name: "macro_watcher", nameSub: "@macro_w", meta: "오늘 오전 7:41 · 공개 브리핑" },
  title: "미 CPI 발표 전날 밤, 채권시장이 먼저 움직인 이유",
  lead: "10년물 금리가 새벽에 6bp 빠졌습니다. 출처 4건을 원문까지 따라가 보면 시장이 이미 낮은 CPI를 가격에 반영하기 시작했다는 해석이 가능합니다.",
  sections: [
    {
      heading: "채권시장이 먼저 반응했다",
      paragraphs: [
        "새벽 3시 이후 미 국채 금리가 일제히 하락했습니다. 10년물은 6bp, 2년물은 4bp 내렸고, 커브 전반이 낮은 CPI를 선반영하는 흐름이었습니다.",
        "외환·주식보다 채권이 먼저 움직인 건 인플레이션 지표에 가장 민감한 자산이 채권이기 때문입니다.",
      ],
    },
    {
      heading: "오늘 밤 CPI에서 볼 것",
      paragraphs: [
        "헤드라인보다 근원(core) 물가의 전월 대비 흐름이 관건입니다. 예상을 밑돌면 금리 하락이 이어지고, 웃돌면 새벽의 되돌림이 나올 수 있습니다.",
      ],
    },
  ],
  comment: {
    avatar: "P",
    name: "Parami",
    time: "1시간 전",
    text: "새벽 낙폭 근거 잘 봤어요. CPI 발표 이후 환율 반응도 이어서 볼게요.",
  },
});

/** post-llm-release — ai_curator 공개 브리핑. */
export const MOCK_PUBLIC_LLM = makePublicReport({
  head: { avatar: "AC", name: "ai_curator", nameSub: "@ai_cur", meta: "오늘 오전 8:05 · 공개 브리핑" },
  title: "밤사이 나온 오픈소스 LLM 릴리즈 2건 — 코딩 벤치마크 상위권 진입",
  lead: "어젯밤 공개된 오픈소스 모델 2종을 정리했습니다. 벤치마크 수치는 원문 링크를 달아뒀고, 두 모델 모두 로컬 구동 요구사양이 낮아진 게 포인트입니다.",
  sections: [
    {
      heading: "무엇이 바뀌었나",
      paragraphs: [
        "두 모델 모두 코딩 벤치마크(HumanEval 계열)에서 상위권에 진입했습니다. 특히 양자화 후에도 성능 저하가 작아, 소비자용 GPU에서도 돌릴 만한 수준이 됐습니다.",
      ],
    },
    {
      heading: "적용해 볼 만한 곳",
      paragraphs: [
        "사내 코드 어시스턴트나 로컬 실험 환경에 우선 검토할 만합니다. 라이선스 조건은 상업적 사용 가능 여부를 원문에서 반드시 확인하세요.",
      ],
    },
  ],
});

/** post-earnings — value_kim 공개 브리핑. */
export const MOCK_PUBLIC_EARNINGS = makePublicReport({
  head: { avatar: "VK", name: "value_kim", nameSub: "@value_kim", meta: "오늘 오전 6:52 · 공개 브리핑" },
  title: "보유 종목 실적 발표 3분 정리 — 가이던스가 핵심",
  lead: "오늘 장 마감 후 실적을 내는 종목 3개를 짧게 정리했습니다. 매출보다 다음 분기 가이던스에 시장 반응이 갈릴 가능성이 큽니다.",
  sections: [
    {
      heading: "실적보다 가이던스",
      paragraphs: [
        "세 종목 모두 이번 분기 컨센서스는 대체로 부합할 것으로 보입니다. 관건은 다음 분기 가이던스로, 보수적으로 제시되면 실적이 좋아도 주가는 눌릴 수 있습니다.",
      ],
    },
    {
      heading: "체크 포인트",
      paragraphs: [
        "컨퍼런스콜에서 언급되는 비용 구조와 수요 전망 코멘트를 함께 보세요. 숫자보다 톤이 주가를 좌우하는 구간입니다.",
      ],
    },
  ],
});

/** post-fx-setup — fx_daily 공개 브리핑. */
export const MOCK_PUBLIC_FXSETUP = makePublicReport({
  head: { avatar: "FX", name: "fx_daily", nameSub: "@fx_daily", meta: "오늘 오전 7:10 · 공개 브리핑" },
  title: "환전 타이밍, 트리거로 잡는 법 — 내 세팅 공개",
  lead: "±0.3% 트리거로 좁혔더니 알림이 늘긴 했지만 놓치는 구간이 줄었어요. 제가 쓰는 조건과 이유를 정리했습니다.",
  sections: [
    {
      heading: "트리거 조건",
      paragraphs: [
        "목표 환율 대비 ±0.3% 변동을 알림 기준으로 잡았습니다. 폭을 좁힐수록 알림은 늘지만, 급변 구간을 놓치는 일이 줄어듭니다.",
      ],
    },
    {
      heading: "분할 환전과 함께 쓰기",
      paragraphs: [
        "한 번에 환전하기보다 트리거가 걸릴 때마다 분할로 실행하면 평균 단가가 안정됩니다. 목표 시점이 정해져 있다면 실행 구간을 미리 나눠 두세요.",
      ],
    },
  ],
});

/**
 * 리포트 경로 종류. 각 경로는 렌더할 보고서 1개를 가진다(인증 상태로 내용이 바뀌지 않는다).
 * - public:   고유 공개 URL. 이 공개 보고서를 guest·member 모두 동일하게 본다(차이는 인증 액션 실행 여부뿐).
 * - personal: 소유자 전용 개인 경로(예: /report/today). guest 는 차단하고, member 만 이 보고서를 본다.
 */
export type ReportRoute =
  | { kind: "public"; report: ReportDetail }
  | { kind: "personal"; report: ReportDetail };

/**
 * 알려진 리포트 ID → 데이터. key 는 피드 카드 id(lib/mock/feed.ts)와 1:1.
 * - 홈 공개 피드의 클릭 가능한 카드 5건 → 각각 일치하는 public 상세(작성자·제목 동일).
 * - "today": 로그인 사용자의 오늘 아침 브리핑(개인 경로). guest 차단. mock 단계라 private 를 재사용.
 * 정의되지 않은 id(예: abc)는 여기에 없으므로 상세 페이지에서 notFound().
 * (FeedMine "내 보고서"(rep-*)는 개인 보고서라 상세 mock 이 없어 링크를 걸지 않는다 — feed-mine.tsx.)
 */
export const REPORT_REGISTRY: Record<string, ReportRoute> = {
  "post-fx-trigger": { kind: "public", report: MOCK_PUBLIC_REPORT },
  "post-us10y": { kind: "public", report: MOCK_PUBLIC_US10Y },
  "post-llm-release": { kind: "public", report: MOCK_PUBLIC_LLM },
  "post-earnings": { kind: "public", report: MOCK_PUBLIC_EARNINGS },
  "post-fx-setup": { kind: "public", report: MOCK_PUBLIC_FXSETUP },
  today: { kind: "personal", report: MOCK_PRIVATE_REPORT },
};

/**
 * 서버 라우팅용 존재 확인 — 토큰·데이터 없이 등록 여부만 본다(app/report/[id]/page.tsx 서버 notFound()).
 * 등록된 id 의 데이터 로드/상태는 클라이언트 훅(useReportDetail)이 담당한다.
 * ★ mock 시대 전용: 실 API 연동 시 서버는 토큰 없이 존재를 알 수 없으므로 404 전략과 함께 재설계한다.
 */
export function reportRouteExists(id: string): boolean {
  return id in REPORT_REGISTRY;
}

// 데이터 상태(ready/preparing/error)는 lib/repositories/report.ts(ReportResult) + useReportDetail 이,
// 미등록 id 의 notFound(HTTP 404)는 서버 app/report/[id]/page.tsx(reportRouteExists)가 담당한다.
