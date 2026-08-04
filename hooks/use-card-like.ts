"use client";

import { useRef, useState } from "react";

import { likeCard, unlikeCard } from "@/lib/repositories/like";
import type { CardSocial } from "@/types/feed";

/**
 * 카드 좋아요 토글 훅 — POST/DELETE /api/cards/{publicId}/like.
 *
 * 상태 규약(프로필 FollowButton 과 같은 방식):
 * - 초기값은 단건 상세 응답의 liked·likeCount(검증된 CardSocial)에서 받는다.
 * - 응답의 { liked, likeCount } 를 **확정값으로 그대로 반영**한다. 낙관적 증감을 하지 않으므로
 *   실패 시 되돌릴 상태가 없고, 멱등 API 라 이중 클릭에도 카운트가 어긋나지 않는다.
 * - 진행 중 재진입을 차단해 요청이 겹치지 않게 한다(더블탭·연타 방어).
 *   가드는 state 가 아니라 **ref** 로 둔다: 같은 tick 에 연달아 들어온 클릭은 리렌더 전이라
 *   busy state 가 아직 false 로 보여 그대로 통과한다(실측 — 연타 4회에 요청 4건). ref 는 동기라
 *   첫 클릭이 즉시 잠근다. busy state 는 표시용(disabled·aria-busy)으로만 쓴다.
 * - 실패하면 기존 상태를 유지하고 failed 만 세운다 → 같은 버튼으로 바로 재시도할 수 있다.
 *   서버 error.message 원문은 쓰지 않는다(화면 문구는 호출부가 정한다).
 *
 * 인증 게이트는 이 훅이 하지 않는다 — 호출부(CardLikeButton)가 useRequireAuth 로 감싸
 * 게스트 클릭이 /like 요청 자체를 만들지 않게 한다.
 */
export type CardLikeState = {
  liked: boolean;
  likeCount: number;
  busy: boolean;
  failed: boolean;
  toggle: () => void;
};

export function useCardLike(publicId: string, initial: CardSocial): CardLikeState {
  const [state, setState] = useState({ liked: initial.liked, likeCount: initial.likeCount });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false); // 동기 가드 — 같은 tick 연타를 첫 클릭이 즉시 막는다

  function toggle() {
    if (inFlight.current) return; // 진행 중 재진입 차단 — 요청은 항상 1건
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    const call = state.liked ? unlikeCard(publicId) : likeCard(publicId);
    call
      .then((data) => setState({ liked: data.liked, likeCount: data.likeCount }))
      .catch(() => setFailed(true)) // 실패 시 기존 상태 유지(되돌릴 낙관적 변경이 없다)
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }

  return { liked: state.liked, likeCount: state.likeCount, busy, failed, toggle };
}
