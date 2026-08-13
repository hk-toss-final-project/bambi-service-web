"use client";

import { useEffect, useRef } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { WikiMarkdownViewer } from "@/components/wiki/wiki-markdown-viewer";
import type { WikiDocumentDetailState } from "@/hooks/use-wiki-document-detail";
import type {
  WikiDocumentDetail,
  WikiDocumentSource,
  WikiGraphNode,
} from "@/types/wiki";

/**
 * 상세를 그래프 오른쪽 레일로 세우는 폭. 이 아래에서는 그래프 밑에 전체 폭으로 쌓인다.
 * `llm-wiki-screen` 의 그래프|상세 분기(min-[1240px])와 **같은 값이어야 한다** —
 * 옆에 이미 보이는데도 스크롤을 하거나, 아래에 있는데 스크롤을 안 하는 어긋남이 생긴다.
 */
const SIDE_RAIL_MIN_WIDTH = 1240;

/** 선택한 Wiki Node를 Graph와 겹치지 않는 별도 패널에서 조회한다. */
export function WikiDocumentPanel({
  selectedDocumentId,
  revealRequest,
  state,
  onSelect,
  onClear,
}: {
  selectedDocumentId: string | null;
  revealRequest: number;
  state: WikiDocumentDetailState & { refetch: () => void };
  onSelect: (documentId: string) => void;
  onClear: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const handledRevealRequestRef = useRef(0);

  useEffect(() => {
    if (
      revealRequest === 0 ||
      handledRevealRequestRef.current >= revealRequest ||
      selectedDocumentId === null ||
      state.status === "idle"
    ) {
      return;
    }

    // 옆 레일로 열리는 폭에서는 이미 보이므로 스크롤하지 않는다(아래로 쌓일 때만 끌어온다).
    if (window.matchMedia(`(min-width: ${SIDE_RAIL_MIN_WIDTH}px)`).matches) {
      handledRevealRequestRef.current = revealRequest;
      return;
    }

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    const frame = window.requestAnimationFrame(() => {
      handledRevealRequestRef.current = revealRequest;
      panelRef.current?.scrollIntoView({ behavior, block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealRequest, selectedDocumentId, state.status]);

  /*
    선택이 없으면 **엘리먼트 자체를 만들지 않는다** — 상단 조작 카드만 남고, 빈 안내 패널을 두지 않는다.
    레일 자체는 상위가 항상 그리므로 이 카드가 사라져도 3열 구조와 조작 카드는 그대로다.

    카드 껍데기는 그래프 카드와 같은 규칙이다 — `<aside>` 가 radius·border·그림자를 맡고,
    안쪽 div 는 border 안쪽(radius 17 = 18 − 1px)에서만 본문을 자른다. 테두리를 그리는 곳이
    한 군데뿐이라 두 겹으로 겹치지 않는다.

    높이: ≥1240px 에서는 레일에 남은 높이를 채운다(`flex-1 min-h-0`) — 조작 카드는 위에서 고정이고
    긴 문서는 **이 카드 안쪽**(`WikiDocumentFile` 의 `overflow-y-auto`)에서만 스크롤된다.
    그보다 좁으면 그래프 아래 일반 블록이라 고정 650px 를 쓴다.
    `order-3` 은 좁은 화면에서 조작 카드(1) → 그래프(2) 다음 자리를 잡기 위한 것이다.
  */
  if (selectedDocumentId === null || state.status === "idle") return null;
  return (
    <aside
      ref={panelRef}
      className="order-3 flex w-full scroll-mt-4 flex-col rounded-[18px] border border-border bg-card shadow-sm min-[1240px]:order-none min-[1240px]:min-h-0 min-[1240px]:flex-1"
    >
      <div className="flex h-[650px] flex-col overflow-hidden rounded-[17px] min-[1240px]:h-auto min-[1240px]:min-h-0 min-[1240px]:flex-1">
        {state.status === "loading" ? (
          <div className="p-5" aria-hidden="true">
            <FeedSkeleton />
          </div>
        ) : state.status === "error" ? (
          <StateView
            role="alert"
            className="min-h-[420px]"
            icon={<IconAlert />}
            title="노드 상세를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            errorCode={state.errorCode}
            actions={[
              { label: "다시 시도", onClick: state.refetch, variant: "primary" },
              { label: "닫기", onClick: onClear, variant: "ghost" },
            ]}
          />
        ) : state.status === "notFound" ? (
          <StateView
            className="min-h-[420px]"
            icon={<IconEmptyDoc />}
            title="이 Wiki 노드를 찾을 수 없어요"
            description="삭제됐거나 더 이상 현재 Wiki에 포함되지 않은 노드예요."
            actions={[{ label: "닫기", onClick: onClear, variant: "ghost" }]}
          />
        ) : (
          <WikiDocumentFile document={state.document} onSelect={onSelect} onClear={onClear} />
        )}
      </div>
    </aside>
  );
}

function WikiDocumentFile({
  document,
  onSelect,
  onClear,
}: {
  document: WikiDocumentDetail;
  onSelect: (documentId: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <header className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <KindBadge kind={document.documentKind} />
              <span className="text-[10.5px] text-muted-foreground">v{document.version}</span>
              {document.domain !== null && (
                <span className="text-[10.5px] text-muted-foreground">{document.domain}</span>
              )}
            </div>
            <h2 className="text-[18px] leading-[1.35] font-bold tracking-[-0.015em] text-foreground">
              {document.title}
            </h2>
            <div className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">
              {document.filePath} · 출처 {document.sourceCount}개
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Wiki 문서 닫기"
          >
            ×
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {document.summary !== null && (
          <section className="border-b border-border bg-background/50 px-5 py-4">
            <div className="mb-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Summary
            </div>
            <p className="text-[12.5px] leading-[1.7] text-ink-mid">{document.summary}</p>
          </section>
        )}

        <section aria-label="Wiki Markdown 문서" className="px-5 py-5">
          <WikiMarkdownViewer source={document.markdown} />
        </section>

        <div className="space-y-6 border-t border-border px-5 py-5">
          <WikiSources sources={document.sources} />
          {document.relations.length > 0 && (
            <section aria-labelledby="wiki-relations-title">
              <h3
                id="wiki-relations-title"
                className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
              >
                Connections
              </h3>
              <div className="flex flex-col gap-2">
                {document.relations.map((relation) => (
                  <button
                    key={`${relation.direction}:${relation.relatedDocumentId}:${relation.relationType}`}
                    type="button"
                    onClick={() => onSelect(relation.relatedDocumentId)}
                    className="focus-ring flex items-center gap-2 rounded-[10px] border border-border bg-background px-3 py-2 text-left hover:border-primary/40"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        relation.relatedDocumentKind === "entity"
                          ? "bg-wiki-entity"
                          : "bg-wiki-concept"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                      {relation.relatedTitle}
                    </span>
                    <span className="shrink-0 text-[9.5px] text-muted-foreground">
                      {relation.relationType}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function KindBadge({ kind }: { kind: WikiGraphNode["documentKind"] }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold text-foreground uppercase ${
        kind === "entity"
          ? "border-wiki-entity/40 bg-wiki-entity/10"
          : "border-wiki-concept/40 bg-wiki-concept/10"
      }`}
    >
      {kind}
    </span>
  );
}

function WikiSources({ sources }: { sources: WikiDocumentSource[] }) {
  return (
    <section aria-labelledby="wiki-sources-title">
      <h3
        id="wiki-sources-title"
        className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
      >
        Sources
      </h3>
      {sources.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">연결된 원본 자료가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li
              key={source.sourceDocumentId}
              className="rounded-[10px] border border-border bg-background px-3 py-2.5"
            >
              <div className="mb-1 text-[9.5px] font-bold tracking-wide text-muted-foreground uppercase">
                {sourceTypeLabel(source.sourceType)}
              </div>
              {source.canonicalUrl !== null ? (
                <a
                  href={source.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring rounded-sm text-[12px] leading-[1.5] font-semibold text-foreground underline decoration-border underline-offset-3 hover:decoration-primary"
                >
                  {source.title}
                </a>
              ) : (
                <span className="text-[12px] leading-[1.5] font-semibold text-foreground">
                  {source.title}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sourceTypeLabel(sourceType: string): string {
  if (sourceType === "onboarding_seed") return "온보딩 관심사";
  if (sourceType === "url") return "외부 URL";
  if (sourceType === "web_clipping") return "저장한 웹 자료";
  if (sourceType === "memo") return "내 메모";
  return "개인 자료";
}
