"use client";

import Link from "next/link";

import type { FeedCardVM } from "@/types/feed";

/**
 * [내 보고서] 카드 — GET /api/feed / POST /api/bookmarks 의 CardResponse 기반(FeedCardVM).
 * 백엔드가 주는 값만 렌더한다: 생성시각 · 제목 · 요약 · 왜 나에게 왔나(whyForYou) · 출처.
 * 작성자·좋아요는 목록 응답(GET /api/feed)에서 null 이라 여기서는 만들지 않는다(단건 상세 전용).
 *
 * [피드] 탭의 공개 카드는 별도 DTO(PublicCardResponse)를 쓰는 PublicFeedCard 다 — 이 카드는
 * 내 카드(개인 관점 whyForYou 포함)를, 그쪽은 남의 공개 카드(작성자·좋아요)를 렌더한다.
 *
 * 제목은 /report/{publicId} 내부 링크다(카드 단건 API GET /api/cards/{publicId} 연동 완료).
 * 제목만 링크로 감싸고(카드 전체를 감싸지 않음), 아래 sources 외부 링크와 중첩되지 않게 둔다.
 * 공통 카드 스타일(border·radius·타이포·reason dot)은 PublicFeedCard 와 맞춘다.
 */
export function FeedCard({ card }: { card: FeedCardVM }) {
  return (
    <article className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-4">
      {card.createdAtLabel && (
        <div className="mb-2 text-xs text-muted-foreground">{card.createdAtLabel}</div>
      )}

      {/* 제목 — /report/{publicId} 내부 링크(publicId). 제목만 감싸 sources 외부 링크와 중첩되지 않는다. */}
      <h3 className="mb-2 text-lg leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        <Link href={`/report/${card.publicId}`} className="focus-ring rounded-[3px] hover:text-signal-ink">
          {card.title}
        </Link>
      </h3>

      <p className="mb-3 text-sm leading-[1.7] text-ink-mid">{card.summary}</p>

      {/* 왜 나에게 왔나(whyForYou) — PostCard reason 라인과 동일 시각 언어. */}
      {card.whyForYou && (
        <div className="mb-3 flex items-start gap-2 text-xs leading-[1.5] text-muted-foreground">
          <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
          <span>{card.whyForYou}</span>
        </div>
      )}

      {/* 출처 — 어댑터가 정규화한 것만 온다(빈 출처 제외). URL 이 있으면 외부 링크, 없으면 텍스트. */}
      {card.sources.length > 0 && (
        <div className="border-t border-border pt-2.5">
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
            출처 {card.sources.length}건
          </div>
          <ul className="flex flex-col gap-1.5">
            {card.sources.map((source, i) => (
              <li key={`${card.publicId}-src-${i}`} className="text-[13px] leading-[1.5]">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring rounded-[3px] font-semibold text-signal-ink hover:underline"
                  >
                    {source.label} ↗
                  </a>
                ) : (
                  <span className="text-ink-mid">{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
