"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { IconAlert } from "@/components/ui/state-icons";
import { PageState } from "@/components/ui/page-state";
import { LlmWikiEntry } from "@/components/wiki/llm-wiki-entry";
import { WikiFound } from "@/components/wiki/wiki-found";
import { WikiMind } from "@/components/wiki/wiki-mind";
import { WikiMyInterests } from "@/components/wiki/wiki-my-interests";
import { WikiRecentSaves, useRecentSaves } from "@/components/wiki/wiki-recent-saves";
import { useInterestTaxonomy } from "@/hooks/use-interest-taxonomy";
import { useMyInterests, type MyInterestsState } from "@/hooks/use-my-interests";
import { useWikiInterests, type WikiInterestsState } from "@/hooks/use-wiki-interests";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";

const WIKI_MENU_LABEL = "관심사 · LLM Wiki";

/**
 * "이번 주 신규" 계산 기준 시각 — 렌더 중 Date.now() 호출은 react 컴파일러 규칙 위반이라
 * 모듈 로드 시점에 한 번만 고정한다(주 단위 판정이라 페이지 수명 동안의 오차는 무시 가능).
 */
const LOADED_AT_MS = Date.now();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 관심사 · LLM Wiki — member 전용 화면(§15 개인 데이터). 인증 상태 4분기로 진입을 제어한다.
 * - loading      → 중립 스켈레톤(개인 정보·guest CTA 노출 없음)
 * - error        → 인증 복원 오류 + 재시도
 * - guest        → 접근 제한 안내 + 로그인 CTA(개인 데이터 미노출)
 * - authenticated→ 본문(WikiView)
 */
export function WikiScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <WikiSkeleton />;
  if (status === "error") return <WikiAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <WikiAccessRestricted />;
  return <WikiView />;
}

/**
 * 실제 본문 — authenticated 에서만 도달. 목업 wiki.html 순서(2026-08-05 정렬):
 * ① AI가 이해한 지금의 나(강도 바) ② AI가 최근 발견한 관심사(＋추가)
 * ③ 내 관심사(USER 목록 관리) ④ 나의 LLM Wiki 진입 카드.
 * 발견 후보 추가/삭제는 [내 관심사]만 다시 읽는다(위키 태그는 영향 없음 — 불필요한 재조회 금지).
 */
function WikiView() {
  const taxonomy = useInterestTaxonomy();
  const interests = useWikiInterests();
  const my = useMyInterests();
  const recentSaves = useRecentSaves();
  const [amOpen, setAmOpen] = useState(false);

  const wikiTags = interests.status === "success" ? interests.data : null;
  const myInterests = my.status === "success" ? my.data : null;

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current={WIKI_MENU_LABEL} footLines={MOCK_SIDE_FOOT} />

          <main className="min-w-0 max-w-[760px] flex-1">
            <header className="mb-8">
              <h1 className="text-[22px] font-bold tracking-[-0.015em] text-foreground">
                관심사 · LLM Wiki
              </h1>
              <p className="mt-1 text-[13.5px] leading-[1.6] text-ink-mid">
                AI가 나를 어떻게 이해하고 있는지 확인하고, 다르게 이해한 부분은 직접 고쳐주세요.
              </p>
            </header>

            <WikiMind
              taxonomy={taxonomy}
              tags={interests}
              myInterests={myInterests}
              onChanged={my.refetch}
            />
            <WikiFound tags={interests} myInterests={myInterests} onAdded={my.refetch} />
            <WikiMyInterests state={my} wikiTags={wikiTags} onChanged={my.refetch} />
            {/* 저장 확인 스트립(08-11 우석) — 위키 반영 전에도 "저장 자체"가 여기 즉시 보인다. */}
            <WikiRecentSaves state={recentSaves} />
            <LlmWikiEntry />
          </main>

          <WikiRail interests={interests} my={my} />
        </div>
      </div>

      {/* 저장 성공 시 위키 관심사 + 최근 저장 스트립을 재조회한다 — 방금 넣은 자료가 즉시 보인다. */}
      <AddMaterialModal
        open={amOpen}
        onClose={() => setAmOpen(false)}
        onSaved={() => {
          interests.refetch();
          recentSaves.refetch();
        }}
      />
    </div>
  );
}

/**
 * 우측 레일 — 목업 "추론 요약" 패널. 파생 가능한 수치만 표시한다
 * (목업의 활성/비활성·제외한 주제는 대응 백엔드가 없어 만들지 않는다).
 * "이번 주 신규" = 내 관심사 createdAt 이 최근 7일 이내인 것(클라이언트 계산).
 */
function WikiRail({
  interests,
  my,
}: {
  interests: WikiInterestsState;
  my: MyInterestsState;
}) {
  const myCount = my.status === "success" ? my.data.length : null;
  const newThisWeek =
    my.status === "success"
      ? my.data.filter((interest) => {
          const ts = Date.parse(interest.createdAt);
          return Number.isFinite(ts) && LOADED_AT_MS - ts <= WEEK_MS;
        }).length
      : null;
  const inferredCount =
    interests.status === "success" ? interests.data.length : interests.status === "empty" ? 0 : null;
  return (
    <aside className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden">
      <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
        <h4 className="mb-[15px] text-[13px] font-bold text-foreground">추론 요약</h4>
        <RailStat label="내 관심사" value={myCount} />
        <RailStat label="AI 추론 관심사" value={inferredCount} />
        <RailStat label="이번 주 신규" value={newThisWeek} />
      </div>
    </aside>
  );
}

function RailStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between border-t border-border py-2 text-[12.5px] text-ink-mid first:border-t-0 first:pt-px">
      <span>{label}</span>
      <b className="font-bold text-foreground">{value ?? "—"}</b>
    </div>
  );
}

/** 인증 복원 중 — 중립 스켈레톤(개인 정보·CTA 없음). HomeNav 는 loading 상태라 로고만 렌더한다. */
function WikiSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1" aria-hidden="true">
            <FeedSkeleton />
          </main>
        </div>
      </div>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공. member 화면을 대체 노출하지 않는다. */
function WikiAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        icon={<IconAlert />}
        title="인증 상태를 확인하지 못했어요"
        description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
        actions={[
          { label: "다시 시도", onClick: onRetry, variant: "primary" },
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}

/** guest 접근 — 개인 데이터라 본문 대신 접근 제한만 안내한다(§15). 로그인 경로 제공. */
function WikiAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="관심사 · LLM Wiki 는 로그인한 사용자만 볼 수 있어요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
