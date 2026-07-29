"use client";

import { useState } from "react";
import Link from "next/link";

import { useRequireAuth } from "@/components/auth/use-require-auth";
import { FxTriggerChart, LlmGrid, Us10yChart } from "@/components/home/mock-charts";
import type { FeedPost, TextSegment } from "@/lib/mock/feed";

/**
 * 피드 포스트 카드 — 목업 .post 1:1.
 * 보관(⚑)·좋아요(♡)·공유(↗)는 인증 필요 액션 — requireAuth 가 가로챈다:
 * authenticated 는 mock 토글 실행, 그 외는 GuestGateModal(§15). (실 저장/공유 API는 계약 확정 후.)
 * guest 에게는 개인화 추천 사유(.reason "내 관심사·팔로우 중")를 숨긴다.
 */
export function PostCard({ post, guest = false }: { post: FeedPost; guest?: boolean }) {
  const { requireAuth } = useRequireAuth();
  const [saved, setSaved] = useState(post.saved);
  const [liked, setLiked] = useState(false);
  // 보관 상태는 로그인 사용자에게만 노출한다(§15). guest 는 항상 "보관"으로 표시하고,
  // 클릭해도 requireAuth 가 GuestGateModal 로 가로채 토글을 실행하지 않는다(보관됨으로 안 바뀜).
  const showSaved = !guest && saved;

  // 공유: member 의 실제 공유(#sh-modal 공개 전환)는 P1 — 이번 범위 미구현(no-op).
  // guest 는 requireAuth 가 GuestGateModal 로 가로챈다.
  function handleShare() {
    /* P1: 실 공유 플로우 미연결 */
  }

  return (
    <article className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-[7px]">
      {/* .phead */}
      <div className="mb-1.5 flex items-center gap-2.5">
        {/* 아바타는 항상 작성자 실제 이니셜. "본인(me)" 워시 강조는 로그인 사용자(guest 아님)에게만 —
            guest 관점에서는 어떤 작성자도 본인처럼 보이면 안 된다(§15). */}
        <span
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
            post.author.isMe && !guest
              ? "border-wash-strong bg-wash text-signal-ink"
              : "border-input bg-background text-muted-foreground"
          }`}
        >
          {post.author.initials}
        </span>
        <div>
          <div className="text-sm font-bold text-foreground">
            {post.author.name}{" "}
            <span className="text-[13px] font-normal text-muted-foreground">
              {post.author.handleText}
            </span>
          </div>
          <div className="mt-px text-xs text-muted-foreground">{post.meta}</div>
        </div>
        {/* .pmore — P1 */}
        <span aria-hidden="true" className="ml-auto self-start px-1 text-lg leading-none text-muted-foreground">
          ⋯
        </span>
      </div>

      {/* .post>*:not(.phead){margin-left:48px} — 제목 클릭 → 카드 상세(P0-4) */}
      <h3 className="mb-2 ml-12 text-lg leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        <Link href={`/report/${post.id}`} className="hover:text-signal-ink">
          {post.title}
        </Link>
      </h3>
      <p className="mb-2.5 ml-12 text-sm leading-[1.7] text-ink-mid">
        {post.body}
        {post.showMore && <span className="font-semibold text-muted-foreground">더 보기</span>}
      </p>

      {post.media === "us10y" && post.imgcap && (
        <SingleImage caption={post.imgcap.caption} source={post.imgcap.source}>
          <Us10yChart />
        </SingleImage>
      )}
      {post.media === "fxTrigger" && post.imgcap && (
        <SingleImage caption={post.imgcap.caption} source={post.imgcap.source}>
          <FxTriggerChart />
        </SingleImage>
      )}
      {post.media === "llmGrid" && (
        // .pgrid
        <div className="mt-0.5 mb-3 ml-12 grid grid-cols-2 gap-[5px] overflow-hidden rounded-[11px] border border-border">
          <LlmGrid />
        </div>
      )}

      {/* .reason — 개인화 추천 사유("내 관심사·팔로우 중"): guest 에게는 숨김 */}
      {!guest && (
        <div className="mb-3 ml-12 flex items-center gap-2 text-xs leading-[1.45] text-muted-foreground">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
          <span>
            <Segments segments={post.reason} />
          </span>
        </div>
      )}

      {/* .pacts — guest 는 reason 이 없어 위 여백을 조금 더 준다 */}
      <div className={`ml-12 flex items-center gap-0.5 border-t border-border pt-1 ${guest ? "mt-3" : "mt-1"}`}>
        {/* ⚑ 보관 — 인증 필요 (requireAuth: member 토글 / 그 외 GuestGateModal) */}
        <button
          type="button"
          onClick={() => requireAuth(() => setSaved((v) => !v))}
          aria-pressed={showSaved}
          className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[12.5px] ${
            showSaved
              ? "text-signal-ink"
              : "text-muted-foreground hover:bg-background hover:text-ink-mid"
          }`}
        >
          ⚑ {showSaved ? <b className="font-semibold">보관됨</b> : "보관"}
        </button>

        {/* 댓글 — P1 시각 전용 */}
        <span className="inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[12.5px] text-muted-foreground">
          <CommentIcon /> <b className="font-semibold text-ink-mid">{post.comments}</b>
        </span>

        {post.likes ? (
          <>
            {/* ♡ — 인증 필요 (requireAuth) */}
            <button
              type="button"
              onClick={() => requireAuth(() => setLiked((v) => !v))}
              aria-pressed={liked}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[12.5px] ${
                liked
                  ? "text-signal-ink"
                  : "text-muted-foreground hover:bg-background hover:text-ink-mid"
              }`}
            >
              {liked ? "♥" : "♡"}{" "}
              <b className={`font-semibold ${liked ? "text-signal-ink" : "text-ink-mid"}`}>
                {post.likes}
              </b>
            </button>
            {/* 조회수 미노출 — 집계 백엔드가 범위 밖(07-27 확정). FeedPost.views 는 mock 데이터에만 남김. */}
            {/* ↗ 공유 — 인증 필요 (requireAuth). span→button 으로 변경(접근성) */}
            <button
              type="button"
              onClick={() => requireAuth(handleShare)}
              className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[12.5px] text-muted-foreground hover:bg-background hover:text-ink-mid"
            >
              ↗ 공유
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => requireAuth(handleShare)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[12.5px] text-muted-foreground hover:bg-background hover:text-ink-mid"
            >
              ↗ 공유
            </button>
            <span
              aria-hidden="true"
              className="ml-auto inline-flex items-center rounded-lg px-[11px] py-[9px] text-[12.5px] text-muted-foreground"
            >
              ⋯
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function SingleImage({
  caption,
  source,
  children,
}: {
  caption: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    // .pimg
    <div className="mt-0.5 mb-3 ml-12 overflow-hidden rounded-[11px] border border-border bg-[var(--img)]">
      <span className="relative block h-[280px]">{children}</span>
      {/* .imgcap */}
      <div className="flex items-baseline gap-2 border-t border-border bg-background px-3 py-2 text-[11.5px] text-muted-foreground">
        <span className="flex-1 leading-[1.45]">{caption}</span>
        <span className="whitespace-nowrap text-ink-mid">{source}</span>
      </div>
    </div>
  );
}

export function Segments({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <b key={i} className="font-semibold text-ink-mid">
            {seg.text}
          </b>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 fill-none stroke-current [stroke-width:1.6]"
    >
      <path
        d="M2.4 3.4h11.2c.6 0 1 .5 1 1v5.5c0 .6-.4 1-1 1H6.2L3.2 13.9v-2.9H2.4c-.6 0-1-.4-1-1V4.4c0-.5.4-1 1-1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
