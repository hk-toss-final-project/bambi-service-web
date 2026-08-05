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
import { CardLikeButton } from "@/components/report/card-like-button";
import { useCardDetail } from "@/hooks/use-card-detail";
import { useReportBody, type ReportBodyState } from "@/hooks/use-report-body";
import { isPublicCard, toCardSocial, toFeedCardVM } from "@/lib/adapters/card";
import { toReportRailVM } from "@/lib/adapters/report";
import { ReportMarkdown } from "@/components/report/report-markdown";
import type { CardResponse } from "@/types/feed";

/**
 * 실 카드 상세 (GET /api/cards/{publicId}) — /report/{UUID}.
 *
 * 2단계 데이터 흐름(2026-08-03 본문 연결, service-api PR #25·#30 실측):
 *   GET /api/cards/{publicId} → CardResponse.reportId(리포트 publicId, nullable)
 *   → reportId 있으면 GET /api/reports/{reportId} → body(Markdown) 렌더(ReportMarkdown).
 *   reportId=null 은 계약상 "리포트 없는 카드"(동기 즉시 카드 등) — 본문 섹션 없이 기존 요약 화면 그대로.
 *
 * 공개 열람(2026-08-04, service-api #30 실측): GET /api/cards/* · /api/reports/* 는 permitAll 이고
 * 권한은 "내 카드 or PUBLIC" 이다 → guest 도, 로그인한 타인도 PUBLIC 카드 상세를 그대로 본다.
 * 남의 PRIVATE·부재·형식오류는 401/403 이 아니라 전부 404 라 아래 DetailNotFound 한 갈래로 모인다.
 * 좋아요(2026-08-04, service-api PR #35 소셜 필드): PUBLIC 카드에서만 토글을 렌더하고,
 * 작성자 본인 여부로는 숨기거나 막지 않는다(정책 확정 — 서버도 소유자를 차단하지 않는다).
 * 소셜 값이 검증되지 않으면(미배포 응답·비정상 null) 좋아요 UI 자체를 두지 않는다.
 * 인증(복구) 상태 우선 → 데이터 상태(두 loading 분리). 백엔드가 주는 값만 렌더한다.
 * 리포트의 title·summary·citations 는 카드의 title·summary·sources 와 같은 발행 payload 라
 * 다시 렌더하지 않는다(중복 방지, PublishProcessingService 실측) — 본문(body)만 추가한다.
 * id 존재검증·라우팅은 서버(app/report/[id]/page.tsx)가 하고, 여기선 등록된 UUID 의 데이터만 다룬다.
 */
export function CardDetailScreen({ publicId }: { publicId: string }) {
  const { status, refreshAuth } = useAuth();
  const detail = useCardDetail(publicId);

  // 1) 인증(복구) 상태 — 확정 전엔 데이터 화면을 내보내지 않는다.
  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailAuthError onRetry={refreshAuth} />;

  // 2) 데이터 상태 — 인증 확정(guest·authenticated) 후에 평가한다.
  //    guest 도 여기까지 온다: PUBLIC 이면 상세가 뜨고, 아니면 API 404 → DetailNotFound.
  if (detail.status === "loading") return <DetailSkeleton />;
  if (detail.status === "error") return <DetailDataError onRetry={detail.refetch} />;
  if (detail.status === "notFound") return <DetailNotFound />;
  return <CardDetailView card={detail.card} guest={status === "guest"} />;
}

/**
 * 실제 상세 렌더 — 실 필드만. 크롬은 mock 상세와 공유하되 보관/공유/MD·우측 rail 은 두지 않는다.
 * guest 는 좌측 내비를 아이콘 전용으로 렌더한다(§15) — 홈 외 항목은 GuestGateModal 로 게이트된다.
 * 상단 HomeNav 는 자체적으로 useAuth 로 분기하므로 별도 prop 이 필요 없다.
 */
