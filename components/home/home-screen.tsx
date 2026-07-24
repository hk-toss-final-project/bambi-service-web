"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedMine } from "@/components/home/feed-mine";
import { FeedRec } from "@/components/home/feed-rec";
import { GuestSignupPanel } from "@/components/home/guest-signup-panel";
import { HomeNav } from "@/components/home/home-nav";
import { MemberFeed } from "@/components/home/member-feed";
import { SideLeft } from "@/components/home/side-left";
import { SideRight } from "@/components/home/side-right";
import { useMemberFeed } from "@/hooks/use-member-feed";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";

type HomeTab = "mine" | "rec";

/**
 * 홈 화면 — 인증 상태별로 명확히 분기(§15). 상세(report-screen)와 동일한 4분기.
 *
 * - loading      → 중립 스켈레톤(피드 문구·CTA·개인 정보 없음). 로그인 새로고침 시 guest 홈이 한 프레임도 안 뜨게.
 * - guest        → guest 홈([피드] 단일 탭·아이콘 내비·가입 유도 패널)
 * - authenticated→ member 홈([내 보고서]/[피드] 2탭·개인 사이드 레일)
 * - error        → 인증 복원 오류 UI + 재시도
 */
export function HomeScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <HomeSkeleton />;
  if (status === "error") return <HomeAuthError onRetry={refreshAuth} />;

  return <HomeView isMember={status === "authenticated"} />;
}

/** 실제 홈 렌더 — member/guest 만 도달(loading·error 는 상위에서 처리). */
function HomeView({ isMember }: { isMember: boolean }) {
  const [tab, setTab] = useState<HomeTab>("rec"); // 기본: 피드
  const [amOpen, setAmOpen] = useState(false);
  // member [피드] 탭 데이터를 HomeView 가 소유한다 → 저장 성공 시 refetch 를 저장 모달과 공유(§4).
  // guest 는 useMemberFeed 내부 enabled=false 라 /api/feed 를 호출하지 않는다.
  const memberFeed = useMemberFeed();

  return (
    <div className="min-h-screen bg-background">
      {/* nav — 풀블리드(배경·보더 전체 폭), 내부는 1440 정렬 */}
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      {/* .app — 콘텐츠 영역만 1440 중앙 정렬 */}
      <div className="mx-auto max-w-[1440px]">
        {/* .shell */}
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current="홈" footLines={MOCK_SIDE_FOOT} guest={!isMember} />

          {/* .feed */}
          <main className="min-w-0 max-w-[760px] flex-1">
            {/* .tabs — member 는 2탭, guest 는 피드 단일 탭 */}
            <div
              role="tablist"
              aria-label="홈 피드 전환"
              className="sticky top-4 z-20 mb-4 flex overflow-hidden rounded-[14px] border border-border bg-card"
            >
              {isMember && (
                <TabButton id="mine" active={tab === "mine"} onSelect={() => setTab("mine")}>
                  내 보고서
                </TabButton>
              )}
              <TabButton id="rec" active={!isMember || tab === "rec"} onSelect={() => setTab("rec")}>
                피드
              </TabButton>
            </div>

            <div role="tabpanel" id="panel-rec" aria-labelledby="tab-rec" hidden={isMember && tab !== "rec"}>
              {/* guest → 공개 mock 피드 유지 / member → GET /api/feed 실 데이터. */}
              {isMember ? <MemberFeed feed={memberFeed} /> : <FeedRec guest />}
            </div>
            {/* FeedMine — 개인 데이터라 member 에서만 렌더 */}
            {isMember && (
              <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" hidden={tab !== "mine"}>
                <FeedMine />
              </div>
            )}
          </main>

          {/* 우측 레일 — member 는 핵심 신호·추천 토픽, guest 는 가입 유도 패널 */}
          {isMember ? <SideRight /> : <GuestSignupPanel />}
        </div>
      </div>

      {/* 저장 성공 시 member 피드를 재조회해 새 카드를 즉시 반영(§4 refetch). guest 는 모달이 열리지 않는다. */}
      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} onSaved={memberFeed.refetch} />
    </div>
  );
}

