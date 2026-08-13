"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { useRequireAuth } from "@/components/auth/use-require-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { Segments } from "@/components/home/post-card";
import { ReportBodyMock } from "@/components/report/report-body-mock";
import { ReportBodyPublicMock } from "@/components/report/report-body-public-mock";
import { ReportBodySections } from "@/components/report/report-body-sections";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import type { ErrorCode } from "@/constants/errors";
import { useReportDetail } from "@/hooks/use-report-detail";
import { MOCK_SOURCES, type ReportDetail } from "@/lib/mock/report";

/**
 * 카드(리포트) 상세 — 인증 상태 × 데이터 상태로 분기(§9·§15). id 존재 검증·404 는 서버
 * app/report/[id]/page.tsx(→ reportRouteExists)가 처리하고, 여기선 등록된 id 의 데이터 상태만 다룬다.
 * 데이터는 클라이언트 훅 useReportDetail(id)가 loading / ready / preparing / error 로 정규화한다.
 *
 * 인증(복구) 상태 우선 → 데이터 상태 (두 loading 을 분리한다).
 * - loading(인증)   → 중립 스켈레톤(로그인 새로고침 시 guest 화면이 한 프레임도 안 뜨게)
 * - error(인증)     → 인증 복원 오류 UI + 재시도
 * - loading(데이터) → 중립 스켈레톤(인증 확정 후 데이터 로딩 — 차단/본문 어느 것도 노출하지 않음)
 * - error(데이터)   → 브리핑 로드 오류 UI + 재시도(refetch)
 * - guest & 개인 경로 → 접근 제한(본문 미렌더)
 * - preparing → 생성 중(분석 중) 안내
 * - ready     → 보고서. 내용은 report 로만 결정되고, 크롬(좌측 내비·Sticky CTA)만 로그인 여부로 달라진다.
 *   allowGuest: public 경로(guest·member 동일 열람) / personal 경로(소유자 전용, guest 접근 제한).
 */
export function ReportScreen({ id }: { id: string }) {
  const { status, refreshAuth } = useAuth();
  const detail = useReportDetail(id);

  // 1) 인증(복구) 상태 — 인증 확정 전엔 공개/비공개 화면을 내보내지 않는다(§15).
  if (status === "loading") return <ReportSkeleton />;
  if (status === "error") return <ReportAuthError onRetry={refreshAuth} />;

  // 2) 데이터(리포트) 상태 — 인증 확정 이후에만 평가한다.
  if (detail.status === "loading") return <ReportSkeleton />;
  if (detail.status === "error")
    return <ReportDataError onRetry={detail.refetch} errorCode={detail.errorCode} />;
  // 개인(owner-only) 경로에 guest 접근 → 본문·생성상태 대신 접근 제한 UI (ready·preparing 공통)
  if (status === "guest" && !detail.allowGuest) return <ReportAccessRestricted />;
  if (detail.status === "preparing") return <ReportPreparing />;

  const isMember = status === "authenticated";
  // key: 로그인 여부 전환 시 remount 해 보관/공유 등 로컬 state 를 초기화
  return <ReportView key={isMember ? "member" : "guest"} report={detail.report} isMember={isMember} />;
}

