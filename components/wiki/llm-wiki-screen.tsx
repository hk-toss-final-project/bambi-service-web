"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { PageState } from "@/components/ui/page-state";
import { StateView } from "@/components/ui/state-view";
import { WikiDocumentPanel } from "@/components/wiki/wiki-document-panel";
import { WikiForceGraph } from "@/components/wiki/wiki-force-graph";
import {
  useWikiDocumentDetail,
  type WikiDocumentDetailState,
} from "@/hooks/use-wiki-document-detail";
import { useWikiGraph, type WikiGraphState } from "@/hooks/use-wiki-graph";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";

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
  const detail = useWikiDocumentDetail(selectedDocumentId);
  const [addOpen, setAddOpen] = useState(false);

  function selectDocument(
    documentId: string,
    options: { revealDetail?: boolean } = {},
  ) {
    setSelectedDocumentId(documentId);
    if (options.revealDetail) setDetailRevealRequest((request) => request + 1);
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAddOpen(true)} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current={WIKI_MENU_LABEL} footLines={MOCK_SIDE_FOOT} />

          <main className="min-w-0 max-w-[1080px] flex-1">
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
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
              </div>
              {graph.status === "success" && graph.data.wikiVersion !== null && (
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  Wiki v{graph.data.wikiVersion}
                </span>
              )}
            </header>

            <GraphContent
              state={graph}
              selectedDocumentId={selectedDocumentId}
              detailRevealRequest={detailRevealRequest}
              detail={detail}
              onSelect={selectDocument}
              onClearSelection={() => setSelectedDocumentId(null)}
            />
          </main>
        </div>
      </div>

      <AddMaterialModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={graph.refetch}
      />
    </div>
  );
}

function GraphContent({
  state,
  selectedDocumentId,
  detailRevealRequest,
  detail,
  onSelect,
  onClearSelection,
}: {
  state: WikiGraphState & { refetch: () => void };
  selectedDocumentId: string | null;
  detailRevealRequest: number;
  detail: WikiDocumentDetailState & { refetch: () => void };
  onSelect: (documentId: string, options?: { revealDetail?: boolean }) => void;
  onClearSelection: () => void;
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

  return (
    <div
      className={
        selectedDocumentId === null
          ? "min-h-[650px]"
          : "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
      }
    >
      <div className="relative min-h-[650px] overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        <WikiForceGraph
          graph={state.data}
          selectedDocumentId={selectedDocumentId}
          onSelect={onSelect}
          onClear={onClearSelection}
        />
      </div>
      <WikiDocumentPanel
        selectedDocumentId={selectedDocumentId}
        revealRequest={detailRevealRequest}
        state={detail}
        onSelect={onSelect}
        onClear={onClearSelection}
      />
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
