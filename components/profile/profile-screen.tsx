"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useRequireAuth } from "@/components/auth/use-require-auth";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { ProfileEditModal } from "@/components/profile/profile-edit-modal";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import { useAuthorCards, useProfile } from "@/hooks/use-profile";
import { followUser, unfollowUser } from "@/lib/repositories/profile";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";
import type { AuthorCard, FollowData, Profile } from "@/types/profile";

const PROFILE_MENU_LABEL = "프로필";

const JOINED_FORMAT = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const CARD_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * 공개 프로필 — /users/[publicId]. 게스트도 열람 가능(백엔드 permitAll, §15 공개 열람 정책).
 * 본인이면 [프로필 편집], 타인이면 [팔로우/팔로잉](게스트 클릭 시 가입 유도 모달).
 * 목업 profile-self/user.html 기준 — API 없는 블록(주간 활동·유사 사용자·보관 수)은 만들지 않는다.
 */
export function ProfileScreen({ publicId }: { publicId: string }) {
  const { status, user } = useAuth();
  const profile = useProfile(publicId);
  const [amOpen, setAmOpen] = useState(false);

  const isSelf = status === "authenticated" && user?.publicId === publicId;
  const guest = status !== "authenticated" && status !== "loading";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto w-full max-w-[1440px] flex-1">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft
            current={isSelf ? PROFILE_MENU_LABEL : undefined}
            footLines={MOCK_SIDE_FOOT}
            guest={guest}
          />

          <main className="min-w-0 max-w-[760px] flex-1">
            {profile.status === "loading" && <FeedSkeleton />}
            {profile.status === "error" && (
              <PageState
                role="alert"
                icon={<IconAlert />}
                title="프로필을 찾을 수 없어요"
                description="주소가 잘못됐거나, 탈퇴했거나, 잠시 연결이 불안정할 수 있어요."
                actions={[{ label: "다시 시도", onClick: profile.refetch, variant: "primary" }]}
              />
            )}
            {profile.status === "success" && (
              <ProfileBody publicId={publicId} profile={profile.data} isSelf={isSelf} onEdited={profile.refetch} />
            )}
          </main>
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

function ProfileBody({
  publicId,
  profile,
  isSelf,
  onEdited,
}: {
  publicId: string;
  profile: Profile;
  isSelf: boolean;
  onEdited: () => void;
}) {
  const cards = useAuthorCards(publicId);
  const [editOpen, setEditOpen] = useState(false);

  const name = profile.displayName?.trim() || "사용자";
  const joined = formatJoined(profile.joinedAt);

  return (
    <>
      {/* 프로필 헤더 — 목업 .pf-head */}
      <section className="mb-5 rounded-[14px] border border-border bg-card px-[22px] py-5">
        <div className="flex items-start gap-4">
          {/* 이니셜 아바타(사진 업로드는 P2) */}
          <span
            aria-hidden="true"
            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-wash text-[24px] font-bold text-signal-ink"
          >
            {name.slice(0, 1)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[20px] font-bold tracking-[-0.015em] text-foreground">{name}</h1>
              <span className="text-[13px] text-muted-foreground">
                {profile.username ? `@${profile.username}` : null}
                {profile.username && joined ? " · " : null}
                {joined ? `가입 ${joined}` : null}
              </span>
            </div>
            {profile.bio && (
              <p className="mt-2 text-[13.5px] leading-[1.65] text-ink-mid">{profile.bio}</p>
            )}
            <ProfileStats profile={profile} />
          </div>

          {isSelf ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              프로필 편집
            </Button>
          ) : (
            <FollowButton publicId={publicId} initial={profile} />
          )}
        </div>
      </section>

      {/* 공개 브리핑 리스트 — 목업 .pf-cards */}
      {cards.status === "loading" && <FeedSkeleton />}
      {cards.status === "error" && (
        <div
          role="alert"
          className="rounded-[14px] border border-border bg-card px-5 py-6 text-center text-[13.5px] text-ink-mid"
        >
          공개 브리핑을 불러오지 못했어요.{" "}
          <button type="button" onClick={cards.refetch} className="focus-ring rounded-[3px] font-semibold text-signal-ink">
            다시 시도
          </button>
        </div>
      )}
      {cards.status === "empty" && (
        <div className="rounded-[14px] border border-border bg-card px-5 py-8 text-center">
          <div className="mb-1 text-[13.5px] font-bold text-ink-mid">아직 공개한 브리핑이 없어요</div>
          <div className="text-[12.5px] leading-[1.6] text-muted-foreground">
            {isSelf
              ? "내 보고서에서 카드를 공개로 전환하면 여기에 쌓여요."
              : "이 사용자가 브리핑을 공개하면 여기에 표시돼요."}
          </div>
        </div>
      )}
      {cards.status === "success" &&
        cards.data.map((card) => <AuthorCardItem key={card.publicId} card={card} isSelf={isSelf} />)}

      {isSelf && editOpen && (
        <ProfileEditModal profile={profile} onClose={() => setEditOpen(false)} onSaved={onEdited} />
      )}
    </>
  );
}

/** 스탯 줄 — 브리핑(공개)·팔로워·팔로잉. 목업의 "보관"은 스크랩 카운트 API 없음 → 미노출. */
function ProfileStats({ profile }: { profile: Profile }) {
  const items: { label: string; value: number }[] = [
    { label: "브리핑", value: profile.publicCardCount },
    { label: "팔로워", value: profile.followerCount },
    { label: "팔로잉", value: profile.followingCount },
  ];
  return (
    <div className="mt-3 flex gap-5">
      {items.map((it) => (
        <span key={it.label} className="text-[13px] text-muted-foreground">
          <strong className="mr-1 text-[14.5px] font-bold text-foreground">{it.value}</strong>
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * 팔로우/팔로잉 토글 — 게스트 클릭은 가입 유도 모달(requireAuth).
 * 응답(FollowData)이 확정값이므로 성공 시 그대로 반영한다(낙관적 갱신 아님 — 이중클릭에도 안전).
 */
function FollowButton({ publicId, initial }: { publicId: string; initial: Profile }) {
  const { requireAuth } = useRequireAuth();
  const [state, setState] = useState<FollowData>({
    following: initial.following,
    followerCount: initial.followerCount,
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function toggle() {
    requireAuth(() => {
      if (busy) return;
      setBusy(true);
      setFailed(false);
      const call = state.following ? unfollowUser(publicId) : followUser(publicId);
      call
        .then((data) => setState(data))
        .catch(() => setFailed(true))
        .finally(() => setBusy(false));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={state.following ? "outline" : "default"} onClick={toggle} disabled={busy}>
        {state.following ? "팔로잉" : "팔로우"}
      </Button>
      <span aria-live="polite" className="text-[11.5px] text-muted-foreground">
        {failed ? "잠시 후 다시 시도해 주세요" : `팔로워 ${state.followerCount}`}
      </span>
    </div>
  );
}

/**
 * 공개 브리핑 카드. 상세 진입은 본인일 때만 — 타인 카드 단건 API(공개 카드 조회)가
 * 아직 없어서(GET /api/cards/{id}=내 것만) 죽은 링크를 만들지 않는다. (후속: 영현 협의)
 */
function AuthorCardItem({ card, isSelf }: { card: AuthorCard; isSelf: boolean }) {
  const at = formatCardAt(card.createdAt);
  return (
    <article className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-4">
      {at && <div className="mb-2 text-xs text-muted-foreground">{at} · 공개 브리핑</div>}
      <h3 className="mb-2 text-lg leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        {isSelf ? (
          <Link href={`/report/${card.publicId}`} className="focus-ring rounded-[3px] hover:text-signal-ink">
            {card.title}
          </Link>
        ) : (
          card.title
        )}
      </h3>
      <p className="mb-3 text-sm leading-[1.7] text-ink-mid">{card.summary}</p>
      <div className="flex items-center gap-3 border-t border-border pt-2.5 text-[12.5px] text-muted-foreground">
        <span>♡ {card.likeCount}</span>
        {card.sources.length > 0 && <span>출처 {card.sources.length}건</span>}
      </div>
    </article>
  );
}

function formatJoined(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return JOINED_FORMAT.format(new Date(ts));
}

function formatCardAt(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return CARD_AT_FORMAT.format(new Date(ts));
}
