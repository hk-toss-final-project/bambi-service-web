"use client";

import { useAuth } from "@/components/auth/use-auth";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";

/**
 * 내 프로필 진입 게이트 — /profile. 내비의 [프로필]은 정적 링크라 publicId 를 모른다 →
 * 여기서 인증 사용자에서 publicId 를 꺼내 공개 프로필 화면을 재사용한다.
 * - guest: 내 프로필은 없음 → 로그인/가입 유도(개인 데이터 미노출)
 * - publicId 없음(구버전 me 캐시 등): 재시도 안내
 */
export function MyProfileGate() {
  const { status, user, refreshAuth } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-[100dvh] bg-background">
        <HomeNav onAddOpen={() => {}} />
        <div className="mx-auto max-w-[760px] px-5 pt-6">
          <FeedSkeleton />
        </div>
      </div>
    );
  }

  if (status === "guest" || status === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <HomeNav onAddOpen={() => {}} />
        {status === "guest" ? (
          <PageState
            title="로그인하면 내 프로필이 생겨요"
            description="공개로 전환한 브리핑이 프로필에 쌓이고, 다른 사람이 나를 팔로우할 수 있어요."
            actions={[
              { label: "가입하기", href: "/signup", variant: "primary" },
              { label: "로그인", href: "/login", variant: "ghost" },
            ]}
          />
        ) : (
          <PageState
            role="alert"
            icon={<IconAlert />}
            title="로그인 상태를 확인하지 못했어요"
            description="네트워크가 불안정하거나 세션이 만료됐을 수 있어요."
            actions={[{ label: "다시 시도", onClick: () => void refreshAuth(), variant: "primary" }]}
          />
        )}
      </div>
    );
  }

  const publicId = user?.publicId;
  if (!publicId) {
    // me 응답에 publicId 가 없던 구버전 캐시 — 재조회로 해소.
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <HomeNav onAddOpen={() => {}} />
        <PageState
          role="alert"
          icon={<IconAlert />}
          title="프로필 정보를 불러오지 못했어요"
          actions={[{ label: "다시 시도", onClick: () => void refreshAuth(), variant: "primary" }]}
        />
      </div>
    );
  }

  return <ProfileScreen publicId={publicId} />;
}
