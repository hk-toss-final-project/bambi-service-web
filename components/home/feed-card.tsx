"use client";

import Link from "next/link";

import { ReportTypeBadge } from "@/components/report/report-type-badge";
import type { FeedCardVM } from "@/types/feed";

/** 메타에 노출할 태그 최대 개수 — 나머지는 실제 남은 개수로 `+N` 표시한다. */
const VISIBLE_TAG_LIMIT = 2;

/**
 * [내 보고서] READY 카드 — 목업 `home-my-reports.html` 의 `.kb-card` 압축 구조를 따른다.
 *
 *   제목(최대 2줄, /report/{publicId} 링크)
 *   요약(최대 2줄)
 *   [비공개] #태그 · 출처 N건 · 시각
 *
 * 목업 토큰: `.kb-card`(bg-card·border·radius 14·padding 15/18·mb 9) · `.krow1`(flex, gap 10) ·
 * `.t`(15px/700, line-height 1.45, tracking -.01em) · `.s`(13px, 1.6, mt 5) ·
 * `.m`(11.5px, gap 7, flex-wrap, mt 9) · `.kbadge`(11px/600, pill).
 *
 * **공개 범위는 여기서 바꿀 수 없다.** 공개 전환은 다른 사용자 피드 노출·댓글·좋아요로 이어지는
 * 영향이 큰 행동이라 목록에서 한 번의 클릭으로 되는 구조를 두지 않는다(오조작 방지) — 목록은
 * 현재 상태만 읽기 전용 배지로 알리고, 실제 변경과 링크 공유는 카드 상세의 공유 모달이 담당한다.
 *
 * 서버가 주는 값만 렌더한다. 이 카드에서 **제거한 것**: `whyForYou`, 출처 제목·외부 링크 전체 목록,
 * 카드 내부 긴 작성 날짜(상위 날짜 그룹이 보여준다), `MD 복사`, 가짜 조회수·댓글 수·좋아요 수.
 * 자세한 정보는 `/report/{publicId}` 상세에서 확인한다.
 *
 * **이 카드는 [내 보고서] 전용이다.** 공개 피드는 별도 컴포넌트(`public-feed-card.tsx`)를 쓰므로
 * 여기 있는 생성 종류·공개 상태 배지가 남의 카드에 노출될 경로가 없다. 이 컴포넌트를 공개 목록에
 * 재사용하려 한다면 두 배지를 먼저 분리해야 한다(내 보고서에만 의미 있는 정보다).
 */
export function FeedCard({ card }: { card: FeedCardVM }) {
  const visibleTags = card.tags.slice(0, VISIBLE_TAG_LIMIT);
  const hiddenTagCount = card.tags.length - visibleTags.length;
  // 메타 구분점(·)은 **양쪽에 실제 항목이 있을 때만** 넣는다.
  const metaParts: string[] = [];
  if (card.sources.length > 0) metaParts.push(`출처 ${card.sources.length}건`);
  if (card.createdAtTimeLabel) metaParts.push(card.createdAtTimeLabel);
  const visibilityLabel = toVisibilityLabel(card.visibility);
  // 어댑터가 이미 계약값으로 좁혀 둔다 — null 이면 종류 미표시(배지 자체가 렌더되지 않는다).
  const hasReportType = card.reportType !== null;
  const hasMeta =
    hasReportType || visibilityLabel !== null || visibleTags.length > 0 || metaParts.length > 0;

  return (
    <article className="mb-[9px] rounded-[14px] border border-border bg-card px-[18px] py-[15px]">
      {/* .krow1 — 제목만. 우측 인터랙티브 컨트롤은 두지 않는다(공개 전환은 상세에서). */}
      <h3 className="text-[15px] leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        <Link
          href={`/report/${card.publicId}`}
          className="focus-ring line-clamp-2 rounded-[3px] hover:text-signal-ink"
        >
          {card.title}
        </Link>
      </h3>

      {/* .s — 요약 2줄. 빈 요약이면 영역을 생략한다. 긴 단어·URL 도 줄바꿈해 가로 스크롤을 막는다. */}
      {card.summary && (
        <p className="mt-[5px] line-clamp-2 text-[13px] leading-[1.6] break-words text-ink-mid">
          {card.summary}
        </p>
      )}

      {/*
        .m — 공개 상태 배지 · 태그 · 출처 수 · 시각. 실제 값이 있는 항목만 렌더한다
        (빈 영역·`출처 0건` 금지). 배지는 뒤 항목들과 같은 줄에서 자연스럽게 wrap 된다.
      */}
      {hasMeta && (
        <div className="mt-[9px] flex flex-wrap items-center gap-[7px] text-[11.5px] text-muted-foreground">
          <ReportTypeBadge reportType={card.reportType} />
          {visibilityLabel !== null && <VisibilityBadge label={visibilityLabel} />}
          {visibleTags.map((tag) => (
            <span key={tag} className="break-all">
              #{tag}
            </span>
          ))}
          {hiddenTagCount > 0 && <span>+{hiddenTagCount}</span>}
          {visibleTags.length > 0 && metaParts.length > 0 && (
            <span aria-hidden="true" className="text-input">
              ·
            </span>
          )}
          {metaParts.map((part, i) => (
            <span key={part} className="flex items-center gap-[7px] whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className="text-input">
                  ·
                </span>
              )}
              {part}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * 서버 `visibility` → 배지 문구. **서버 값이 PUBLIC·PRIVATE 일 때만** 문구를 만든다.
 * 어댑터가 값을 보정하지 않고 그대로 담기 때문에(FeedCardVM.visibility) 계약이 깨진 응답에서는
 * null 이고, 그때 배지 자체를 렌더하지 않는다 — 모르는 값을 한쪽으로 단정하지 않는다.
 */
function toVisibilityLabel(visibility: FeedCardVM["visibility"]): string | null {
  if (visibility === "PUBLIC") return "공개";
  if (visibility === "PRIVATE") return "비공개";
  return null;
}

/**
 * 공개 상태 표시 — **읽기 전용**이다. button·switch·checkbox 가 아니라 단순 텍스트(`<span>`)라
 * 키보드 포커스도 클릭 동작도 없고, 기능을 tooltip 뒤에 숨기지도 않는다.
 *
 * 상태는 색이 아니라 문구(`공개`/`비공개`)로 구분된다. 시각 차이는 목업 `.kbadge`(중립) ·
 * `.kbadge.od`(wash·signal-ink) 토큰 안에서만 주고 새 색을 만들지 않는다.
 */
function VisibilityBadge({ label }: { label: string }) {
  const isPublic = label === "공개";
  return (
    <span
      className={`shrink-0 rounded-full border px-[9px] py-[2px] text-[11px] font-semibold whitespace-nowrap ${
        isPublic
          ? "border-wash-strong bg-wash text-signal-ink"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
