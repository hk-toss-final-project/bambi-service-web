"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { PageState } from "@/components/ui/page-state";
import { IconAlert, IconSearch } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { useCardDetail } from "@/hooks/use-card-detail";
import { toFeedCardVM } from "@/lib/adapters/card";
import type { CardResponse } from "@/types/feed";

/**
 * 실 카드 상세 (GET /api/cards/{publicId}) — /report/{UUID}.
 *
 * 실 카드는 인증·소유자 전용이라 guest 는 접근 제한, 그 외에는 소유자 본인만 조회된다(비소유자·부재 404).
 * 인증(복구) 상태 우선 → 데이터 상태(두 loading 분리). 백엔드가 주는 값만 렌더한다
 * (작성자·좋아요·댓글·태그·visibility·본문 등 없음). 크롬(HomeNav·SideLeft·reader)만 mock 상세와
 * 공유하고, 본문은 실 필드(title·summary·whyForYou·sources·createdAt)로만 구성한다.
 * id 존재검증·라우팅은 서버(app/report/[id]/page.tsx)가 하고, 여기선 등록된 UUID 의 데이터만 다룬다.
 */
export function CardDetailScreen({ publicId }: { publicId: string }) {
  const { status, refreshAuth } = useAuth();
  const detail = useCardDetail(publicId);

  // 1) 인증(복구) 상태 — 확정 전엔 데이터 화면을 내보내지 않는다.
  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailAuthError onRetry={refreshAuth} />;
  // 실 카드는 소유자 전용 → guest 는 API 호출 없이 접근 제한.
  if (status === "guest") return <DetailAccessRestricted />;

  // 2) 데이터 상태 — authenticated 에서만 평가.
  if (detail.status === "loading") return <DetailSkeleton />;
  if (detail.status === "error") return <DetailDataError onRetry={detail.refetch} />;
  if (detail.status === "notFound") return <DetailNotFound />;
  return <CardDetailView card={detail.card} />;
}

/** 실제 상세 렌더 — 실 필드만. 크롬은 mock 상세와 공유하되 보관/공유/MD·우측 rail 은 두지 않는다. */
function CardDetailView({ card }: { card: CardResponse }) {
  const vm = toFeedCardVM(card);
  const [amOpen, setAmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          {/* 개인 foot 데이터가 없어 footLines 는 비운다(임의 생성 금지). */}
          <SideLeft footLines={[]} />

          <main className="min-w-0 max-w-[760px] flex-1">
            {/* .readbar — 뒤로가기만(보관/공유/MD 는 실 카드 미지원 → 두지 않음) */}
            <div className="sticky top-4 z-20 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-[9px] shadow-[var(--shadow)]">
              <Link
                href="/"
                className="focus-ring flex items-center gap-2 rounded-[6px] text-[13.5px] font-semibold whitespace-nowrap text-ink-mid hover:text-signal-ink"
              >
                <span className="text-muted-foreground">←</span>
                홈 피드로
              </Link>
            </div>

            {/* .dcard */}
            <article className="mb-4 rounded-2xl border border-border bg-card px-[30px] py-[26px]">
              {vm.createdAtLabel && (
                <div className="mb-2 text-xs text-muted-foreground">{vm.createdAtLabel}</div>
              )}
              <h1 className="mb-3 text-[25px] leading-[1.38] font-bold tracking-[-0.015em] text-foreground">
                {vm.title}
              </h1>
              <p className="text-base leading-[1.66] text-ink-mid">{vm.summary}</p>

              {/* 왜 나에게 왔나 (whyForYou) */}
              {vm.whyForYou && (
                <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-[1.6] text-ink-mid">
                  <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
                  <span>{vm.whyForYou}</span>
                </div>
              )}
            </article>

            {/* 출처 — 실제 URL 외부 링크(mock 상세의 시각 전용 "원문 열기"와 달리 실제 이동). */}
            {vm.sources.length > 0 && (
              <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-5">
                <div className="mb-3.5 text-[15px] font-bold text-foreground">
                  출처{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {vm.sources.length}건
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {vm.sources.map((source, i) => {
                    const label = source.title?.trim() || source.url;
                    return (
                      <li
                        key={`${vm.publicId}-src-${i}`}
                        className="flex items-center gap-[11px] rounded-[10px] border border-border bg-card px-3.5 py-[11px]"
                      >
                        <span className="w-[22px] shrink-0 text-[11.5px] text-muted-foreground">
                          [{i + 1}]
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-foreground">
                            {label}
                          </div>
                          {source.url && (
                            <div className="mt-px truncate text-[11.5px] text-muted-foreground">
                              {source.url}
                            </div>
                          )}
                        </div>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring ml-auto shrink-0 rounded-[3px] text-xs font-semibold whitespace-nowrap text-signal-ink hover:underline"
                          >
                            원문 열기 ↗
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </main>
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

/** 인증 복원 / 데이터 로딩 공통 스켈레톤 — reader 컬럼만 중립 placeholder. */
function DetailSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1" aria-hidden="true">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-[9px]">
              <div className={`h-4 w-24 ${bar}`} />
            </div>
            <div className="animate-pulse rounded-2xl border border-border bg-card px-[30px] py-[26px]">
              <div className={`mb-3 h-3 w-32 ${bar}`} />
              <div className={`mb-3 h-7 w-[80%] ${bar}`} />
              <div className={`mb-2 h-4 w-full ${bar}`} />
              <div className={`mb-2 h-4 w-[92%] ${bar}`} />
              <div className={`h-4 w-[60%] ${bar}`} />
            </div>
          </main>
        </div>
      </div>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도. */
function DetailAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          className="w-[420px] max-w-full"
          iconTone="brand"
          icon={<Orb size={22} />}
          title="인증 상태를 확인하지 못했어요"
          description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
          actions={[
            { label: "다시 시도", onClick: onRetry, variant: "primary" },
            { label: "홈으로", href: "/", variant: "ghost" },
          ]}
        />
      </div>
    </div>
  );
}

/** 카드 데이터 로드 실패(error) — 재시도(refetch). */
function DetailDataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          className="w-[440px] max-w-full"
          icon={<IconAlert />}
          title="카드를 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          actions={[
            { label: "다시 시도", onClick: onRetry, variant: "primary" },
            { label: "홈 피드로", href: "/", variant: "ghost" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * 화면 내부 Not Found — API 404(존재하지 않음/비소유/soft delete). 서버 notFound() 가 아니라
 * 클라이언트 상태다(정상 UUID 는 서버가 존재를 알 수 없어 200 으로 렌더된 뒤 이 상태가 뜬다).
 */
function DetailNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        icon={<IconSearch />}
        title="카드를 찾을 수 없어요"
        description={
          <>
            이미 삭제됐거나 접근할 수 없는 카드예요.
            <br />
            홈 피드에서 다시 확인해 주세요.
          </>
        }
        actions={[{ label: "홈 피드로", href: "/", variant: "primary" }]}
      />
    </div>
  );
}

/** guest 접근 제한 — 실 카드는 로그인한 소유자만 볼 수 있다(API 미호출). */
function DetailAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description={
          <>
            이 카드는 로그인한 본인만 볼 수 있어요.
            <br />
            로그인하면 내 카드 상세를 확인할 수 있어요.
          </>
        }
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
