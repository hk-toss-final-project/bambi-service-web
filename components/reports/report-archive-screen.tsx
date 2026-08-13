"use client";

import { type KeyboardEvent, useRef, useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { ReportArchiveCard } from "@/components/reports/report-archive-card";
import { ReportArchiveRail } from "@/components/reports/report-archive-rail";
import { PageState } from "@/components/ui/page-state";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { useReportArchive } from "@/hooks/use-report-archive";
import {
  filterArchiveByPeriod,
  filterArchiveByTag,
  groupArchiveByDate,
  searchArchiveItems,
  sortArchive,
  topArchiveTags,
} from "@/lib/adapters/report-archive";
import { MOCK_ARCHIVE_TAGS, REPORT_ARCHIVE_MOCK_ENABLED } from "@/lib/mock/report-archive";
import type {
  ArchiveItem,
  ArchivePeriod,
  ArchiveSort,
  ArchiveTagFilter,
  ArchiveViewMode,
} from "@/types/report-archive";

/**
 * 내 보고서 전체 보기 — /reports. 홈 [내 보고서]의 "전체 보기"에서 진입한다.
 * **목업 우선(mock-first) 단계**: 화면 구조·상호작용은 docs/design-handoff/product/library.html 을
 * 기준으로 완성하고, API 에 없는 데이터(태그·유형·공개·SNS 통계·데모 항목)는 mock 계약
 * (lib/mock/report-archive.ts + lib/adapters/report-archive-mock.ts)으로 분리한다.
 * 실 API 모드(기본 — NEXT_PUBLIC_REPORT_ARCHIVE_MOCK 미설정 또는 "true" 아님)에서는 mock UI(태그 필터·
 * 배지·통계)가 자동으로 빠지고 실측 필드만 렌더된다(화면 안 깨짐).
 * mock 모드는 NEXT_PUBLIC_REPORT_ARCHIVE_MOCK="true" 를 명시했을 때만 켜진다(opt-in, 디자인 검증용).
 *
 * 검색·태그·기간·정렬·그룹핑·집계는 전부 클라이언트 순수 함수 — 조건 변경으로 API 를 재호출하지 않는다.
 * 보고서는 항상 날짜별로 묶는다(묶기 옵션 없음). Markdown 내보내기는 contentMd API 부재로 제외.
 *
 * 인증 상태 4분기(설정·홈과 동일 패턴): loading→스켈레톤 / error→복원오류 / guest→접근제한 / authenticated→본문.
 * guest 직접 진입 시 목록 API 는 호출하지 않는다(훅이 authenticated 에서만 요청).
 */
export function ReportArchiveScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <ArchiveSkeleton />;
  if (status === "error") return <ArchiveAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <ArchiveAccessRestricted />;
  return <ArchiveView />;
}

function ArchiveView() {
  const archive = useReportArchive();
  const [amOpen, setAmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft footLines={[]} />

          {/* 중앙 아카이브 칼럼 — 목업 shell(좌 300 · 본문 760 · 우 300) */}
          <main className="min-w-0 max-w-[760px] flex-1">
            {/* .kb-head */}
            <h1 className="mb-4 text-[22px] font-bold tracking-[-0.015em] text-foreground">
              내 보고서 전체 보기
            </h1>

            {archive.status === "loading" && <ArchiveListSkeleton />}

            {archive.status === "error" && (
              <StateView
                role="alert"
                className="min-h-[320px]"
                icon={<IconAlert />}
                title="보고서 목록을 불러오지 못했어요"
                description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
                errorCode={archive.errorCode}
                actions={[{ label: "다시 시도", onClick: archive.refetch, variant: "primary" }]}
              />
            )}

            {archive.status === "ready" && (
              <>
                {/* .arch — 아카이브 요약(실제 배열 길이만 사용) */}
                <ArchiveSummary total={archive.data.length} />

                {archive.data.length === 0 ? (
                  /* 전체 Empty — 요약 영역은 유지, 목록 자리에만 Empty(실 API 모드에서만 도달 가능 —
                     mock 모드는 데모 항목이 채운다). */
                  <StateView
                    className="min-h-[260px]"
                    icon={<IconEmptyDoc />}
                    title="아직 쌓인 보고서가 없어요"
                    description="완료된 보고서가 생기면 이곳에서 한 번에 찾아볼 수 있어요."
                    actions={[
                      { label: "＋ 관심 자료 추가", onClick: () => setAmOpen(true), variant: "primary" },
                      { label: "홈으로 이동", href: "/", variant: "ghost" },
                    ]}
                  />
                ) : (
                  <ArchiveResults items={archive.data} />
                )}
              </>
            )}
          </main>

          {/* 우측 rail — 쌓인 기록(실측 createdAt 집계) */}
          {archive.status === "ready" && archive.data.length > 0 && (
            <ReportArchiveRail items={archive.data} />
          )}
        </div>
      </div>

      {/* 저장 성공 시 목록 재조회(홈과 동일한 refetch 공유 패턴). */}
      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} onSaved={archive.refetch} />
    </div>
  );
}

