"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/ui/page-state";
import { StateView } from "@/components/ui/state-view";
import { WikiDocumentPanel } from "@/components/wiki/wiki-document-panel";
import {
  WikiForceGraph,
  WikiGraphControlPanel,
  useWikiGraphControls,
  type WikiGraphControls,
} from "@/components/wiki/wiki-force-graph";
import { WikiResetConfirmModal } from "@/components/wiki/wiki-reset-confirm-modal";
import { useWikiDocumentDetail } from "@/hooks/use-wiki-document-detail";
import { useWikiBuildStatus, type WikiBuildStatusState } from "@/hooks/use-wiki-build-status";
import { useWikiGraph, type WikiGraphState } from "@/hooks/use-wiki-graph";
import { ERROR_CODES, resolveErrorMessage, type ErrorCode } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";
import { resetWiki } from "@/lib/repositories/wiki";

const WIKI_MENU_LABEL = "관심사 · LLM Wiki";

/** 인증 상태를 확인한 뒤 사용자용 LLM Wiki Graph 화면을 노출한다. */
export function LlmWikiScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <LlmWikiSkeleton />;
  if (status === "error") return <LlmWikiAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <LlmWikiAccessRestricted />;
  return <LlmWikiView />;
}

/** URL을 바꾸지 않는 로컬 Node 선택 상태로 Graph와 문서 패널을 조합한다. */
function LlmWikiView() {
  const searchParams = useSearchParams();
  const initialDocumentId = searchParams.get("document")?.trim() || null;
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(initialDocumentId);
  const [detailRevealRequest, setDetailRevealRequest] = useState(0);
  const graph = useWikiGraph();
  // 검색·필터 상태는 여기 한 곳에만 있다 — 조작 카드(오른쪽 레일)와 그래프(중앙)가 같은 값을 본다.
  const graphControls = useWikiGraphControls();
  const buildStatus = useWikiBuildStatus(graph.refetch);
  const detail = useWikiDocumentDetail(selectedDocumentId);
  const [addOpen, setAddOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<
    | {
        status: "success";
        deletedSourceDocumentCount: number;
        deletedSourceVersionCount: number;
      }
    | { status: "error"; errorCode: ErrorCode }
    | null
  >(null);
  const resetLock = useRef(false);
  const resetFeedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (resetResult?.status === "success") resetFeedbackRef.current?.focus();
  }, [resetResult]);

  function selectDocument(documentId: string, options: { revealDetail?: boolean } = {}) {
    setSelectedDocumentId(documentId);
    if (options.revealDetail) setDetailRevealRequest((request) => request + 1);
  }

  async function resetPersonalWiki() {
    if (resetLock.current || graph.status !== "success") return;
    resetLock.current = true;
    setResetting(true);
    setResetResult(null);
    try {
      const result = await resetWiki();
      setResetConfirmOpen(false);
      setSelectedDocumentId(null);
      setResetResult({
        status: "success",
        deletedSourceDocumentCount: result.deletedSourceDocumentCount,
        deletedSourceVersionCount: result.deletedSourceVersionCount,
      });
      graph.refetch();
      void buildStatus.refetch();
    } catch (error) {
      setResetConfirmOpen(false);
      setResetResult({
        status: "error",
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL_ERROR,
      });
    } finally {
      resetLock.current = false;
      setResetting(false);
    }
  }

  function refreshAfterMaterialSaved() {
    graph.refetch();
    void buildStatus.refetch();
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAddOpen(true)} />
      {/*
        <b>공통 3열 shell 을 그대로 쓴다(2026-08-13).</b> 기준 페이지는 홈(`home-screen`)과
        카드 상세(`card-detail-screen`) — 둘 다 `max-w-[1440px]` · `px-5 pt-6 pb-14` ·
        `gap-[22px]` · `items-start justify-center` 에 좌측 `SideLeft`(300px) · 우측 rail(300px,
        `sticky top-4`, `max-[1240px]:hidden`) 조합이다. Wiki 전용 수치를 따로 만들지 않았다.

        하나만 다르다: 여기 rail 은 **숨기지 않고 쌓는다**. 홈·상세의 rail 은 보조 정보라 좁은 폭에서
        감춰도 잃는 기능이 없지만, 이 rail 의 조작 카드는 검색·필터라 감추면 기능이 사라진다.
        그래서 같은 1240px 경계에서 `contents` 로 풀어 세로 흐름에 합류시킨다.
      */}
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current={WIKI_MENU_LABEL} footLines={MOCK_SIDE_FOOT} sticky={false} />

          <main className="w-full min-w-0 flex-1">
            {/*
              중앙 열 | 오른쪽 레일. <b>둘 다 이 행의 맨 위에서 시작한다</b> — 제목 영역이 중앙 열
              *안*에 있어야 오른쪽 레일이 제목 높이만큼 밀려 내려가지 않는다(2026-08-13 검수).
              음수 margin·translateY·absolute 보정 없이 열 구조만으로 맞춘다.

              <1240px 는 두 열을 모두 `contents` 로 풀어 하나의 세로 흐름으로 합치고 order 로 순서를
              잡는다: 제목(0) → 조작 카드(1) → 그래프(2) → 문서 상세(3). 조작 카드가 그래프를 덮지
              않는 건 데스크톱과 같고, 좁은 폭에서 3열을 억지로 유지해 그래프를 뭉개지도 않는다.
              레일은 선택과 무관하게 항상 자리를 지켜 그래프 폭이 오가지 않는다.
            */}
            <div className="flex flex-col gap-4 min-[1240px]:flex-row min-[1240px]:items-start min-[1240px]:gap-[22px]">
              {/* 중앙 열 — 제목·상태 안내·그래프 카드만 담는다. */}
              <div className="contents min-[1240px]:block min-[1240px]:min-w-0 min-[1240px]:flex-1">
                {/* Wiki 버전·초기화는 그래프 카드 우측 하단으로 내려갔다 — 제목 영역은 제목만 남긴다. */}
                <header className="mb-5">
                  <Link
                    href="/wiki"
                    className="focus-ring mb-2 inline-flex rounded-md text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    ← 관심사로 돌아가기
                  </Link>
                  <h1 className="text-[23px] font-bold tracking-[-0.02em] text-foreground">
                    나의 LLM Wiki
                  </h1>
                  <p className="mt-1 text-[13.5px] leading-[1.65] text-ink-mid">
                    노드를 움직이며 지식 연결을 탐색하고, 선택한 Wiki 문서와 생성 근거를 확인하세요.
                  </p>
                </header>

                {resetResult && (
                  <p
                    ref={resetFeedbackRef}
                    role={resetResult.status === "error" ? "alert" : "status"}
                    aria-live={resetResult.status === "error" ? "assertive" : "polite"}
                    aria-atomic="true"
                    tabIndex={resetResult.status === "success" ? -1 : undefined}
                    className={`mb-3 text-right text-[12px] ${
                      resetResult.status === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {resetResult.status === "error"
                      ? `Wiki를 초기화하지 못했어요. ${resolveErrorMessage(resetResult.errorCode)}`
                      : `원본 자료 ${resetResult.deletedSourceDocumentCount}개와 Version ${resetResult.deletedSourceVersionCount}개를 영구 삭제하고 Wiki를 초기화했어요.`}
                  </p>
                )}

                <WikiBuildStatusBanner state={buildStatus} />

                {/* <1240px 에서 조작 카드(order-1) 아래로 내려가야 하므로 order 를 갖는 래퍼가 필요하다. */}
                <div className="order-2 min-[1240px]:order-none">
                  <GraphContent
                    state={graph}
                    controls={graphControls}
                    selectedDocumentId={selectedDocumentId}
                    onSelect={selectDocument}
                    onClearSelection={() => setSelectedDocumentId(null)}
                    bottomRight={
                      graph.status === "success" ? (
                        <>
                          {graph.data.wikiVersion !== null && (
                            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground shadow-sm">
                              Wiki v{graph.data.wikiVersion}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={resetting}
                            onClick={() => {
                              setResetResult(null);
                              setResetConfirmOpen(true);
                            }}
                          >
                            {resetting ? "초기화 중…" : "Wiki 초기화"}
                          </Button>
                        </>
                      ) : undefined
                    }
                  />
                </div>
              </div>

              {graph.status === "success" && (
                <div className="contents min-[1240px]:order-2 min-[1240px]:sticky min-[1240px]:top-4 min-[1240px]:flex min-[1240px]:h-[652px] min-[1240px]:w-[300px] min-[1240px]:shrink-0 min-[1240px]:flex-col min-[1240px]:gap-3.5">
                  {/*
                    좁은 화면에서만 order 로 그래프(2) 위로 올린다. 레일이 살아나는 ≥1240px 에서는
                    order 를 풀어야 한다 — 상세의 `order-none`(=0)이 조작 카드의 `order-1` 보다
                    앞서서 상세가 위로 올라가 버린다(2026-08-13 검수에서 실제로 뒤집혔다).
                  */}
                  <div className="order-1 min-[1240px]:order-none">
                    <WikiGraphControlPanel controls={graphControls} />
                  </div>
                  <WikiDocumentPanel
                    selectedDocumentId={selectedDocumentId}
                    revealRequest={detailRevealRequest}
                    state={detail}
                    onSelect={selectDocument}
                    onClear={() => setSelectedDocumentId(null)}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <AddMaterialModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refreshAfterMaterialSaved}
      />
      <WikiResetConfirmModal
        open={resetConfirmOpen}
        pending={resetting}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={() => void resetPersonalWiki()}
      />
    </div>
  );
}

function WikiBuildStatusBanner({ state }: { state: WikiBuildStatusState }) {
  if (state.status !== "ready") return null;

  if (state.data.status === "BUILDING") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-foreground"
      >
        <Orb size={22} className="shrink-0 motion-safe:animate-spin [animation-duration:3s]" />
        <div>
          <p className="text-[13.5px] font-semibold">LLM Wiki를 빌드하고 있어요</p>
          <p className="mt-0.5 text-[12px] leading-[1.55] text-muted-foreground">
            저장한 자료를 분석해 지식 연결을 업데이트하고 있어요. 완료되면 자동으로 반영돼요.
          </p>
        </div>
      </div>
    );
  }

  if (state.data.status === "FAILED") {
    return (
      <div
        role="alert"
        className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-foreground"
      >
        <IconAlert className="shrink-0 text-destructive" />
        <div>
          <p className="text-[13.5px] font-semibold">최근 LLM Wiki 빌드를 완료하지 못했어요</p>
          <p className="mt-0.5 text-[12px] leading-[1.55] text-muted-foreground">
            잠시 후 자료를 다시 저장하거나 페이지를 새로고침해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function GraphContent({
  state,
  controls,
  selectedDocumentId,
  onSelect,
  onClearSelection,
  bottomRight,
}: {
  state: WikiGraphState & { refetch: () => void };
  controls: WikiGraphControls;
  selectedDocumentId: string | null;
  onSelect: (documentId: string, options?: { revealDetail?: boolean }) => void;
  onClearSelection: () => void;
  bottomRight?: ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div className="rounded-[18px] border border-border bg-card p-5" aria-hidden="true">
        <FeedSkeleton />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[520px] rounded-[18px] border border-border bg-card"
        icon={<IconAlert />}
        title="LLM Wiki를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        errorCode={state.errorCode}
        actions={[{ label: "다시 시도", onClick: state.refetch, variant: "primary" }]}
      />
    );
  }
  if (state.status === "empty") {
    return (
      <StateView
        className="min-h-[520px] rounded-[18px] border border-border bg-card"
        icon={<IconEmptyDoc />}
        title="아직 만들어진 LLM Wiki가 없어요"
        description="관심 자료를 저장하면 AI가 Entity와 Concept을 정리해 연결해요."
        actions={[{ label: "관심사로 돌아가기", href: "/wiki", variant: "primary" }]}
      />
    );
  }

  /*
    <b>테두리는 외곽 카드가 그린다(2026-08-13 최종).</b>
      ① 바깥 카드 = radius 18 + `border-border` 1px + `shadow-sm` + 배경. **기존 카드 디자인 그대로다.**
      ② 안쪽 surface = 배경·SVG clipping 전용. border 안쪽(radius 17 = 18 − 1px)에서만 자르므로
         SVG 와 흰 배경이 외곽 테두리 위를 덮지 않고, 모서리에 흰 틈도 생기지 않는다.
    한때 테두리를 `absolute inset-0` overlay 로 맨 위에 얹어 봤는데, 카드에서 border 를 떼어 내는
    구조라 테두리 효과가 달라 보였다 → 되돌렸다. 테두리를 그리는 곳은 ① 한 군데뿐이라 2px 로
    겹치지 않고, 그래프 위에 덮이는 레이어가 없으니 drag·zoom 도 막지 않는다.
  */
  return (
    <div className="rounded-[18px] border border-border bg-card shadow-sm">
      <div className="relative min-h-[650px] overflow-hidden rounded-[17px]">
        <WikiForceGraph
          graph={state.data}
          controls={controls}
          selectedDocumentId={selectedDocumentId}
          onSelect={onSelect}
          onClear={onClearSelection}
          bottomRight={bottomRight}
        />
      </div>
    </div>
  );
}

function LlmWikiSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <main className="mx-auto max-w-[1080px] px-5 py-8" aria-hidden="true">
        <FeedSkeleton />
      </main>
    </div>
  );
}

function LlmWikiAuthError({ onRetry }: { onRetry: () => void }) {
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
          { label: "관심사로", href: "/wiki", variant: "ghost" },
        ]}
      />
    </div>
  );
}

function LlmWikiAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="LLM Wiki는 내 자료에서 만든 개인 지식 공간이에요. 로그인 후 확인해 주세요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
