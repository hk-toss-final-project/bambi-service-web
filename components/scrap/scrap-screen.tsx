"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { ScrapRail } from "@/components/scrap/scrap-rail";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import { useScraps } from "@/hooks/use-scraps";
import { unscrapCard } from "@/lib/repositories/scraps";
import { MOCK_SIDE_FOOT } from "@/lib/mock/feed";
import type { ScrapCard } from "@/types/scrap";

const SCRAP_MENU_LABEL = "북마크";

const SCRAPPED_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * 북마크(스크랩) — /scraps. member 전용(내 보관 목록 = 개인 데이터), 인증 4분기(§15).
 * 목업 saved.html 기준. 목록은 "아직 PUBLIC 인 카드만" 온다(비공개 전환은 백엔드 자동 숨김).
 * 카드 제목·"보고서 열기"는 상세(/report/{publicId})로 간다 — 처음(07-31)엔 타인 공개 카드
 * 단건 API가 없어 링크를 안 달았지만, 08-04 타인·게스트 공개 카드 상세(#30)로 열렸다.
 * 목록엔 PUBLIC 카드만 오므로 상세에서 404 를 만날 일은 비공개 전환 직후 정도다(상세가 처리).
 * 조회수·좋아요 수는 이 API 응답에 없으므로 표기하지 않는다.
 */
export function ScrapScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <ScrapSkeleton />;
  if (status === "error") {
    return (
      <Shell>
        <PageState
          role="alert"
          icon={<IconAlert />}
          title="로그인 상태를 확인하지 못했어요"
          description="네트워크가 불안정하거나 세션이 만료됐을 수 있어요."
          actions={[{ label: "다시 시도", onClick: () => void refreshAuth(), variant: "primary" }]}
        />
      </Shell>
    );
  }
  if (status === "guest") {
    return (
      <Shell guest>
        <PageState
          title="로그인하면 보관함을 볼 수 있어요"
          description="피드에서 마음에 드는 공개 보고서를 담아두고 다시 찾아보세요."
          actions={[
            { label: "가입하기", href: "/signup", variant: "primary" },
            { label: "로그인", href: "/login", variant: "ghost" },
          ]}
        />
      </Shell>
    );
  }
  return <ScrapView />;
}

/**
 * 공통 프레임 — 헤더 + 좌측 내비 + 본문 (+ 선택적 우측 rail).
 * 목업 shell(좌 300 · 본문 760 · 우 300)과 같은 3열 구조이며, rail 은 보여줄 실제 집계가 있을
 * 때만 상위가 넘긴다 — loading·error·guest 분기에서는 빈 칼럼조차 만들지 않는다.
 */
function Shell({
  children,
  guest = false,
  rail,
}: {
  children: React.ReactNode;
  guest?: boolean;
  rail?: React.ReactNode;
}) {
  const [amOpen, setAmOpen] = useState(false);
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />
      <div className="mx-auto w-full max-w-[1440px] flex-1">
        <div className="flex min-h-full items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current={SCRAP_MENU_LABEL} footLines={MOCK_SIDE_FOOT} guest={guest} />
          <main className="flex min-h-[60dvh] min-w-0 max-w-[760px] flex-1 flex-col">{children}</main>
          {rail}
        </div>
      </div>
      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

function ScrapSkeleton() {
  return (
    <Shell>
      <FeedSkeleton />
    </Shell>
  );
}

function ScrapView() {
  const scraps = useScraps();
  // 해제 성공한 카드는 목록에서 즉시 숨긴다(재조회 없이). refetch 하면 초기화된다.
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());

  const visible =
    scraps.status === "success" ? scraps.data.filter((c) => !removedIds.has(c.publicId)) : [];

  return (
    // rail 은 **화면에 실제로 남아 있는 목록**(보관 해제분 제외)으로 집계한다 —
    // 해제 직후 주제 빈도가 목록과 어긋나지 않는다. 태그가 없으면 ScrapRail 이 스스로 null 이다.
    <Shell rail={<ScrapRail cards={visible} />}>
      <header className="mb-8">
        <h1 className="text-[22px] font-bold tracking-[-0.015em] text-foreground">북마크</h1>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-ink-mid">
          담아둔 공개 보고서를 다시 확인해요.
        </p>
      </header>

      {scraps.status === "loading" && <FeedSkeleton />}
      {scraps.status === "error" && (
        <div
          role="alert"
          className="rounded-[14px] border border-border bg-card px-5 py-6 text-center text-[13.5px] text-ink-mid"
        >
          보관함을 불러오지 못했어요.{" "}
          <button
            type="button"
            onClick={scraps.refetch}
            className="focus-ring rounded-[3px] font-semibold text-signal-ink"
          >
            다시 시도
          </button>
        </div>
      )}
      {(scraps.status === "empty" || (scraps.status === "success" && visible.length === 0)) && (
        <div className="rounded-[14px] border border-border bg-card px-5 py-8 text-center">
          <div className="mb-1 text-[13.5px] font-bold text-ink-mid">아직 담아둔 보고서가 없어요</div>
          <div className="text-[12.5px] leading-[1.6] text-muted-foreground">
            피드에서 마음에 드는 공개 보고서를 담아두면 여기에 쌓여요.
          </div>
        </div>
      )}
      {scraps.status === "success" &&
        visible.map((card) => (
          <ScrapItem
            key={card.publicId}
            card={card}
            onRemoved={() => setRemovedIds((cur) => new Set(cur).add(card.publicId))}
          />
        ))}
    </Shell>
  );
}

function ScrapItem({ card, onRemoved }: { card: ScrapCard; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const at = formatScrappedAt(card.createdAt);
  const authorName = card.author.displayName?.trim() || "사용자";
  // 상세 진입 — 공개 피드 카드(public-feed-card)와 같은 경로·패턴.
  const detailHref = `/report/${card.publicId}`;

  function remove() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    unscrapCard(card.publicId)
      .then(() => onRemoved())
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }

  return (
    <article className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          {card.author.publicId ? (
            <Link
              href={`/users/${card.author.publicId}`}
              className="focus-ring rounded-[3px] font-semibold text-ink-mid hover:text-signal-ink"
            >
              {authorName}
            </Link>
          ) : (
            <span className="font-semibold">{authorName}</span>
          )}
          {at && <span> · {at} 작성</span>}
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="focus-ring shrink-0 rounded-[8px] border border-border px-2.5 py-1 text-[12px] text-ink-mid hover:bg-background hover:text-foreground disabled:opacity-50"
        >
          {busy ? "해제 중…" : "⚑ 보관 해제"}
        </button>
      </div>

      {/* 제목 = 상세 링크 (피드 카드와 동일 관례 — hover 시 signal 색으로 눌리는 것임을 알린다) */}
      <h3 className="mb-2 text-lg leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
        <Link
          href={detailHref}
          className="focus-ring rounded-[3px] break-words hover:text-signal-ink"
        >
          {card.title}
        </Link>
      </h3>
      <p className="mb-1 text-sm leading-[1.7] text-ink-mid">{card.summary}</p>
      <Link
        href={detailHref}
        className="focus-ring mb-3 inline-block rounded-[3px] text-sm leading-[1.7] font-semibold text-muted-foreground hover:text-signal-ink"
      >
        보고서 열기
        <span className="sr-only"> — {card.title}</span>
      </Link>

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-background px-2.5 py-[3px] text-[11.5px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {failed && (
        <p role="alert" className="mt-2 text-[12px] text-destructive">
          해제하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </article>
  );
}

function formatScrappedAt(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return SCRAPPED_AT_FORMAT.format(new Date(ts));
}
