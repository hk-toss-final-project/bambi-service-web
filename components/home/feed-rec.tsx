"use client";

import { useState } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { PublicFeedCard } from "@/components/home/public-feed-card";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { usePublicFeed, type PublicFeedScope } from "@/hooks/use-public-feed";
import { MOCK_FEED_END } from "@/lib/mock/feed";

/**
 * [피드] 탭 — 공개 피드 실데이터(GET /api/feed/public).
 *
 * 로그인 사용자는 내부에서 두 범위를 고른다:
 * - **추천** `following=false` — PUBLIC 카드 전체 최신순. 개인화 랭킹이 아니다(서버에 추천 점수·
 *   사유가 없다). 라벨만 "추천"이고 코드·문구에서 개인화를 주장하지 않는다.
 * - **팔로잉** `following=true` — 내가 팔로우한 작성자의 PUBLIC 카드만. 로그인 필수.
 *
 * 게스트는 추천만 본다 — 내부 전환 바를 아예 렌더하지 않고(단일 탭 바를 억지로 만들지 않는다)
 * 팔로잉 API 도 호출하지 않는다. 비활성 탭·`aria-disabled` 가짜 컨트롤도 두지 않는다.
 *
 * 내부 전환은 외곽 [내 보고서]/[피드] 탭 바(`.tabs`: 14.5px·4px 언더라인·sticky 카드)보다
 * 한 단계 약한 handoff `.chip` 패턴(pill·12.5~13.5px·radius 999px)을 쓴다. 선택 상태는 기존
 * `.chip.on` 토큰(`bg-wash`·`border-primary`·`text-signal-ink`)만 사용하고 새 강조색을 만들지 않는다.
 * 구조는 탭 위젯이 아니라 토글 버튼 묶음이다(`role="group"` + 각 버튼 `aria-pressed`) — 활성 범위
 * 본문만 렌더하므로 비활성 탭이 가리킬 tabpanel 이 없기 때문이다.
 *
 * 상태 분기(success / empty / error)는 목업 variants/home-feed-states.html 기준을 유지한다.
 * 인증 복구 로딩은 상위(home-screen HomeSkeleton)가, 데이터 로딩은 여기 FeedSkeleton 이 담당한다.
 * 카드가 렌더하는 값이 전부 공개 데이터라 카드 자체에는 guest 분기가 없다.
 */
export function FeedRec({ isMember = false }: { isMember?: boolean }) {
  const [scope, setScope] = useState<PublicFeedScope>("recommended");
  // 게스트는 추천으로 고정한다 — 상태를 따로 동기화하지 않고 유효값 하나로 렌더·조회를 함께 맞춘다
  // (외곽 탭의 effectiveTab 과 같은 방식).
  const effectiveScope: PublicFeedScope = isMember ? scope : "recommended";
  // 활성 범위 하나만 조회한다(두 범위 동시 요청 없음). 범위가 바뀌면 훅이 즉시 loading 으로 돌아간다.
  const result = usePublicFeed(effectiveScope);

  return (
    <div>
      {isMember && (
        /*
          탭 위젯이 아니라 **토글 버튼 2개 묶음**이다. 활성 범위의 본문만 DOM 에 있어서
          tab/tabpanel 로 만들면 비활성 탭의 aria-controls 가 존재하지 않는 id 를 가리킨다
          → role="group" + aria-label 로 묶음 이름만 주고, 선택 상태는 각 버튼의 aria-pressed 로
          전달한다(색상 외 전달 수단 유지).
        */
        <div role="group" aria-label="공개 피드 범위" className="mb-3.5 flex gap-2 px-0.5">
          <ScopeChip
            scope="recommended"
            active={effectiveScope === "recommended"}
            onSelect={() => setScope("recommended")}
          >
            추천
          </ScopeChip>
          <ScopeChip
            scope="following"
            active={effectiveScope === "following"}
            onSelect={() => setScope("following")}
          >
            팔로잉
          </ScopeChip>
        </div>
      )}

      <ScopeFeed
        scope={effectiveScope}
        result={result}
        onSelectRecommended={() => setScope("recommended")}
      />
    </div>
  );
}

/** 범위별 본문 — 상태 문구만 범위에 따라 갈라진다. */
function ScopeFeed({
  scope,
  result,
  onSelectRecommended,
}: {
  scope: PublicFeedScope;
  result: ReturnType<typeof usePublicFeed>;
  onSelectRecommended: () => void;
}) {
  const retry = result.refetch;

  if (result.status === "loading") return <FeedSkeleton />;

  if (result.status === "error") {
    // 범위별로 문구를 구분한다 — 어느 목록이 실패했는지 알 수 있어야 재시도 판단이 된다.
    return scope === "following" ? (
      <StateView
        role="alert"
        className="min-h-[320px]"
        icon={<IconAlert />}
        title="팔로잉 피드를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        actions={[{ label: "다시 시도", onClick: retry, variant: "primary" }]}
      />
    ) : (
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
    // 팔로잉 Empty = 팔로우한 사람이 없거나 그 사람들의 공개 카드가 0건인 정상 상태.
    // "팔로우할 사용자 추천" API 가 없으므로 그런 CTA 는 만들지 않고, 실제 동작하는 추천 복귀만 준다.
    return scope === "following" ? (
      <StateView
        className="min-h-[320px]"
        icon={<IconEmptyDoc />}
        title="아직 팔로잉 피드에 표시할 브리핑이 없어요"
        description="팔로우한 사용자의 공개 브리핑이 올라오면 이곳에 표시돼요."
        actions={[{ label: "추천 피드 보기", onClick: onSelectRecommended, variant: "primary" }]}
      />
    ) : (
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

      {/* .feed-end — 제목 한 줄만 둔다(PR #33에서 정리한 한 줄·간격 유지). 범위별로 문구를
          바꾸지 않는다 — 같은 "여기까지" 의미이고 과장할 이유가 없다. */}
      <div className="px-2.5 pt-4 pb-1.5 text-center">
        <div className="text-[13.5px] font-bold text-ink-mid">{MOCK_FEED_END.rec.title}</div>
      </div>
    </div>
  );
}

/**
 * 범위 전환 chip — handoff `.chip`(pill, radius 999px, 13.5px/600, border line-strong) 기준.
 * 선택 상태는 `.chip.on`(bg wash · border signal · text signal-ink) 토큰만 쓴다.
 *
 * 접근성: 평범한 `button` 의 눌림 상태(`aria-pressed`)로 선택을 전달한다. tab 역할을 쓰지 않는
 * 이유는 상위 주석 참조 — 활성 범위 본문만 렌더하므로 가리킬 tabpanel 이 하나뿐이다.
 * Enter/Space 는 native button 기본 동작이라 별도 키 처리가 없다.
 */
function ScopeChip({
  scope,
  active,
  onSelect,
  children,
}: {
  scope: PublicFeedScope;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      id={`scope-btn-${scope}`}
      aria-pressed={active}
      onClick={onSelect}
      className={`focus-ring inline-flex items-center rounded-full border px-3.5 py-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-primary bg-wash text-signal-ink"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