/**
 * .arch — 흰 카드형 요약. 숫자는 실제 목록 길이(주황 강조), 문구는 데이터 유무로만 갈린다.
 * 크기는 목업 .arch 기준(padding 26×28 · radius 16 · 헤드라인 20px/1.5 · 설명 12.5px, 간격 7px) —
 * 좁은 화면에서는 padding 만 한 단계 줄인다. 고정 수치(128개·주간 추가)는 목업 전용이라 쓰지 않는다.
 *
 * **건수는 문장보다 한 단계 두껍게 둔다**(2026-08-07 UI 검수 — 800 vs 700). 주황 색만으로는
 * 한 자리 수(`3개`)일 때 눈에 걸리지 않아 화면에서 가장 먼저 읽혀야 할 값이 문장에 묻혔다.
 * **글자 크기는 목업 그대로 20px 이고 굵기만 올린다** — 숫자만 키우면 문장의 밑선이 흔들린다.
 * 굵기 800 은 Pretendard Variable(globals.css 에서 로드)이 실제로 렌더한다.
 */
function ArchiveSummary({ total }: { total: number }) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-[26px]">
      {/* .an */}
      <p className="text-[20px] leading-[1.5] font-bold tracking-[-0.015em] text-foreground">
        {total > 0 ? (
          <>
            <b className="font-extrabold text-signal-ink">{total}개</b>의 보고서가 쌓였어요.
          </>
        ) : (
          "아직 쌓인 보고서가 없어요."
        )}
      </p>
      {/* .as */}
      <p className="mt-[7px] text-[12.5px] leading-[1.65] text-muted-foreground">
        {total > 0
          ? "내 관심사를 바탕으로 완성된 개인 보고서를 한곳에서 검색하고 다시 확인할 수 있어요."
          : "완료된 보고서가 생기면 이곳에서 한 번에 찾아볼 수 있어요."}
      </p>
    </section>
  );
}

