"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useRequireAuth } from "@/components/auth/use-require-auth";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { AuthorCardItem } from "@/components/profile/author-card";
import { FollowListModal } from "@/components/profile/follow-list-modal";
import { ProfileEditModal } from "@/components/profile/profile-edit-modal";
import { ProfileRail } from "@/components/profile/profile-rail";
import { ProfileShareButton } from "@/components/profile/profile-share-button";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import { useFollowToggle } from "@/hooks/use-follow-toggle";
import { type AuthorCardsState, useAuthorCards, useProfile } from "@/hooks/use-profile";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";
import type { ReportOrigin } from "@/lib/report-origin";
import type { FollowData, FollowListKind, Profile } from "@/types/profile";

const PROFILE_MENU_LABEL = "프로필";

const JOINED_FORMAT = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

/**
 * 공개 프로필 — /users/[publicId]. 게스트도 열람 가능(백엔드 permitAll, §15 공개 열람 정책).
 * 본인이면 [프로필 편집], 타인이면 [팔로우/팔로잉](게스트 클릭 시 가입 유도 모달). 공유는 양쪽 다.
 *
 * 레이아웃은 목업 `profile-user.html` 처럼 3열(좌측 메뉴 · 본문 · 우측 rail)이고, 폭·간격·숨김
 * breakpoint 는 홈과 같은 규칙을 쓴다(1100 미만 좌측 숨김 · 1240 미만 rail 숨김).
 *
 * **API 없는 목업 블록은 만들지 않는다**: 「이번 주 공개 N건」(기간 집계 없음·목록은 최대 50건 표본),
 * 「비슷한 관심사의 사용자」(추천·사용자 목록 API 없음), 팔로워/팔로잉 목록 모달(목록 API 없음),
 * hero 관심 주제 tags(타인 관심사 API 없음 — 본인만 가능해 비대칭이라 양쪽 다 제외),
 * 아바타·배너 이미지 업로드(컬럼·업로드 API 없음 — 이니셜 아바타와 토큰 기반 cover 로 대신한다),
 * 카드의 댓글 수·조회수(백엔드 전무).
 *
 * 카드 목록은 여기서 한 번만 조회해 본문과 우측 rail 이 나눠 쓴다(rail 때문에 API 를 다시 부르지 않는다).
 */
export function ProfileScreen({
  publicId,
  selfRoute = false,
}: {
  publicId: string;
  /**
   * 이 화면이 `/profile`(내비의 정적 진입점)로 열렸는지. `/users/{publicId}` 면 false.
   * 두 라우트가 같은 컴포넌트를 쓰므로 **URL 은 여기서만 구분된다** — 카드 상세의 뒤로가기를
   * 온 주소 그대로 되돌리려면 이 값이 필요하다. `isSelf` 로는 알 수 없다:
   * `/users/{내 id}` 를 직접 열어도 `isSelf` 는 true 다.
   */
  selfRoute?: boolean;
}) {
  const { status, user } = useAuth();
  const profile = useProfile(publicId);
  const cards = useAuthorCards(publicId);
  const [amOpen, setAmOpen] = useState(false);

  const isSelf = status === "authenticated" && user?.publicId === publicId;
  // 이 프로필의 카드에서 상세로 갈 때 실어 보낼 진입 출처 — 온 라우트를 그대로 되돌린다.
  // `/users/{id}` 는 동적이라 UUID 를 함께 싣고, 목적지 조립은 lib/report-origin 이 한다.
  const backOrigin: ReportOrigin = selfRoute
    ? { token: "profile-self" }
    : { token: "profile", profilePublicId: publicId };
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
                errorCode={profile.errorCode}
                actions={[{ label: "다시 시도", onClick: profile.refetch, variant: "primary" }]}
              />
            )}
            {profile.status === "success" && (
              <ProfileBody
                publicId={publicId}
                profile={profile.data}
                cards={cards}
                isSelf={isSelf}
                backOrigin={backOrigin}
                onEdited={profile.refetch}
              />
            )}
          </main>

          {/* rail 은 프로필 값(전체 공개 수)이 있어야 의미가 있다 — 로딩·오류 때는 3열을 만들지 않는다. */}
          {profile.status === "success" && <ProfileRail profile={profile.data} cards={cards} />}
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