function CardDetailView({ card, guest }: { card: CardResponse; guest: boolean }) {
  const vm = toFeedCardVM(card);
  // 좋아요 초기값 — 단건 상세 응답의 author·likeCount·liked 를 런타임 검증해 좁힌다.
  // 소셜 필드가 없는 응답(미배포·비정상 null)이면 null 이고, 그때는 좋아요 UI 를 렌더하지 않는다.
  const social = toCardSocial(card);
  // 본문(리포트) — 카드 ready 후에만 이 컴포넌트가 mount 되므로 여기서 2단계 요청을 시작한다.
  const body = useReportBody(card.reportId);
  const [amOpen, setAmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          {/* 개인 foot 데이터가 없어 footLines 는 비운다(임의 생성 금지). */}
          <SideLeft footLines={[]} guest={guest} />

          <main className="min-w-0 max-w-[760px] flex-1">
            {/*
              .readbar — 뒤로가기만(보관/공유/MD 는 실 카드 미지원 → 두지 않음).

              목업(report-detail.html)의 readbar 는 padding 9px 12px 이고, **두께는 내부
              `.btn`(height:32px)이 만든다**. 이 화면에는 그 버튼들이 없어 같은 padding 이어도
              한 줄 높이(약 40px)로 주저앉아 입력창처럼 보였다 → 링크 콘텐츠에 목업 버튼과 같은
              32px 높이를 줘 목업과 동일한 두께(32 + 9·2 + 보더 2 = 52px)로 맞춘다.

              카드 전체가 Link 라 어디를 눌러도 홈으로 간다(기존 border·bg-card·rounded·shadow·
              hover·focus-ring 유지, 새 강조색 없음).
            */}
            <Link
              href="/"
              className="focus-ring sticky top-4 z-20 mb-4 flex items-center rounded-xl border border-border bg-card px-3 py-[9px] text-[13.5px] font-semibold whitespace-nowrap text-ink-mid shadow-[var(--shadow)] hover:text-signal-ink"
            >
              <span className="flex min-h-8 items-center gap-2">
                <span aria-hidden="true" className="text-muted-foreground">
                  ←
                </span>
                홈 피드로
              </span>
            </Link>

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

              {/* 리포트 본문 — reportId 로 이어지는 2번째 요청의 상태별 렌더(카드 요약 아래). */}
              <CardReportBody body={body} />

              {/*
                좋아요 — 본문 아래, 카드 article 최하단. PUBLIC 이고 소셜 값이 검증됐을 때만 렌더한다.
                PRIVATE 카드는 서버가 좋아요를 404 로 막으므로 버튼 자체를 두지 않는다.
                작성자 본인 여부는 검사하지 않는다(정책: 본인도 좋아요 가능).
              */}
              {isPublicCard(card) && social !== null && (
                <CardLikeButton publicId={card.publicId} social={social} />
              )}
            </article>

            {/*
              출처 — 어댑터(toCardSources)가 정규화한 출처만 온다: 빈 출처({title:null,url:null} 등)는
              제외되고, 건수도 정규화 결과 기준이다. 유효 출처가 0건이면 섹션 자체를 렌더하지 않는다.
              URL 은 http/https 인 경우에만 실제 외부 링크로 나간다(mock 상세의 시각 전용 링크와 다름).
            */}
            {vm.sources.length > 0 && (
              <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-5">
                <div className="mb-3.5 text-[15px] font-bold text-foreground">
                  출처{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {vm.sources.length}건
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {vm.sources.map((source, i) => (
                    <li
                      key={`${vm.publicId}-src-${i}`}
                      className="flex items-center gap-[11px] rounded-[10px] border border-border bg-card px-3.5 py-[11px]"
                    >
                      <span className="w-[22px] shrink-0 text-[11.5px] text-muted-foreground">
                        [{i + 1}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-foreground">
                          {source.label}
                        </div>
                        {/* 제목이 없어 URL 이 라벨로 쓰인 출처는 같은 URL 을 두 번 쓰지 않는다. */}
                        {source.url && source.url !== source.label && (
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
                  ))}
                </ul>
              </section>
            )}
          </main>

          {/* 우측 rail — 실 UUID 상세 전용. 값이 실제로 있는 리포트(ready)에서만 렌더된다. */}
          <CardReportRail body={body} />
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

/**
 * 리포트 본문 섹션 — useReportBody 상태별 렌더. 카드 요약 article 내부, whyForYou 아래에 붙는다.
 * - none: reportId=null(계약: 리포트 없는 카드) → 아무것도 렌더하지 않는다(기존 요약 화면 유지,
 *   생성 중 같은 추측 상태 금지).
 * - ready 인데 body 가 비어 있으면(컬럼 nullable) 섹션 자체를 생략한다(빈 껍데기 금지).
 * - notFound: 404(부재·접근 불가 — 존재 노출 없음) → 조용한 안내만(재시도 무의미).
 * - error: 일시 오류 → 본문만 다시 시도(카드 요약은 이미 떠 있다).
 */
function CardReportBody({ body }: { body: ReportBodyState & { refetch: () => void } }) {
  if (body.status === "none") return null;

  if (body.status === "loading") {
    const bar = "rounded-md bg-[var(--skel1)]";
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div aria-hidden="true" className="animate-pulse">
          <div className={`mb-3 h-4 w-36 ${bar}`} />
          <div className={`mb-2 h-4 w-full ${bar}`} />
          <div className={`mb-2 h-4 w-[92%] ${bar}`} />
          <div className={`h-4 w-[68%] ${bar}`} />
        </div>
        <span className="sr-only" role="status">
          본문을 불러오는 중…
        </span>
      </div>
    );
  }

  if (body.status === "error") {
    return (
      <div role="alert" className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-background px-4 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-[1.6] text-ink-mid">
            본문을 불러오지 못했어요. 일시적인 문제일 수 있어요.
          </p>
          <button
            type="button"
            onClick={body.refetch}
            className="focus-ring shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink-mid hover:bg-background"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (body.status === "notFound") {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[13px] leading-[1.6] text-muted-foreground">
          본문을 찾을 수 없어요 — 이미 삭제됐거나 접근할 수 없는 본문이에요.
        </p>
      </div>
    );
  }

  const markdown = body.report.body?.trim() ?? "";
  if (markdown === "") return null; // body 컬럼 nullable — 빈 본문이면 섹션 생략

  return (
    <div className="mt-4 border-t border-border pt-1.5">
      <ReportMarkdown markdown={markdown} />
    </div>
  );
}

/**
 * 우측 rail — mock 상세(ReportScreen)의 "출처 신뢰도 요약" rail 과 시각적으로 정렬되는 실 데이터 전용 카드.
 * SideRight(홈 rail)는 쓰지 않는다. 레이아웃은 SideLeft(300px) + reader(760px) + rail(300px), gap 22px.
 *
 * 표시하는 값은 API 가 실제로 주는 것만이다:
 * - 출처: 정규화된 유효 citation 개수(raw citations.length 아님). 0 이면 행을 숨긴다.
 *   카드 sources 와 합산하지 않는다(같은 발행 payload 라 합치면 중복 계산).
 * - 마지막 업데이트: report.createdAt 포맷. 파싱 실패면 행을 숨긴다.
 * 신뢰도·조회수·읽음 시간·작성자 통계처럼 API 에 없는 값은 만들지 않는다.
 *
 * none·loading·error·notFound 에서는 report 기반 수치가 존재하지 않으므로 rail 자체를 렌더하지 않는다
 * (임의 날짜·임의 수치 생성 금지). 표시할 행이 하나도 없으면 빈 카드도 두지 않는다.
 * 반응형: 1240px 이하 rail 숨김 / 1100px 이하 좌측 내비 숨김(SideLeft) → 모바일은 본문 단일 칼럼.
 */
function CardReportRail({ body }: { body: ReportBodyState }) {
  if (body.status !== "ready") return null;

  const rail = toReportRailVM(body.report);
  const rows: { label: string; value: string }[] = [];
  if (rail.citationCount > 0) rows.push({ label: "출처", value: `${rail.citationCount}건` });
  if (rail.updatedAtLabel !== "") {
    rows.push({ label: "마지막 업데이트", value: rail.updatedAtLabel });
  }
  if (rows.length === 0) return null;

  return (
    <aside className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden">
      <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
        <h4 className="mb-[15px] flex items-center text-[13px] font-bold text-foreground">
          본문 정보
        </h4>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 border-t border-border py-2 text-[12.5px] text-ink-mid ${i === 0 ? "border-t-0 pt-px" : ""}`}
          >
            <span className="shrink-0">{row.label}</span>
            <b className="min-w-0 truncate font-bold text-foreground">{row.value}</b>
          </div>
        ))}
      </div>
    </aside>
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
 * 화면 내부 Not Found — API 404(존재하지 않음/남의 PRIVATE/soft delete). 서버 notFound() 가 아니라
 * 클라이언트 상태다(정상 UUID 는 서버가 존재를 알 수 없어 200 으로 렌더된 뒤 이 상태가 뜬다).
 * 백엔드가 비공개를 403 이 아닌 404 로 감추므로(존재 노출 없음) guest·member 모두 같은 화면을 본다 —
 * "로그인하면 볼 수 있다"고 안내하지 않는다(사실이 아닐 수 있고, 카드 존재를 알려주게 된다).
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
