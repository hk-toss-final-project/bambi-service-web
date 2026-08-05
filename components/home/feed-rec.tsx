"use client";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { PublicFeedCard } from "@/components/home/public-feed-card";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { usePublicFeed } from "@/hooks/use-public-feed";
import { MOCK_FEED_END } from "@/lib/mock/feed";

/**
 * [피드] 탭 — 공개 피드 실데이터. **하나의 목록**이고 사용자가 고르는 내부 탭·chip 은 없다.
 *
 * 로그인 사용자의 목록에는 두 종류가 섞여 있다(팔로잉 2 : 추천 1, 최대 20개):
 * - 내가 팔로우한 작성자의 PUBLIC 카드
 * - 내 관심사와 태그가 맞는, 팔로우하지 않은 다른 작성자의 PUBLIC 카드
 * 게스트는 기존처럼 전체 공개 카드(`following=false`)만 본다.
 *
 * 혼합·중복 제거·shuffle 은 렌더 밖에서 처리한다: 순수 함수는 lib/feed-mix.ts, 조회·shuffle 시점은
 * hooks/use-public-feed.ts 가 담당한다. 이 컴포넌트는 상태별 렌더만 한다.
 *
 * 카드에 "추천 사유"·"관심사 일치" 같은 문구를 새로 붙이지 않는다 — 어떤 카드가 팔로잉이고 어떤
 * 카드가 추천인지 화면에서 구분해 표시하지 않는다(서버가 그런 라벨을 주지 않는다).
 *
 * 상태 분기(success / empty / error)는 목업 variants/home-feed-states.html 기준을 유지한다.
 * 인증 복구 로딩은 상위(home-screen HomeSkeleton)가, 데이터 로딩은 여기 FeedSkeleton 이 담당한다.
 * 부분 실패(팔로잉만 성공 등)는 훅이 흡수해 목록으로 내려주므로 여기서 따로 안내하지 않는다.
 */
export function FeedRec() {
  const result = usePublicFeed();
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
    // 세 조회가 정상이고 혼합 결과가 0건인 경우도 여기로 온다(기존 공개 피드 Empty 유지).
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

  return (
    <div>
      {result.data.map((card) => (
        <PublicFeedCard key={card.publicId} card={card} />
      ))}

      {/* .feed-end — 제목 한 줄만 둔다(PR #33에서 정리한 한 줄·간격 유지). */}
      <div className="px-2.5 pt-4 pb-1.5 text-center">
        <div className="text-[13.5px] font-bold text-ink-mid">{MOCK_FEED_END.rec.title}</div>
      </div>
    </div>
  );
}