function ProfileBody({
  publicId,
  profile,
  cards,
  isSelf,
  backOrigin,
  onEdited,
}: {
  publicId: string;
  profile: Profile;
  cards: AuthorCardsState & { refetch: () => void };
  isSelf: boolean;
  backOrigin: ReportOrigin;
  onEdited: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  /** null 이면 닫힘. 값이 곧 처음 열릴 탭이다(팔로워 클릭 → followers, 팔로잉 클릭 → following). */
  const [followListTab, setFollowListTab] = useState<FollowListKind | null>(null);
  /**
   * 팔로우 상태를 hero 에서 한 번만 들고, 버튼·스탯·목록 끝 문구가 같은 값을 본다.
   * 버튼 안에 가둬 두면 팔로우 직후에도 스탯의 팔로워 수와 "팔로우하면 …" 문구가 옛 값으로 남는다.
   * 초기값은 서버 응답이고, 이후에는 follow/unfollow 응답의 **확정값**만 들어온다.
   */
  const [follow, setFollow] = useState<FollowData>({
    following: profile.following,
    followerCount: profile.followerCount,
  });

  const name = profile.displayName?.trim() || "사용자";
  const joined = formatJoined(profile.joinedAt);

  return (
    <>
      {/* 프로필 헤더 — 목업 .pcard(radius 16 · overflow hidden · mb 16) */}
      {/* rounded-2xl 은 이 레포의 --radius 스케일에서 18px 로 컴파일된다 → 목업 값을 명시한다. */}
      <section className="mb-4 overflow-hidden rounded-[16px] border border-border bg-card">
        {/*
          .pcover(130px) — **이미지가 아니라 토큰 그라디언트**다. 목업의 cover 도 빈 블록이고, 배너
          업로드는 컬럼·API 가 없다. 사용자별로 색을 만들어내지도 않는다(같은 사람이 다시 봤을 때
          달라지거나, 없는 개인화가 있는 것처럼 보인다).
          그라디언트 정지점은 핸드오프 그대로다: `115deg, --wash-strong → --bg-soft 72%`
          (`--bg-soft` 는 이 앱에서 `--background`). light/dark 모두 토큰을 따라간다.
          아래 테두리는 두지 않는다 — 목업 `.pcover` 에 없고, 아바타 링과 선이 겹쳐 보인다.
        */}
        <div
          aria-hidden="true"
          className="h-[130px] bg-[linear-gradient(115deg,var(--wash-strong),var(--background)_72%)]"
        />

        {/* .pbody2 */}
        <div className="px-[22px] pb-5">
          {/*
            .pavatar-lg — 90px · 4px 카드색 링 · cover 위로 44px · 이니셜 30px(사진 업로드는 P2).
            아바타는 목업처럼 **혼자 한 줄**을 쓰고, 이름·액션은 아래 .prow 가 맡는다.

            배경은 다른 아바타(`.pav`)와 달리 `--wash` 가 아니라 **불투명 `--avatar-bg`** 다.
            이 아바타만 cover 와 카드 배경의 경계에 걸쳐 있어서, 반투명 틴트를 쓰면 위쪽은
            cover 그라디언트가, 아래쪽은 흰 카드가 비쳐 원이 두 톤으로 갈린다(핸드오프가
            `.pavatar-lg` 에만 별도 토큰을 둔 이유다).
          */}
          <span
            aria-hidden="true"
            className="-mt-11 flex h-[90px] w-[90px] items-center justify-center rounded-full border-4 border-card bg-[var(--avatar-bg)] text-[30px] font-bold text-signal-ink shadow-[var(--shadow)]"
          >
            {name.slice(0, 1)}
          </span>

          {/*
            .prow — 이름/핸들 ↔ 액션이 **같은 줄**(액션은 margin-left:auto 로 오른쪽 끝).
            버튼 순서·강조도 목업을 따른다: 본인은 `프로필 편집`(signal) → `공유`,
            타인은 `공유` → `팔로우`(signal). 두 화면 모두 주 액션이 signal 색이다.
            버튼 치수는 핸드오프 `.btn.sm`(12.5px · padding 7/12) 에 맞춘다.
          */}
          <div className="mt-3 flex flex-wrap items-start gap-3">
            {/*
              좁은 화면(모바일)에서는 이름 옆에 버튼 두 개가 같이 서면 핸들·가입일이 세 줄로 접힌다.
              최소 폭을 정해 그보다 좁아지면 액션이 다음 줄로 내려가게 한다(목업은 데스크톱 전용).
            */}
            <div className="min-w-[180px] flex-1">
              <h1 className="text-[22px] leading-[1.3] font-bold tracking-[-0.01em] break-words text-foreground">
                {name}
              </h1>
              {(profile.username !== null || joined !== "") && (
                <div className="mt-[3px] text-[13px] break-words text-muted-foreground">
                  {profile.username !== null ? `@${profile.username}` : null}
                  {profile.username !== null && joined !== "" ? " · " : null}
                  {joined !== "" ? `가입 ${joined}` : null}
                </div>
              )}
            </div>

            {/* .pactions */}
            <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
              {isSelf ? (
                <>
                  <Button className="h-8 px-3 text-[12.5px]" onClick={() => setEditOpen(true)}>
                    프로필 편집
                  </Button>
                  <ProfileShareButton publicId={publicId} name={name} />
                </>
              ) : (
                <>
                  <ProfileShareButton publicId={publicId} name={name} />
                  <FollowButton publicId={publicId} state={follow} onChange={setFollow} />
                </>
              )}
            </div>
          </div>

          {/* .pbio */}
          {profile.bio !== null && profile.bio.trim() !== "" && (
            <p className="mt-3.5 text-sm leading-[1.65] break-words text-ink-mid">{profile.bio}</p>
          )}

          <ProfileStats
            profile={profile}
            followerCount={follow.followerCount}
            onOpenList={setFollowListTab}
          />
        </div>
      </section>

      {/* 공개 브리핑 리스트 — 목업 .post 목록 */}
      {cards.status === "loading" && <FeedSkeleton />}
      {cards.status === "error" && (
        <div
          role="alert"
          className="rounded-[14px] border border-border bg-card px-5 py-6 text-center text-[13.5px] text-ink-mid"
        >
          공개 브리핑을 불러오지 못했어요.{" "}
          <button
            type="button"
            onClick={cards.refetch}
            className="focus-ring rounded-[3px] font-semibold text-signal-ink"
          >
            다시 시도
          </button>
        </div>
      )}
      {cards.status === "empty" && (
        <div className="rounded-[14px] border border-border bg-card px-5 py-8 text-center">
          <div className="mb-1 text-[13.5px] font-bold text-ink-mid">
            아직 공개한 브리핑이 없어요
          </div>
          <div className="text-[12.5px] leading-[1.6] text-muted-foreground">
            {isSelf
              ? "내 보고서에서 카드를 공개로 전환하면 여기에 쌓여요."
              : "이 사용자가 브리핑을 공개하면 여기에 표시돼요."}
          </div>
        </div>
      )}
      {cards.status === "success" && (
        <>
          {cards.data.map((card) => (
            <AuthorCardItem key={card.publicId} card={card} origin={backOrigin} />
          ))}
          <FeedEnd
            name={name}
            total={profile.publicCardCount}
            shown={cards.data.length}
            showFollowHint={!isSelf && !follow.following}
          />
        </>
      )}

      {isSelf && editOpen && (
        <ProfileEditModal profile={profile} onClose={() => setEditOpen(false)} onSaved={onEdited} />
      )}

      {/*
        팔로워/팔로잉 목록 — 열릴 때만 마운트한다(기존 모달 규약). 탭 수치는 이미 받아 둔 프로필
        값을 넘겨서, 목록을 연다고 프로필 API 를 다시 부르지 않는다.

        `onSelfFollowChanged` 는 **내 프로필일 때만** 넘긴다. 내 팔로잉 목록에서 누군가를 언팔하면
        내 followingCount 가 실제로 바뀌므로 프로필을 다시 받아 hero 와 어긋나지 않게 한다
        (프론트에서 ±1 을 계산하지 않는다 — follow 응답은 대상의 followerCount 만 준다).
        남의 프로필에서 제3자를 팔로우하는 건 그 프로필의 수치와 무관해서 아무것도 하지 않는다.
      */}
      {followListTab !== null && (
        <FollowListModal
          ownerPublicId={publicId}
          ownerName={name}
          initialTab={followListTab}
          followerCount={follow.followerCount}
          followingCount={profile.followingCount}
          onClose={() => setFollowListTab(null)}
          onSelfFollowChanged={isSelf ? onEdited : undefined}
        />
      )}
    </>
  );
}

/**
 * 목록 끝 — 목업 `.feed-end`("FX Daily님의 공개 브리핑 18건 중 6건").
 *
 * 두 숫자 모두 실데이터다: 전체는 프로필의 `publicCardCount`(서버 count(*)), 표시 건수는 지금 화면에
 * 그린 카드 수다. 목록 API 는 기본 20건까지만 주므로 둘이 다른 것이 정상이고, 다 보여준 경우
 * (`shown >= total`)에는 "N건 중 N건" 대신 한 숫자만 말한다.
 *
 * 팔로우 안내는 **팔로우로 실제 달라지는 것**만 말한다(팔로잉 피드가 있다 — GET /api/feed/public
 * ?following=true). 본인이거나 이미 팔로우 중이면 띄우지 않는다.
 */
function FeedEnd({
  name,
  total,
  shown,
  showFollowHint,
}: {
  name: string;
  total: number;
  shown: number;
  showFollowHint: boolean;
}) {
  return (
    <div className="px-5 pt-2 pb-4 text-center">
      <p className="text-[13px] font-bold text-ink-mid">
        {shown >= total
          ? `${name}님의 공개 브리핑 ${shown}건`
          : `${name}님의 공개 브리핑 ${total}건 중 ${shown}건`}
      </p>
      {showFollowHint && (
        <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
          팔로우하면 새 공개 브리핑이 내 피드에 표시돼요.
        </p>
      )}
    </div>
  );
}

/**
 * 스탯 줄 — 브리핑(공개)·팔로워·팔로잉. 목업의 "보관"은 스크랩 카운트 API 가 없어 넣지 않는다.
 *
 * 목업은 팔로워·팔로잉을 눌러 목록 모달을 열지만 **목록 조회 API 가 없다**(FollowController 는
 * follow·unfollow·profile 셋뿐). 그래서 누를 수 있는 것처럼 보이지 않게 button·link·커서·hover 를
 * 두지 않고 수치만 표시한다 — 목록 API 가 생기면 그때 연다.
 *
 * 팔로워 수는 팔로우 토글의 **서버 확정값**을 그대로 반영한다(프론트에서 ±1 을 계산하지 않는다).
 */
function ProfileStats({
  profile,
  followerCount,
  onOpenList,
}: {
  profile: Profile;
  followerCount: number;
  onOpenList: (kind: FollowListKind) => void;
}) {
  const items: { label: string; value: number; kind: FollowListKind | null }[] = [
    { label: "브리핑", value: profile.publicCardCount, kind: null },
    { label: "팔로워", value: followerCount, kind: "followers" },
    { label: "팔로잉", value: profile.followingCount, kind: "following" },
  ];
  const base = "flex items-baseline";
  // .pstats — 목업은 위 구분선 + 24px 간격이고, 값 17px / 라벨 12px(값에서 5px 띄움)이다.
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
      {items.map((it) =>
        it.kind === null ? (
          // 브리핑 수는 목록 API 가 없다 → 목업에서도 클릭 대상이 아니다(눌리는 것처럼 보이지 않게).
          <div key={it.label} className={base}>
            <b className="text-[17px] font-bold text-foreground">{it.value}</b>
            <span className="ml-[5px] text-[12px] text-muted-foreground">{it.label}</span>
          </div>
        ) : (
          // .pstat.click — 목업의 hover 규칙(값에 밑줄, offset 3px)을 그대로 쓴다.
          <button
            key={it.label}
            type="button"
            onClick={() => onOpenList(it.kind as FollowListKind)}
            aria-haspopup="dialog"
            className={`focus-ring group rounded-[6px] ${base}`}
          >
            <b className="text-[17px] font-bold text-foreground underline-offset-[3px] group-hover:underline">
              {it.value}
            </b>
            <span className="ml-[5px] text-[12px] text-muted-foreground">{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

/**
 * 팔로우/팔로잉 토글 — 게스트 클릭은 가입 유도 모달(requireAuth).
 * 토글 로직은 모달 행과 **같은 훅**(useFollowToggle)이다 — 응답이 확정값이라 그대로 상위 상태에
 * 반영하고(낙관적 갱신 아님), 같은 tick 연타는 훅의 ref 락이 막는다.
 * 팔로워 수는 스탯 줄이 보여주므로 버튼 아래에 다시 적지 않는다.
 */
function FollowButton({
  publicId,
  state,
  onChange,
}: {
  publicId: string;
  state: FollowData;
  onChange: (next: FollowData) => void;
}) {
  const { requireAuth } = useRequireAuth();
  const { busy, failed, toggle } = useFollowToggle({
    publicId,
    following: state.following,
    onChange,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={state.following ? "outline" : "default"}
        className="h-8 px-3 text-[12.5px]"
        onClick={() => requireAuth(toggle)}
        disabled={busy}
        aria-busy={busy}
      >
        {state.following ? "팔로잉" : "팔로우"}
      </Button>
      <span
        role="status"
        aria-live="polite"
        className={`text-[11.5px] ${failed ? "text-ink-mid" : "sr-only"}`}
      >
        {failed ? "잠시 후 다시 시도해 주세요" : ""}
      </span>
    </div>
  );
}

function formatJoined(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return JOINED_FORMAT.format(new Date(ts));
}