/** 실제 상세 렌더 — 내용은 report 로, 크롬(내비·Sticky CTA)은 isMember(로그인 여부)로 결정한다. */
function ReportView({ report, isMember }: { report: ReportDetail; isMember: boolean }) {
  const { requireAuth } = useRequireAuth();
  const [saved, setSaved] = useState(report.savedInitially);
  const [shared, setShared] = useState(false);
  const [amOpen, setAmOpen] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // 공유: member 실동작은 P1(미구현 no-op). guest 는 requireAuth 가 게이트.
  function handleShare() {
    requireAuth(() => setShared((v) => !v));
  }

  // MD 복사: guest → GuestGateModal(복사 미실행). member → raw markdown 을 Clipboard API 로 복사하고
  // 버튼을 잠깐 "✓ 복사됨"으로 바꾼 뒤 토스트로 안내(목업 report-detail.html d-md 명세).
  function handleMdCopy() {
    requireAuth(() => {
      void copyMarkdown();
    });
  }
  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(report.markdown);
      setMdCopied(true);
      setCopyFeedback("마크다운이 클립보드에 복사됐어요");
      window.setTimeout(() => setMdCopied(false), 1800);
      window.setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setMdCopied(false);
      setCopyFeedback("복사하지 못했어요. 다시 시도해 주세요");
      window.setTimeout(() => setCopyFeedback(null), 2500);
    }
  }

  // readbar .btn.ghost.sm (+ .on 상태)
  const ghostBtn =
    "focus-ring inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold whitespace-nowrap";
  const ghostOff = "border-border bg-transparent text-ink-mid hover:bg-background";
  const ghostOn = "border-wash-strong bg-wash text-signal-ink";

  return (
    <div className="min-h-screen bg-background">
      {/* nav — 풀블리드, 홈과 공유 */}
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto max-w-[1440px]">
        {/* .shell — guest 는 Sticky CTA 높이만큼 하단 여백 확보 */}
        <div className={`flex items-start justify-center gap-[22px] px-5 pt-6 ${isMember ? "pb-14" : "pb-[104px]"}`}>
          <SideLeft footLines={report.sideFoot} guest={!isMember} />

          {/* .reader */}
          <main className="min-w-0 max-w-[760px] flex-1">
            {/* .readbar */}
            <div className="sticky top-4 z-20 mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-[9px] shadow-[var(--shadow)]">
              {/* 뒤로 — 홈으로 실제 이동 */}
              <Link
                href="/"
                className="focus-ring flex items-center gap-2 rounded-[6px] text-[13.5px] font-semibold whitespace-nowrap text-ink-mid"
              >
                <span className="text-muted-foreground">←</span>
                {report.readbar.backLabel}
              </Link>
              <span className="flex-1" />
              {/* MD 복사 — 인증 필요 (requireAuth). member: 복사 후 잠깐 "✓ 복사됨" */}
              <button
                type="button"
                onClick={handleMdCopy}
                title="마크다운 원문 복사"
                className={`${ghostBtn} ${mdCopied ? ghostOn : ghostOff}`}
              >
                {mdCopied ? "✓ 복사됨" : report.readbar.mdCopyLabel}
              </button>
              {/* 보관 — 인증 필요 (requireAuth: member 토글 / 그 외 GuestGateModal) */}
              <button
                type="button"
                onClick={() => requireAuth(() => setSaved((v) => !v))}
                aria-pressed={saved}
                className={`${ghostBtn} ${saved ? ghostOn : ghostOff}`}
              >
                ⚑ {saved ? "보관됨" : "보관"}
              </button>
              {/* 공유 — 인증 필요 (requireAuth). member 실 공유 플로우(#sh-modal)는 P1 */}
              <button
                type="button"
                onClick={handleShare}
                aria-pressed={shared}
                className={`${ghostBtn} ${shared ? ghostOn : ghostOff}`}
              >
                {report.readbar.shareLabel}
              </button>
            </div>

            {/* .dcard */}
            <article className="mb-4 rounded-2xl border border-border bg-card px-[30px] py-[26px]">
              {/* .dhead */}
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-wash-strong bg-wash text-[11px] font-bold text-signal-ink">
                  {report.head.avatar}
                </span>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {report.head.name}{" "}
                    <span className="text-[13px] font-normal text-muted-foreground">
                      {report.head.nameSub}
                    </span>
                  </div>
                  <div className="mt-px text-xs text-muted-foreground">{report.head.meta}</div>
                </div>
                {/* .dpill */}
                <span className="ml-auto rounded-full border border-border bg-background px-2.5 py-[3px] text-[11px] text-muted-foreground">
                  {report.dpill}
                </span>
              </div>

              <h1 className="mb-3 text-[25px] leading-[1.38] font-bold tracking-[-0.015em] text-foreground">
                {report.title}
              </h1>
              <p className="mb-3.5 text-base leading-[1.66] text-ink-mid">{report.lead}</p>
              {/* .dmeta — public 은 "왜 나에게 왔나" reason 없음 */}
              <div className="flex flex-wrap items-center gap-2.5 border-b border-border pb-4 text-[12.5px] text-muted-foreground">
                <span>
                  출처 <b className="font-semibold text-ink-mid">{report.meta.sourceCount}</b>
                </span>
                <span className="text-input">·</span>
                <span className="font-semibold text-ok">{report.meta.trust}</span>
                {report.meta.reason && (
                  <>
                    <span className="text-input">·</span>
                    <span>
                      <Segments segments={report.meta.reason} />
                    </span>
                  </>
                )}
              </div>

              {report.bodyKind === "fx-private" ? (
                <ReportBodyMock />
              ) : report.bodyKind === "fx-public" ? (
                <ReportBodyPublicMock />
              ) : (
                <ReportBodySections sections={report.bodySections ?? []} />
              )}
            </article>

            {/* 출처 (.block) — 공개 정보 공통 */}
            <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-5">
              <div className="mb-3.5 flex items-center gap-[9px] text-[15px] font-bold text-foreground">
                출처{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  {MOCK_SOURCES.count}
                </span>
              </div>
              {MOCK_SOURCES.rows.map((row) => (
                <div
                  key={row.no}
                  className="mb-2 flex items-center gap-[11px] rounded-[10px] border border-border bg-card px-3.5 py-[11px] last:mb-0"
                >
                  <span className="w-[22px] shrink-0 text-[11.5px] text-muted-foreground">
                    {row.no}
                  </span>
                  {/* 신뢰도 dot */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      row.trust === "mid" ? "bg-[var(--mid)]" : "bg-[var(--ok-dot)]"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-foreground">{row.name}</div>
                    <div className="mt-px text-[11.5px] text-muted-foreground">{row.pub}</div>
                  </div>
                  <span className="rounded-full border border-border px-[9px] py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
                    {row.type}
                  </span>
                  {/* 원문 열기 — 실제 URL 은 API 계약 확정 후 → 시각 전용 */}
                  <span
                    aria-disabled="true"
                    className="ml-auto text-xs font-semibold whitespace-nowrap text-signal-ink"
                  >
                    원문 열기 ↗
                  </span>
                </div>
              ))}
            </section>

            {/* 댓글 · 메모 (.block) — private=메모 / public=공개 댓글 (동일 기능, 공개 범위로 명칭만 다름) */}
            <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-5">
              <div className="mb-3.5 flex items-center gap-[9px] text-[15px] font-bold text-foreground">
                {report.comments.blockTitle}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  {report.comments.blockSub}
                </span>
              </div>
              {report.comments.items.map((c) => (
                <div key={c.name + c.time} className="flex items-start gap-2.5 border-b border-border py-3">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-input bg-background text-[9.5px] font-bold text-muted-foreground">
                    {c.avatar}
                  </span>
                  <div>
                    <div className="text-[12.5px] font-bold text-foreground">
                      {c.name}
                      <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                        {c.time}
                      </span>
                    </div>
                    <p className="mt-[3px] text-[13px] leading-[1.6] text-ink-mid">{c.text}</p>
                  </div>
                </div>
              ))}
              {/* .cinput — 댓글·메모 입력은 인증 필요 액션 (requireAuth). span→button 으로 변경(접근성) */}
              <div className="mt-3.5 flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-wash-strong bg-wash text-[11px] font-bold text-signal-ink">
                  {report.comments.inputAvatar}
                </span>
                <button
                  type="button"
                  onClick={() => requireAuth(() => {})}
                  className="focus-ring flex h-[42px] flex-1 items-center rounded-[21px] border border-border bg-background px-4 text-left text-[13px] text-muted-foreground hover:border-wash-strong"
                >
                  {report.comments.inputPlaceholder}
                </button>
              </div>
              {report.comments.note && (
                <p className="mt-2 pl-0.5 text-[11.5px] text-muted-foreground">{report.comments.note}</p>
              )}
            </section>
          </main>

          {/* RIGHT RAIL (detail) — next(개인 시퀀스)·related(내 기록)는 public 에서 숨김, trust 는 공통 */}
          <aside className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden">
            {report.rail.next && (
              <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
                <h4 className="mb-[15px] flex items-center text-[13px] font-bold text-foreground">
                  {report.rail.next.title}
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                    {report.rail.next.counter}
                  </span>
                </h4>
                <RelatedRow title={report.rail.next.item.title} meta={report.rail.next.item.meta} first />
                <button
                  type="button"
                  aria-disabled="true"
                  className="mt-[11px] inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid"
                >
                  {report.rail.next.cta}
                </button>
              </div>
            )}

            {/* 출처 신뢰도 요약 — 공개 공통 */}
            <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
              <h4 className="mb-[15px] flex items-center text-[13px] font-bold text-foreground">
                {report.rail.trust.title}
              </h4>
              {report.rail.trust.rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between border-t border-border py-2 text-[12.5px] text-ink-mid ${i === 0 ? "border-t-0 pt-px" : ""}`}
                >
                  <span>{row.label}</span>
                  <b className={`font-bold ${row.ok ? "text-ok" : "text-foreground"}`}>{row.value}</b>
                </div>
              ))}
            </div>

            {report.rail.related && (
              <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
                <h4 className="mb-[15px] flex items-center text-[13px] font-bold text-foreground">
                  {report.rail.related.title}
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                    {report.rail.related.all}
                  </span>
                </h4>
                {report.rail.related.items.map((item, i) => (
                  <RelatedRow key={item.title} title={item.title} meta={item.meta} first={i === 0} />
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />

      {/* MD 복사 피드백 — aria-live 로 안내(항상 mount). member 만 도달(guest 는 게이트). */}
      <div aria-live="polite" role="status" className="sr-only">
        {copyFeedback ?? ""}
      </div>
      {copyFeedback && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background shadow-[0_8px_28px_rgba(12,14,17,.2)]">
          {copyFeedback}
        </div>
      )}

      {/* guest 하단 Sticky 로그인·가입 CTA — 로그인 사용자에겐 없음. 모달 아님(상시 노출). */}
      {!isMember && <GuestStickyCta />}
    </div>
  );
}

/** 인증 복원 중 — 중립 스켈레톤(공개/비공개 문구 없음). 잘못된 public 화면을 한 프레임도 내보내지 않는다. */
function ReportSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1" aria-hidden="true">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-[9px]">
              <div className={`h-4 w-24 ${bar}`} />
              <span className="flex-1" />
              <div className={`h-6 w-16 ${bar}`} />
              <div className={`h-6 w-16 ${bar}`} />
            </div>
            <div className="animate-pulse rounded-2xl border border-border bg-card px-[30px] py-[26px]">
              <div className="mb-4 flex items-center gap-2.5">
                <div className={`h-[34px] w-[34px] rounded-full ${bar}`} />
                <div className="flex-1">
                  <div className={`mb-1.5 h-3.5 w-40 ${bar}`} />
                  <div className={`h-3 w-56 ${bar}`} />
                </div>
              </div>
              <div className={`mb-3 h-7 w-[80%] ${bar}`} />
              <div className={`mb-2 h-4 w-full ${bar}`} />
              <div className={`mb-5 h-4 w-[70%] ${bar}`} />
              <div className={`mb-3 h-[220px] w-full ${bar}`} />
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

/** 인증 복원 오류(500·네트워크) — public 으로 대체하지 않고 재시도를 제공한다. */
function ReportAuthError({ onRetry }: { onRetry: () => void }) {
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
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring flex h-[46px] w-full items-center justify-center rounded-[10px] border border-primary bg-primary text-[14.5px] font-semibold text-primary-foreground hover:brightness-[.96]"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="focus-ring flex h-[46px] w-full items-center justify-center rounded-[10px] border border-border bg-card text-[14.5px] font-semibold text-foreground hover:bg-background"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 개인(owner-only) 경로에 guest 접근 — private 본문을 렌더하지 않고 접근 제한만 안내한다(§15).
 * 소유자는 로그인하면 볼 수 있으므로 로그인 경로를 제공한다. public 으로 대체하지 않는다.
 */
function ReportAccessRestricted() {
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
            이 브리핑은 작성자 본인만 볼 수 있어요.
            <br />
            로그인하면 오늘 아침 브리핑을 확인할 수 있어요.
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

/**
 * 리포트 데이터 로드 실패(error) — 목업 report-detail-image-states.html "에러".
 * public 으로 대체하지 않고 재시도(router.refresh 로 서버 재요청)를 제공한다(§9 Error · §4 INTERNAL_ERROR).
 */
function ReportDataError({ onRetry, errorCode }: { onRetry: () => void; errorCode?: ErrorCode }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          className="w-[440px] max-w-full"
          icon={<IconAlert />}
          title="브리핑을 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          errorCode={errorCode}
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
 * 리포트 생성 중(preparing) — 목업 report-detail-image-states.html "분석 중". 본문이 아직 없어
 * 생성 단계를 안내한다(온디맨드 분석·가입 직후 첫 브리핑, DECISION-023·024). 진행률 수치는 미표시 샘플.
 */
function ReportPreparing() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="status"
          className="w-[460px] max-w-full"
          iconTone="brand"
          icon={<Orb size={22} className="motion-safe:animate-spin [animation-duration:3s]" />}
          title="브리핑을 정리하고 있어요"
          description={
            <div className="flex flex-col items-center gap-3">
              <p>완료되면 이 화면에서 바로 확인할 수 있어요.</p>
              <span className="block h-1.5 w-[180px] overflow-hidden rounded-full bg-secondary">
                <span className="block h-full w-[58%] rounded-full bg-primary" />
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                수집 42건 → <b className="font-semibold text-signal-ink">선별 중</b> → 근거 정리
              </span>
            </div>
          }
        />
      </div>
    </div>
  );
}

/** 비로그인 상세 하단 고정 CTA — 가입하기 Primary · 로그인 보조. */
function GuestStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-card shadow-[0_-8px_28px_rgba(12,14,17,.07)]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3.5 px-6 py-[13px]">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold tracking-[-0.01em] text-foreground">
            관심 있는 신호를 놓치지 마세요.
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-mid">
            로그인하면 저장하고 맞춤 피드를 받아볼 수 있어요.
          </div>
        </div>
        <Link
          href="/login"
          className="focus-ring inline-flex h-[42px] items-center justify-center rounded-[10px] border border-border bg-card px-4 text-[13.5px] font-semibold whitespace-nowrap text-foreground hover:bg-background"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="focus-ring inline-flex h-[42px] items-center justify-center rounded-[10px] border border-primary bg-primary px-4 text-[13.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
        >
          가입하기
        </Link>
      </div>
    </div>
  );
}

/** .rrelated — API 연결 전 시각 전용 */
function RelatedRow({ title, meta, first }: { title: string; meta: string; first?: boolean }) {
  return (
    <div
      aria-disabled="true"
      className={`flex items-start gap-2.5 border-t border-border py-[9px] ${first ? "border-t-0 pt-px" : ""}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[11px] text-muted-foreground">
        ◉
      </span>
      <div>
        <div className="text-[12.5px] leading-[1.4] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}