const PERIOD_OPTIONS: { value: ArchivePeriod; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

const SORT_OPTIONS: { value: ArchiveSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

/**
 * 검색·필터 행 + 필터 패널 + 날짜별 목록. 검색·태그·기간·정렬은 함께 적용되는 클라이언트 순수 계산 —
 * 조건이 바뀌어도 API 를 재호출하지 않는다(메모리의 전체 목록만 사용).
 */
function ArchiveResults({ items }: { items: ArchiveItem[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<ArchiveTagFilter>("all");
  const [period, setPeriod] = useState<ArchivePeriod>("all");
  const [sort, setSort] = useState<ArchiveSort>("latest");
  const [viewMode, setViewMode] = useState<ArchiveViewMode>("list");
  const [panelOpen, setPanelOpen] = useState(false);

  const searching = query.trim() !== "";
  /** 결과 "건수"에 영향을 주는 조건 — 검색·태그·기간(정렬·보기는 표시 방식만 바꾼다). */
  const countCondition = searching || tag !== "all" || period !== "all";
  /** 패널 조건이 기본값에서 벗어났는가 — 필터 버튼 상태 표시 기준. */
  const panelDirty =
    tag !== "all" || period !== "all" || sort !== "latest" || viewMode !== "list";

  const now = new Date();
  const result = sortArchive(
    filterArchiveByPeriod(filterArchiveByTag(searchArchiveItems(items, query), tag), period, now),
    sort,
  );
  const groups = groupArchiveByDate(result, now);

  /** 초기화 — 검색어·태그·기간·정렬·보기 전부 기본값으로. */
  function resetAll() {
    setQuery("");
    setTag("all");
    setPeriod("all");
    setSort("latest");
    setViewMode("list");
  }

  /** 카드 나열 — 목록: 연속 카드 / 그리드: 모바일 1열 → md 이상 2열(목업 grid `1fr 1fr`, 최대 2열). */
  function renderCards(cards: ArchiveItem[]) {
    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {cards.map((item) => (
            <ReportArchiveCard key={item.publicId} item={item} view="grid" />
          ))}
        </div>
      );
    }
    return cards.map((item) => <ReportArchiveCard key={item.publicId} item={item} />);
  }

  const scopeText = "제목·요약·추천 이유·출처·태그에서 검색돼요.";

  /*
    검색창 placeholder — 목업 「지식창고에서 검색 — 예: 환율 트리거, CPI, RTX」 처럼 예시를 함께
    보여준다. 예시 문구를 지어내지 않고 **내 보고서에 실제로 붙은 태그** 상위 3개를 쓴다
    (추가 API 호출 없이 이미 메모리에 있는 목록에서 파생). `tags` 를 안 주는 배포본에서는 태그가
    비어 있어 예시 없이 「보고서 검색」 만 남는다.
  */
  const exampleTags = topArchiveTags(items, 3);
  const searchPlaceholder =
    exampleTags.length > 0 ? `보고서 검색 — 예: ${exampleTags.join(", ")}` : "보고서 검색";

  return (
    <>
      {/* .kb-srow — 검색창 + 필터 버튼 한 행(좁은 폭에서는 자연 wrap). 높이 46px = 목업 .kb-search/.kbf-btn. */}
      <div className="mb-2 flex flex-wrap items-center gap-[9px]">
        <label htmlFor="archive-search" className="sr-only">
          {searchPlaceholder} — {scopeText}
        </label>
        <div className="relative min-w-0 flex-1 basis-[220px]">
          <SearchIcon />
          <input
            id="archive-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-[46px] w-full rounded-xl border border-input bg-card pr-4 pl-10 text-sm text-foreground outline-none placeholder:text-low focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-wash"
          />
        </div>
        {/* .kbf-btn — 활성 조건이 있으면 테두리·배경으로 강조한다. 문구 옆 점 표시는 뺐다
            (2026-08-07 UI 검수) — 이미 버튼 전체가 색으로 바뀌어 상태를 말하고 있어 중복이었다.
            스크린리더용 「(적용됨)」은 그대로 남긴다(색은 낭독되지 않는다). */}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-controls="archive-filter-panel"
          className={`focus-ring inline-flex h-[46px] shrink-0 items-center gap-[7px] rounded-xl border px-4 text-[13.5px] font-semibold whitespace-nowrap ${
            panelDirty
              ? "border-primary bg-wash text-signal-ink"
              : "border-input bg-card text-ink-mid hover:bg-background"
          }`}
        >
          <FilterIcon />
          필터
          {panelDirty && <span className="sr-only">(적용됨)</span>}
        </button>
      </div>

      {/* .kbf-panel — 태그(mock) · 기간 · 정렬 · 보기(아이콘) · 구분선 · 결과 안내 */}
      {panelOpen && (
        <div
          id="archive-filter-panel"
          className="mb-3 rounded-[14px] border border-border bg-card px-4 py-3.5"
        >
          {/* .kbf-row — 태그(단일 선택). 태그는 mock 전용 데이터라 실 API 모드에서는 행 자체를 숨긴다. */}
          {REPORT_ARCHIVE_MOCK_ENABLED && (
            <fieldset className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
              <legend className="float-left mr-1 w-9 py-1.5 text-xs font-bold text-muted-foreground">
                태그
              </legend>
              <TagChip label="전체" selected={tag === "all"} onSelect={() => setTag("all")} />
              {MOCK_ARCHIVE_TAGS.map((t) => (
                <TagChip key={t} label={t} selected={tag === t} onSelect={() => setTag(t)} />
              ))}
            </fieldset>
          )}

          <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <legend className="float-left mr-1 w-9 py-1.5 text-xs font-bold text-muted-foreground">
              기간
            </legend>
            {PERIOD_OPTIONS.map((option) => (
              <TagChip
                key={option.value}
                label={option.label}
                selected={period === option.value}
                onSelect={() => setPeriod(option.value)}
              />
            ))}
          </fieldset>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
            <span id="archive-sort-label" className="mr-1 w-9 text-xs font-bold text-muted-foreground">
              정렬
            </span>
            <PanelSegment options={SORT_OPTIONS} value={sort} onChange={setSort} labelId="archive-sort-label" />
          </div>

          {/* .kbf-row — 보기(아이콘 전용 목록/그리드 토글, 목업 .kseg .ks) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
            <span id="archive-view-label" className="mr-1 w-9 text-xs font-bold text-muted-foreground">
              보기
            </span>
            <ViewModeSegment value={viewMode} onChange={setViewMode} />
          </div>

          {/* .kbf-div + 결과 안내 — 목업의 내보내기 행 자리(contentMd API 없음 → MD export 미구현).
              정보성 텍스트라 버튼 스타일·live 속성을 주지 않는다(건수 낭독은 목록 위 live region 1곳만). */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-2.5">
            <p className="text-xs leading-[1.6] text-muted-foreground">
              {countCondition
                ? `전체 ${items.length}건 중 ${result.length}건을 보고 있어요.`
                : `보고서 ${items.length}건을 보고 있어요.`}{" "}
              <span className="text-low">{scopeText}</span>
            </p>
            <button
              type="button"
              onClick={resetAll}
              disabled={!panelDirty && !searching}
              className="focus-ring inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink-mid hover:bg-background disabled:opacity-45"
            >
              초기화
            </button>
          </div>
        </div>
      )}

      {/* 조건 결과 개수 — 건수에 영향을 주는 조건이 있을 때만 조용히 안내(짧은 한 줄, polite 1곳) */}
      <p aria-live="polite" className="mb-1 min-h-[18px] px-0.5 text-xs text-muted-foreground">
        {countCondition ? `조건에 맞는 보고서 ${result.length}건` : ""}
      </p>

      {countCondition && result.length === 0 ? (
        /* 검색·필터 결과 없음 — 전체 Empty 와 구분되는 별도 상태 + 초기화 제공 */
        <StateView
          className="min-h-[240px]"
          icon={<IconEmptyDoc />}
          title="조건에 맞는 보고서가 없어요"
          description="검색어나 필터 조건을 바꿔보세요."
          actions={[{ label: "검색어·필터 초기화", onClick: resetAll, variant: "primary" }]}
        />
      ) : (
        /* 날짜별 고정 그룹 — 그룹 헤딩 + (목록: 연속 카드 / 그리드: 그룹마다 그리드 컨테이너) */
        groups.map((group) => (
          <section key={group.key} className="mb-1">
            {/* .kb-group — 날짜 헤딩 + 건수 */}
            <h2 className="mt-4 mb-2.5 flex items-baseline justify-between px-0.5 text-[13px] font-bold text-ink-mid">
              {group.label}
              <span className="text-xs font-semibold text-muted-foreground">
                보고서 {group.cards.length}건
              </span>
            </h2>
            {renderCards(group.cards)}
          </section>
        ))
      )}
    </>
  );
}

/** .fchip — 태그·기간 공용 단일 선택 chip(aria-pressed). */
function TagChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`focus-ring inline-flex items-center rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap ${
        selected
          ? "border-primary bg-wash text-signal-ink"
          : "border-input bg-card text-ink-mid hover:bg-background"
      }`}
    >
      {label}
    </button>
  );
}

