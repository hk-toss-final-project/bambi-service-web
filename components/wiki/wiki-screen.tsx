"use client";

import { useCallback, useState } from "react";

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
import {
  WikiRecentSaves,
  useRecentSaves,
  type RecentSavesState,
} from "@/components/wiki/wiki-recent-saves";
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
  /**
   * 이번 화면에서 방금 뺀 관심사 이름 (2026-08-11 우석 — "빼면 왼쪽으로 가야 한다").
   *
   * 관심사를 삭제하면 agent 컨텍스트가 재동기화되면서 **온보딩 선택에서 파생된 위키 태그도 함께
   * 사라진다** → 발견 후보(위키 태그 − 내 관심사)에도 안 잡혀서 화면에서 완전히 증발했다.
   * 되돌릴 방법이 "이름을 다시 타이핑"뿐이라 실수 한 번이 복구 불가였다.
   * 그래서 뺀 이름을 이 화면이 기억해 왼쪽 목록에 남긴다 — 다시 누르면 그대로 복구된다.
   * 저장하지 않는 세션 상태다(새로고침하면 사라진다). 서버가 태그를 계속 갖고 있는 관심사는
   * 어차피 후보로 다시 올라오므로 중복은 이름 기준으로 합친다.
   */
  const [removedNames, setRemovedNames] = useState<readonly string[]>([]);

  const wikiTags = interests.status === "success" ? interests.data : null;
  const myInterests = my.status === "success" ? my.data : null;

  /** 뺀 관심사를 기억하고 목록을 다시 읽는다. */
  const handleRemoved = useCallback(
    (name: string) => {
      setRemovedNames((current) =>
        current.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase())
          ? current
          : [...current, name],
      );
      my.refetch();
    },
    [my],
  );

  /**
   * 숨김 성공 — 서버(V27)에 저장됐으므로 위키 태그를 다시 읽으면 목록에서 빠진다.
   * 세션 기억(removedNames)에도 남아 있으면 계속 후보로 뜨므로 함께 지운다.
   */
  const handleHidden = useCallback(
    (name: string) => {
      setRemovedNames((current) =>
        current.filter((n) => n.trim().toLowerCase() !== name.trim().toLowerCase()),
      );
      interests.refetch();
    },
    [interests],
  );

  /** 되돌리기(재추가) 성공 — 기억에서 지우고 목록을 다시 읽는다. */
  const handleAdded = useCallback(
    (name: string) => {
      setRemovedNames((current) =>
        current.filter((n) => n.trim().toLowerCase() !== name.trim().toLowerCase()),
      );
      my.refetch();
    },
    [my],
  );

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

            {/* 읽기 전용 — 추가·삭제는 아래 2열 패널이 전담한다(2026-08-11 우석). */}
            <WikiMind taxonomy={taxonomy} tags={interests} myInterests={myInterests} />
            {/*
              발견 후보(왼쪽) ↔ 내 관심사(오른쪽) 2열 (2026-08-11 우석).
              추가하면 왼쪽에서 사라지고 오른쪽에 나타나므로 두 목록의 관계가 눈으로 읽힌다.
              좁은 화면(<900px)에서는 한 열로 쌓아 각 목록이 뭉개지지 않게 한다.
            */}
            <div className="mb-8 grid grid-cols-1 items-start gap-3 min-[900px]:grid-cols-2">
              <WikiFound
                tags={interests}
                myInterests={myInterests}
                removedNames={removedNames}
                onAdded={handleAdded}
                onHidden={handleHidden}
              />
              <WikiMyInterests state={my} wikiTags={wikiTags} onRemoved={handleRemoved} />
            </div>
            <LlmWikiEntry />
          </main>

          <WikiRail interests={interests} my={my} recentSaves={recentSaves} />
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
  recentSaves,
}: {
  interests: WikiInterestsState;
  my: MyInterestsState;
  recentSaves: RecentSavesState;
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
      {/*
        저장 확인(08-11 우석) — 본문 최상단에서 rail 로 옮겼다. 본문은 관심사 목록에 집중하고,
        비어 있던 rail 이 "방금 저장한 게 들어왔나"를 곁눈으로 확인하는 자리를 맡는다.
        저장 이력이 없으면 스스로 숨는다(rail 이 빈 박스로 남지 않는다).
      */}
      <WikiRecentSaves state={recentSaves} />
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
