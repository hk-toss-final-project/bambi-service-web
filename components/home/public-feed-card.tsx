import Link from "next/link";

import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 공개 피드 카드 — GET /api/feed/public(PublicCardResponse) 실데이터 전용.
 *
 * 백엔드가 실제로 주는 값만 렌더한다: 작성자 · 작성 시각 · 제목 · 요약 · 출처 · 좋아요 수/여부.
 * 이전 mock 카드(PostCard)가 갖고 있던 아래 요소는 계약에 없어 **두지 않는다**:
 * 차트·이미지, 댓글 수·댓글 액션, 보관(스크랩) 토글, 공유 버튼, "본인(isMe)" 아바타 강조,
 * "더 보기", ⋯ 메뉴. 동작하지 않는 버튼을 동작하는 것처럼 남기지 않는다.
 *
 * 좋아요는 **읽기 전용 표시**다. 서버에 토글 API(POST/DELETE /api/cards/{publicId}/like)가 있고
 * 카드 상세에는 연결돼 있지만, 피드 좋아요 연결은 이번 범위가 아니다 → 버튼이 아니라 수치로만
 * 보여주고, 가짜 로컬 토글을 만들지 않는다. `liked` 는 조회자 기준 실제 값이라 그대로 반영한다.
 * 값이 검증을 통과하지 못하면(`social === null`) 좋아요 영역만 빼고 카드는 정상 렌더한다.
 *
 * 마크업 관례(테두리·radius·타이포·출처 블록)는 [내 보고서]의 FeedCard 와 맞춘다.
 * 제목만 /report/{publicId} 내부 링크로 감싸 출처 외부 링크와 중첩되지 않게 한다.
 */
export function PublicFeedCard({ card }: { card: PublicFeedCardVM }) {
  return (
    <article className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-4">
      {/* 작성자 + 작성 시각 */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-input bg-background text-[11px] font-bold text-muted-foreground"
        >
          {/* 이니셜은 실제 이름에서만 파생한다. 이름이 없으면 중립 기호(장식) — 가짜 이니셜 금지. */}
          {card.author.initial ?? "◍"}
        </span>
        <div className="min-w-0">
          {card.author.name !== null ? (
            <div className="truncate text-sm font-bold text-foreground">{card.author.name}</div>
          ) : (
            /* displayName·username 이 모두 없는 작성자(탈퇴·부재). 임의 이름을 만들지 않고
               식별 불가 상태를 그대로 알린다. */
            <div className="truncate text-sm font-bold text-muted-foreground">
              작성자 정보 없음
            </div>
          )}
          {card.createdAtLabel && (
            <div className="mt-px truncate text-xs text-muted-foreground">
              {card.createdAtLabel}
            </div>
          )}
        </div>
      </div>

      {/* 제목 — 상세 진입(/report/{publicId}). 어댑터가 UUID 형식을 검증한 값만 온다. */}
      <h3 className="mb-2 text-lg leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        <Link
          href={`/report/${card.publicId}`}
          className="focus-ring rounded-[3px] hover:text-signal-ink"
        >
          {card.title}
        </Link>
      </h3>

      {card.summary && <p className="mb-3 text-sm leading-[1.7] text-ink-mid">{card.summary}</p>}

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
                    className="focus-ring rounded-[3px] font-semibold break-all text-signal-ink hover:underline"
                  >
                    {source.label} ↗
                  </a>
                ) : (
                  <span className="break-all text-ink-mid">{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        좋아요 수 — 읽기 전용. 버튼이 아니라 수치라서 클릭 가능한 것처럼 보이지 않게 둔다.
        `liked` 가 true 면 조회자가 이미 누른 카드다(서버 확정값) → 색·아이콘과 함께 스크린리더용
        문구로도 알린다(색만으로 상태를 전달하지 않는다).

        social 이 null 이면(= 서버 값이 검증을 통과하지 못함) 이 영역을 아예 렌더하지 않는다.
        `0`·`false` 로 보정해 "좋아요 0개, 누른 적 없음"이라고 잘못 단정하지 않는다.
        카드의 나머지(제목·요약·작성자·출처)는 그대로 보여준다.
      */}
      {card.social !== null && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-[12.5px]">
          <span
            aria-hidden="true"
            className={card.social.liked ? "text-signal-ink" : "text-muted-foreground"}
          >
            {card.social.liked ? "♥" : "♡"}
          </span>
          <span
            className={card.social.liked ? "font-semibold text-signal-ink" : "text-muted-foreground"}
          >
            {card.social.likeCount}
          </span>
          <span className="sr-only">
            좋아요 {card.social.likeCount}개{card.social.liked ? " · 내가 좋아요한 브리핑" : ""}
          </span>
        </div>
      )}
    </article>
  );
}
