"use client";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { PublicFeedCard } from "@/components/home/public-feed-card";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { useRecFeed } from "@/hooks/use-rec-feed";
import { MOCK_FEED_END } from "@/lib/mock/feed";

/**
 * [피드] 탭 — 공개 피드 실데이터(GET /api/feed/public). member·guest 가 같은 엔드포인트를 쓴다.
 * 상태 분기(success / empty / error)는 목업 variants/home-feed-states.html 기준을 유지한다.
 * 인증 복구 로딩은 상위(home-screen HomeSkeleton)가, 데이터 로딩은 여기 FeedSkeleton 이 담당한다.
 *
 * [피드]는 공개 전용이라 개인 "오늘 아침 브리핑(나만 보기)" 블록은 두지 않는다(개인 보고서는
 * [내 보고서] MemberFeed). 서버 쿼리가 PUBLIC 카드만 조회하므로 프론트에서 다시 걸러내지 않는다.
 *
 * guest/member 분기가 없다: 카드가 렌더하는 값이 전부 공개 데이터라 숨길 개인화 신호가 없다
 * (mock 시절의 추천 사유·보관 상태·본인 강조는 실 계약에 없어 제거됐다). 좋아요는 읽기 전용
 * 표시라 로그인 게이트가 필요한 액션도 없다 → requireAuth 를 쓰지 않는다.
 */
export function FeedRec() {
  // 데이터 계층: 인증 확정 후 useRecFeed 가 loading/success/empty/error 를 정규화한다.
  const result = useRecFeed();
  const retry = result.refetch;

  if (result.status === "loading") return <FeedSkeleton />;

  if (result.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[320px]"
        icon={<IconAlert />}
        title="피드를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        actions={[{ label: "다시 시도", onClick: retry, variant: "primary" }]}
      />
    );
  }

  if (result.status === "empty") {
    return (
      <StateView
        className="min-h-[320px]"
        icon={<IconEmptyDoc />}
        title="지금 보여드릴 공개 브리핑이 없어요"
        description="새로운 공개 브리핑이 준비되면 이곳에 표시돼요."
        // 동작하지 않던 disabled '관심사 관리' CTA 제거. 실제 동작하는 '잠시 후 다시 확인'(retry)만 유지.
        actions={[{ label: "잠시 후 다시 확인", onClick: retry, variant: "primary" }]}
      />
    );
  }

  const cards = result.data;
  return (
    <div>
      {cards.map((card) => (
        <PublicFeedCard key={card.publicId} card={card} />
      ))}

      {/* .feed-end — 서버가 커서·offset 없이 최신 N건만 주므로(무한 스크롤 불가) 이 문구는 계약과 일치한다. */}
      <div className="px-2.5 pt-5 pb-1.5 text-center text-muted-foreground">
        <div className="mb-1 text-[13.5px] font-bold text-ink-mid">{MOCK_FEED_END.rec.title}</div>
        <div className="text-[12.5px] leading-[1.6]">{MOCK_FEED_END.rec.sub}</div>
      </div>
    </div>
  );
}
