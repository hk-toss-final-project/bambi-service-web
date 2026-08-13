"use client";

import type { ReactNode } from "react";

import { FeedCard } from "@/components/home/feed-card";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import type { MemberFeedApi } from "@/hooks/use-member-feed";
import { groupArchiveByDate } from "@/lib/adapters/report-archive";

/**
 * member [내 보고서] 탭 — GET /api/feed 개인 데이터(READY 완료 보고서) 렌더(추후 GET /reports/mine 으로 교체 예정).
 * 상태(useMemberFeed)는 상위 HomeView 가 소유하고(저장 모달과 refetch 공유), 이 컴포넌트는
 * loading / empty / error / success 렌더만 담당한다. 상태 UI 는 기존 컴포넌트를 재사용한다
 * (FeedSkeleton · StateView). 인증 loading/error 는 상위 HomeSkeleton 담당(여기 도달하지 않음).
 *
 * emptyState: READY 목록이 비었을 때 기본 안내 대신 상위가 넣어줄 노드.
 *  - <EmptyMyReports/> → PREPARING·ERROR 도 0건인 "완전 Empty" 온보딩(홈이 세 소스 합쳐 판단).
 *  - null → PREPARING·ERROR 는 있는데 READY 만 없는 경우(위 슬롯/카드로 충분하므로 여기선 아무것도 안 그림).
 *  - 미전달(undefined) → 기존 기본 Empty 문구(하위 호환).
 *
 * READY 카드는 **날짜 그룹**으로 묶어 렌더한다(목업 home-my-reports.html `.kb-group`). 그룹 로직은
 * /reports 가 쓰는 `groupArchiveByDate` 를 그대로 재사용한다 — 라벨 규칙("오늘 · M월 D일" ·
 * "어제 · M월 D일" · "M월 D일" · 다른 연도면 연도 포함 · 파싱 실패는 "날짜 정보 없음" 그룹),
 * 사용자 로컬 시간 기준, 서버 최신순·그룹 내 순서 유지가 이미 검증돼 있어 중복 구현하지 않는다.
 */
export function MemberFeed({
  feed,
  emptyState,
}: {
  feed: MemberFeedApi;
  emptyState?: ReactNode;
}) {
  if (feed.status === "loading") return <FeedSkeleton />;

  if (feed.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[320px]"
        icon={<IconAlert />}
        title="내 보고서를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        errorCode={feed.errorCode}
        actions={[{ label: "다시 시도", onClick: feed.refetch, variant: "primary" }]}
      />
    );
  }

  if (feed.status === "empty") {
    if (emptyState !== undefined) return <>{emptyState}</>;
    return (
      <StateView
        className="min-h-[320px]"
        icon={<IconEmptyDoc />}
        title="아직 받은 보고서가 없어요"
        description="준비된 보고서를 여기에서 확인할 수 있어요."
      />
    );
  }

  // 날짜 그룹 — 파싱 실패 카드는 임의로 제거하지 않고 "날짜 정보 없음" 그룹으로 모인다.
  const groups = groupArchiveByDate(feed.data, new Date());

  return (
    <div>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          {/* .kb-group — 12.5px/700, 좌우 2px, 위 18px·아래 9px */}
          <h3 className="mx-0.5 mt-[18px] mb-[9px] text-[12.5px] font-bold text-muted-foreground first:mt-0">
            {group.label}
          </h3>
          {group.cards.map((card) => (
            <FeedCard key={card.publicId} card={card} />
          ))}
        </section>
      ))}
      {/* .feed-end */}
      <div className="px-2.5 pt-5 pb-1.5 text-center text-muted-foreground">
        <div className="mb-1 text-[13.5px] font-bold text-ink-mid">오늘 보고서는 여기까지예요</div>
        <div className="text-[12.5px] leading-[1.6]">
          생성된 보고서가 내 보고서에 쌓여요.
        </div>
      </div>
    </div>
  );
}
