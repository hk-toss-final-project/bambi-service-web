"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { EmptyMyReports } from "@/components/home/empty-my-reports";
import { FailedReports } from "@/components/home/failed-reports";
import { FeedRec } from "@/components/home/feed-rec";
import { GuestSignupPanel } from "@/components/home/guest-signup-panel";
import { HomeNav } from "@/components/home/home-nav";
import { MemberFeed } from "@/components/home/member-feed";
import { PreparingReports } from "@/components/home/preparing-reports";
import { SideLeft } from "@/components/home/side-left";
import { SideRight } from "@/components/home/side-right";
import { useMemberFeed } from "@/hooks/use-member-feed";
import { useMyReportJobs } from "@/hooks/use-my-report-jobs";
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
  // 원시 tab 은 member 의 선택만 담는다(기본 = 내 보고서). guest 는 [내 보고서] 탭이 없으므로
  // 유효 탭을 항상 "rec"(공개 피드)로 강제한다 → effectiveTab 하나를 aria-selected·hidden·렌더 분기에
  // 공통 사용해 "선택된 탭 = 표시되는 패널"이 항상 일치한다. member↔guest 전환 동기화 effect 불필요.
  const [tab, setTab] = useState<HomeTab>("mine");
  const [amOpen, setAmOpen] = useState(false);
  // member [내 보고서] 탭 데이터를 HomeView 가 소유한다 → 저장 성공 시 refetch 를 저장 모달과 공유(§4).
  // guest 는 useMemberFeed / useMyReportJobs 내부 enabled=false 라 API 를 호출하지 않는다.
  const memberFeed = useMemberFeed();
  // 생성 작업(PREPARING·ERROR)은 READY 목록과 별개 소스지만 한 번만 조회해 status 로 나눈다(중복 fetch 없음).
  const reportJobs = useMyReportJobs();
  const preparing = reportJobs.status === "ready" ? reportJobs.preparing : [];
  const failed = reportJobs.status === "ready" ? reportJobs.failed : [];
  // READY 목록이 비었을 때 그 자리에 무엇을 넣을지(READY 가 0건인지는 MemberFeed 가 자신의 status==="empty" 로 판단):
  //  - 작업 조회 성공 + PREPARING·ERROR 0건 → 완전 Empty 온보딩
  //  - PREPARING·ERROR 가 있음            → null (위 슬롯/카드로 충분하니 아무것도 안 그린다)
  //  - 작업 조회 중                        → null (Empty 문구가 먼저 깜빡이지 않게 비워 둔다)
  //  - 작업 조회 실패                      → undefined → MemberFeed 기본 Empty.
  //    PREPARING·ERROR 유무를 알 수 없는 상태라 "받은 보고서가 없어요" 온보딩을 단정하지 않는다.
  const myReportsEmptyState =
    reportJobs.status === "ready"
      ? preparing.length === 0 && failed.length === 0
        ? <EmptyMyReports onAddMaterial={() => setAmOpen(true)} />
        : null
      : reportJobs.status === "loading"
        ? null
        : undefined;
  const effectiveTab: HomeTab = isMember ? tab : "rec";

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
                <TabButton id="mine" active={effectiveTab === "mine"} onSelect={() => setTab("mine")}>
                  내 보고서
                </TabButton>
              )}
              <TabButton id="rec" active={effectiveTab === "rec"} onSelect={() => setTab("rec")}>
                피드
              </TabButton>
            </div>

            {/* [내 보고서] — 개인 데이터(GET /api/feed)라 member 에서만 렌더. tab 순서(내 보고서→피드)와 DOM 순서 일치. */}
            {isMember && (
              <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" hidden={effectiveTab !== "mine"}>
                {/* 전체 보기(/reports) 진입 헤더 — READY 목록이 있을 때만 노출한다.
                    완전 Empty 는 온보딩 카드(EmptyMyReports)가 CTA 를 이미 제공하므로 빈 아카이브로
                    보내는 링크를 겹치지 않고, loading 은 스켈레톤이 콘텐츠 전체를 대체해 시프트가 없다. */}
                {memberFeed.status === "success" && (
                  <div className="mb-3 flex items-baseline justify-between px-0.5">
                    <span className="text-[13px] font-bold text-ink-mid">내 보고서</span>
                    <Link
                      href="/reports"
                      className="focus-ring rounded-[6px] text-[12.5px] font-semibold text-signal-ink hover:underline"
                    >
                      전체 보기 →
                    </Link>
                  </div>
                )}
                {/* 내 보고서 = PREPARING(처리중) → ERROR(생성 실패) → READY(완료 카드) 순. 각 섹션은 해당 상태가 있을 때만 렌더. */}
                <PreparingReports reports={preparing} />
                <FailedReports reports={failed} />
                <MemberFeed feed={memberFeed} emptyState={myReportsEmptyState} />
              </div>
            )}
            {/* [피드] — 공개 피드 실데이터. 하나의 목록에 팔로잉·추천 카드가 섞여 있고(로그인),
                게스트는 전체 공개 카드만 본다. 내부 탭·chip 은 없다 — 혼합은 훅·순수 함수가 한다.
                카드가 렌더하는 값은 전부 공개 데이터다. */}
            <div role="tabpanel" id="panel-rec" aria-labelledby="tab-rec" hidden={effectiveTab !== "rec"}>
              <FeedRec />
            </div>
          </main>

          {/* 우측 레일 — member 는 내 보고서 현황·최근 보고서, guest 는 가입 유도 패널.
              rail 은 위 [내 보고서] 탭과 **같은 memberFeed 상태를 공유**한다(GET /api/feed 중복 호출 없음). */}
          {isMember ? <SideRight feed={memberFeed} /> : <GuestSignupPanel />}
        </div>
      </div>

      {/* 저장 성공 시 member 내 보고서 목록을 재조회해 새 카드를 즉시 반영(§4 refetch). guest 는 모달이 열리지 않는다. */}
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
      // 포커스 링: 공통 .focus-ring(outline 2px + offset 2px)은 tablist 의 overflow-hidden 에 바깥이 잘려
      // 두 탭 사이 세로선처럼 보인다. 공통 클래스는 그대로 쓰고(색·굵기·forced-colors 대응 유지) 이 홈 탭에서만
      // outline-offset 을 -2px 로 덮어써 링을 버튼 내부에 그린다 → 부모에 안 잘리고 포커스된 탭 전체를 감싼다.
      // (utilities 레이어가 components 의 .focus-ring 보다 뒤라 offset 만 override. 선택 탭 하단 밑줄은 span after 로 유지.)
      className={`focus-ring flex-1 rounded-[6px] text-center text-[14.5px] font-semibold focus-visible:[outline-offset:-2px] ${
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