const VIEW_MODE_OPTIONS: { value: ArchiveViewMode; label: string }[] = [
  { value: "list", label: "목록 보기" },
  { value: "grid", label: "그리드 보기" },
];

/**
 * 보기 토글 — 목업 .kseg 아이콘 전용 세그먼트. 화면에는 아이콘만 노출하고
 * 접근 가능한 이름(aria-label)·툴팁(title)·radiogroup+roving tabindex 로 조작한다.
 */
function ViewModeSegment({
  value,
  onChange,
}: {
  value: ArchiveViewMode;
  onChange: (v: ArchiveViewMode) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = VIEW_MODE_OPTIONS.length;
    let next = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(VIEW_MODE_OPTIONS[next].value);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby="archive-view-label"
      className="inline-flex shrink-0 gap-0.5 rounded-[9px] border border-border bg-accent p-0.5"
    >
      {VIEW_MODE_OPTIONS.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`focus-ring inline-flex items-center justify-center rounded-[7px] px-2.5 py-[7px] transition-colors ${
              selected
                ? "bg-card text-foreground shadow-[var(--shadow)]"
                : "text-muted-foreground hover:text-ink-mid"
            }`}
          >
            {option.value === "list" ? <ListViewIcon /> : <GridViewIcon />}
          </button>
        );
      })}
    </div>
  );
}

