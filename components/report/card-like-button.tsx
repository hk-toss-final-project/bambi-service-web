"use client";

import { useRequireAuth } from "@/components/auth/use-require-auth";
import { useCardLike } from "@/hooks/use-card-like";
import type { CardSocial } from "@/types/feed";

/**
 * 카드 상세 좋아요 토글 — PUBLIC 카드에서만 렌더된다(노출 판정은 호출부 CardDetailScreen).
 *
 * 정책(2026-08-04 확정):
 * - PUBLIC 카드는 **작성자 본인을 포함한** 모든 로그인 사용자가 좋아요·취소할 수 있다.
 *   본인 여부로 버튼을 숨기거나 비활성화하지 않는다(서버도 소유자를 막지 않는다).
 * - 게스트 클릭은 requireAuth 가 GuestGateModal 로 가로챈다 → /like 요청이 나가지 않는다
 *   (백엔드 쓰기는 인증 필수라, 보내면 401 로 토큰 제거·인증 만료 이벤트가 튄다).
 * - 인증 복원 loading 중 클릭은 requireAuth 가 no-op 으로 삼킨다.
 *
 * 표기는 홈 mock 카드(post-card.tsx)의 하트 규약을 그대로 쓴다: ♥/♡ · 활성 text-signal-ink ·
 * focus-ring · aria-pressed. 다른 점은 상태 원천이 mock useState 가 아니라 서버 확정값이라는 것뿐이다.
 */
export function CardLikeButton({ publicId, social }: { publicId: string; social: CardSocial }) {
  const { requireAuth } = useRequireAuth();
  const { liked, likeCount, busy, failed, toggle } = useCardLike(publicId, social);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => requireAuth(toggle)}
        disabled={busy}
        aria-pressed={liked}
        aria-busy={busy}
        aria-label={liked ? "좋아요 취소" : "좋아요"}
        className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[9px] text-[13px] disabled:opacity-50 ${
          liked ? "text-signal-ink" : "text-muted-foreground hover:bg-background hover:text-ink-mid"
        }`}
      >
        {liked ? "♥" : "♡"}{" "}
        <b className={`font-semibold ${liked ? "text-signal-ink" : "text-ink-mid"}`}>{likeCount}</b>
      </button>

      {/*
        진행·실패 안내를 한 live region 으로 합친다(중복 안내 방지).
        busy 는 스크린리더에만 알리고(시각적으로는 버튼 disabled 상태로 충분),
        실패는 눈에도 보이게 한다. 서버 error.message 원문은 노출하지 않는다.
      */}
      <span
        role="status"
        aria-live="polite"
        className={`text-[11.5px] ${failed ? "text-ink-mid" : "sr-only"}`}
      >
        {busy ? "처리 중…" : failed ? "잠시 후 다시 시도해 주세요" : ""}
      </span>
    </div>
  );
}
