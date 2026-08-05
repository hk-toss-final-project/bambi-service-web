"use client";

import Link from "next/link";

import type { MemberFeedState } from "@/hooks/use-member-feed";
import { pickRecentReports, toMyReportsSummary } from "@/lib/adapters/home-rail";

/**
 * 홈 우측 rail (member) — 데이터는 전부 **[내 보고서]가 이미 조회한 `GET /api/feed` 결과**다.
 * `HomeView` 가 소유한 `memberFeed` 상태를 그대로 받아 쓰므로 rail 때문에 API 를 다시 부르지 않는다.
 *
 * 패널 2개:
 * - 내 보고서 현황 — 전체/공개/비공개 건수 · 최근 작성일 · `/reports` 진입
 * - 최근 내 보고서 — 최신 3건, 각 항목이 `/report/{publicId}` 실제 링크
 *
 * 이전의 「오늘의 핵심 신호」·「추천 토픽」·「＋ 관심사로 추가」는 대응 API 가 없어 제거했다
 * (공개 피드나 카드 데이터를 신호·토픽으로 가공하면 없는 값을 만드는 셈이다).
 *
 * 디자인: handoff `product-components.css` 의 `.rpanel`(bg-card·border·radius 14·px-4 py-[15px]) ·
 * `.rpanel h4`(13px/700) · `.rstat`(label↔값, 12.5px, border-t, 첫 행 border 없음) ·
 * `.rrelated`(아이콘 + 제목/메타, border-t) 를 따른다. 300px 폭 · sticky · 1240px 미만 숨김은 기존 정책 유지
 * (Tailwind v4 가 `max-[1240px]:hidden` 을 `@media not (min-width: 1240px)` 로 컴파일 → 1240px 에서는 노출).
 */
export function SideRight({ feed }: { feed: MemberFeedState & { refetch: () => void } }) {
  return (
    <aside
      aria-label="내 보고서 요약"
      className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden"
    >
      {feed.status === "loading" && <RailSkeleton />}
      {feed.status === "error" && <RailError onRetry={feed.refetch} />}
      {feed.status === "empty" && <RailEmpty />}
      {feed.status === "success" && <RailContent cards={feed.data} />}
    </aside>
  );
}

/** success — 현황 + 최근 보고서. 집계는 순수 함수 2개로 한 번만 계산한다. */
function RailContent({ cards }: { cards: Parameters<typeof toMyReportsSummary>[0] }) {
  const summary = toMyReportsSummary(cards);
  // 3건: handoff 의 rail 리스트 패널(`오늘의 핵심 신호`·`관련 브리핑`)이 모두 3행 밀도를 쓴다.
  const recent = pickRecentReports(cards, 3);

  return (
    <>
      <Panel title="내 보고서 현황">
        <Stat label="전체 보고서" value={`${summary.total}건`} first />
        <Stat label="공개" value={`${summary.publicCount}건`} />
        <Stat label="비공개" value={`${summary.privateCount}건`} />
        {/* 정상 응답에서는 0 이라 나타나지 않는다. 합이 어긋날 때만 사실대로 드러낸다. */}
        {summary.unknownVisibility > 0 && (
          <Stat label="공개 범위 미확인" value={`${summary.unknownVisibility}건`} />
        )}
        {summary.latestCreatedLabel !== null && (
          <Stat label="최근 작성" value={summary.latestCreatedLabel} />
        )}
        {/* `/reports` 진입은 rail 에서 이 한 곳에만 둔다(아래 패널에 반복하지 않는다). */}
        <Link
          href="/reports"
          className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-background"
        >
          전체 보고서 보기 →
        </Link>
      </Panel>

      {recent.length > 0 && (
        <Panel title="최근 내 보고서">
          <ul>
            {recent.map((card, i) => (
              <li
                key={card.publicId}
                className={`border-t border-border ${i === 0 ? "border-t-0 pt-px" : ""}`}
              >
                <Link
                  href={`/report/${card.publicId}`}
                  className="focus-ring flex items-start gap-2.5 rounded-[6px] py-[9px] hover:bg-background"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[11px] text-muted-foreground"
                  >
                    ◉
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* 300px 폭에서 긴 제목은 2줄로 자른다(가짜 요약·말줄임 문구 생성 없음). */}
                    <span className="line-clamp-2 text-[12.5px] leading-[1.4] font-semibold text-foreground">
                      {card.title}
                    </span>
                    {card.createdAtLabel && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {card.createdAtLabel}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

/**
 * empty — 가짜 0 통계를 두 패널로 그리지 않는다. handoff 의 첫 사용 rail 도 데이터 패널 대신
 * 다른 내용으로 바꾸는 방식이라, 여기서는 한 줄 안내만 남긴다. 중앙 `EmptyMyReports` 온보딩 CTA 와
 * 경쟁하지 않도록 rail 에는 CTA 를 두지 않는다(3열 레이아웃은 유지).
 */
function RailEmpty() {
  return (
    <Panel title="내 보고서 현황">
      <p className="pt-px text-[12.5px] leading-[1.6] text-muted-foreground">
        아직 집계할 보고서가 없어요. 첫 브리핑이 만들어지면 여기에서 현황을 볼 수 있어요.
      </p>
    </Panel>
  );
}

/** error — 이전 값·mock 으로 대체하지 않고 rail 범위에서만 알린다. 재시도는 memberFeed.refetch 재사용. */
function RailError({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel title="내 보고서 현황">
      <div role="alert" className="pt-px">
        <p className="text-[12.5px] leading-[1.6] text-ink-mid">
          현황을 불러오지 못했어요. 일시적인 문제일 수 있어요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-2.5 inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-background"
        >
          다시 시도
        </button>
      </div>
    </Panel>
  );
}

/** loading — 중립 placeholder. 실제 제목·수치·개인 데이터를 먼저 노출하지 않는다. */
function RailSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-[14px] border border-border bg-card px-4 py-[15px]"
    >
      <div className={`mb-4 h-3.5 w-24 ${bar}`} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2">
          <div className={`h-3 w-20 ${bar}`} />
          <div className={`h-3 w-10 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

/** .rpanel — rail 패널 껍데기. 제목은 heading 으로 둬 rail 이 문서 구조에 잡히게 한다. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
      <h2 className="mb-[15px] text-[13px] font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** .rstat — label ↔ 값 한 줄. 첫 행은 위 구분선을 없앤다(handoff `:first-of-type` 규칙). */
function Stat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-border py-2 text-[12.5px] text-ink-mid ${
        first ? "border-t-0 pt-px" : ""
      }`}
    >
      <span className="shrink-0">{label}</span>
      <b className="min-w-0 truncate font-bold text-foreground">{value}</b>
    </div>
  );
}