/**
 * 인증 복원 중 — 중립 스켈레톤. 전체 3열 구조만 유지하고 콘텐츠는 회색 placeholder.
 * 포함 금지: 실제 피드 제목·작성자·본문 / 로그인·가입 CTA / 가입 유도 패널 / 개인 정보·수치 / 실제 액션.
 */
function HomeSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="min-h-screen bg-background">
      {/* nav — loading 상태라 HomeNav 는 로고만(우측 CTA·아바타 없음) */}
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14" aria-hidden="true">
          {/* 좌측 내비 placeholder */}
          <aside className="sticky top-4 w-[300px] shrink-0 max-[1100px]:hidden">
            <div className="animate-pulse rounded-[14px] border border-border bg-card p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mb-px flex items-center gap-3 px-3 py-[11px]">
                  <div className={`h-5 w-5 shrink-0 rounded ${bar}`} />
                  <div className={`h-3.5 w-24 ${bar}`} />
                </div>
              ))}
            </div>
          </aside>

          {/* 피드 placeholder */}
          <main className="min-w-0 max-w-[760px] flex-1">
            <div className="mb-4 flex overflow-hidden rounded-[14px] border border-border bg-card">
              <div className="flex-1 py-[15px] text-center">
                <div className={`mx-auto h-4 w-16 ${bar}`} />
              </div>
            </div>
            <div className="animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mb-4 overflow-hidden rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-4">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className={`h-[38px] w-[38px] shrink-0 rounded-full ${bar}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`mb-1.5 h-3.5 w-[45%] max-w-40 ${bar}`} />
                      <div className={`h-3 w-[30%] max-w-28 ${bar}`} />
                    </div>
                  </div>
                  {/* 본문 placeholder — 아바타(48px) 기준 들여쓰기는 래퍼(ml-12)에만, 바 너비는 래퍼 기준 % */}
                  <div className="ml-12 max-w-full">
                    <div className={`mb-2 h-5 w-[85%] ${bar}`} />
                    <div className={`mb-2 h-4 w-full ${bar}`} />
                    <div className={`mb-3 h-4 w-[65%] ${bar}`} />
                    {i === 0 && <div className={`mb-1 h-[180px] w-full ${bar}`} />}
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* 우측 레일 placeholder */}
          <aside className="sticky top-4 w-[300px] shrink-0 max-[1240px]:hidden">
            <div className="animate-pulse rounded-[14px] border border-border bg-card px-4 py-[15px]">
              <div className={`mb-4 h-4 w-28 ${bar}`} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mb-3 flex gap-2.5 last:mb-0">
                  <div className={`h-4 w-5 shrink-0 ${bar}`} />
                  <div className="flex-1">
                    <div className={`mb-1 h-3.5 w-full ${bar}`} />
                    <div className={`h-3 w-20 ${bar}`} />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공. guest/member 화면으로 대체하지 않는다. */
function HomeAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <div
          role="alert"
          className="w-[420px] max-w-full rounded-2xl border border-border bg-card px-6 py-[30px] text-center"
        >
          <div className="mx-auto mb-3.5 h-11 w-11">
            <Orb size={44} />
          </div>
          <div className="text-lg font-bold tracking-[-0.01em] text-foreground">
            인증 상태를 확인하지 못했어요
          </div>
          <p className="mt-2 text-[13px] leading-[1.65] text-ink-mid">
            네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring flex h-[46px] w-full items-center justify-center rounded-[10px] border border-primary bg-primary text-[14.5px] font-semibold text-primary-foreground hover:brightness-[.96]"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** .tab — 활성 시 .tl::after 언더라인(시그널 4px 라운드 바) */
function TabButton({
  id,
  active,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={`panel-${id}`}
      onClick={onSelect}
      className={`focus-ring flex-1 rounded-[6px] text-center text-[14.5px] font-semibold ${
        active ? "text-foreground" : "text-muted-foreground hover:text-ink-mid"
      }`}
    >
      <span
        className={`relative inline-block py-[15px] ${
          active
            ? "after:absolute after:-right-[11px] after:bottom-0 after:-left-[11px] after:h-1 after:rounded-full after:bg-primary after:content-['']"
            : ""
        }`}
      >
        {children}
      </span>
    </button>
  );
}