/** 패널 세그먼트(정렬 등 텍스트형) — 설정 화면 ThemeModeSegment 와 동일한 radiogroup+roving 패턴. */
function PanelSegment<T extends string>({
  options,
  value,
  onChange,
  labelId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  labelId: string;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length;
    let next = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(options[next].value);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="inline-flex shrink-0 gap-0.5 rounded-[9px] border border-border bg-accent p-0.5"
    >
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`focus-ring inline-flex items-center whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-semibold transition-colors ${
              selected
                ? "bg-card text-foreground shadow-[var(--shadow)]"
                : "text-muted-foreground hover:text-ink-mid"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-[15px] -translate-y-1/2 text-muted-foreground"
    >
      <circle cx="7" cy="7" r="4.4" />
      <path d="m13.5 13.5-3.2-3.2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M1.5 3h11M3.5 7h7M5.5 11h3" />
    </svg>
  );
}

/** 목업 .ks 목록 아이콘(가로줄 3개). */
function ListViewIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="1.5" y1="3" x2="12.5" y2="3" />
      <line x1="1.5" y1="7" x2="12.5" y2="7" />
      <line x1="1.5" y1="11" x2="12.5" y2="11" />
    </svg>
  );
}

/** 목업 .ks 그리드 아이콘(사각형 4개). */
function GridViewIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="4.6" height="4.6" rx="1" />
      <rect x="7.9" y="1.5" width="4.6" height="4.6" rx="1" />
      <rect x="1.5" y="7.9" width="4.6" height="4.6" rx="1" />
      <rect x="7.9" y="7.9" width="4.6" height="4.6" rx="1" />
    </svg>
  );
}

/** 목록 로딩 스켈레톤 — 요약·검색 행·그룹 골격. */
function ArchiveListSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div aria-hidden="true">
      <div className="mb-4 rounded-2xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-[26px]">
        <div className={`h-5 w-56 max-w-full ${bar}`} />
        <div className={`mt-2.5 h-3.5 w-80 max-w-full ${bar}`} />
      </div>
      <div className={`mb-3 h-[46px] w-full rounded-xl ${bar}`} />
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="animate-pulse">
          <div className={`mt-4 mb-2.5 h-3.5 w-28 ${bar}`} />
          {/* 카드 골격 = 제목 + 메타 한 줄(요약 없음 — ReportArchiveCard 와 같은 구조). */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="mb-2.5 rounded-[14px] border border-border bg-card px-5 py-4">
              <div className={`h-4 w-3/4 ${bar}`} />
              <div className={`mt-[9px] h-[22px] w-48 max-w-full ${bar}`} />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복구 중 — 중립 전체 스켈레톤. */
function ArchiveSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1">
            <div className="mb-5 h-7 w-52 rounded-md bg-[var(--skel1)]" />
            <ArchiveListSkeleton />
          </main>
        </div>
      </div>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공(설정과 동일 패턴). */
function ArchiveAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        icon={<IconAlert />}
        title="인증 상태를 확인하지 못했어요"
        description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
        actions={[
          { label: "다시 시도", onClick: onRetry, variant: "primary" },
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}

/** guest 직접 진입 — 개인 데이터 화면이라 본문 대신 접근 제한 안내(§15). 목록 API 는 호출되지 않는다. */
function ArchiveAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="내 보고서는 로그인한 사용자만 볼 수 있어요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
