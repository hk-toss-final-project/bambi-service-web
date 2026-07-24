import Link from "next/link";

import { Orb } from "@/components/brand/orb";

/**
 * 인증 화면 공통 셸 — 목업 auth-*.html의 .auth 레이아웃 1:1.
 * 좌: 브랜드 패널(.auth-r, ≤900px 숨김) / 우: 폼 칼럼(.auth-l, 뒤로+본문+푸터).
 * 로그인·가입(방식 선택)·가입(이메일) 세 화면이 공유한다.
 */
export function AuthShell({
  back,
  children,
}: {
  /** 뒤로 버튼 슬롯. 없으면 목업(.auth-back visibility:hidden)처럼 자리만 유지한다. */
  back?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen bg-card">
      {/* ── 브랜드 패널 (.auth-r) ── */}
      <aside className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-[linear-gradient(192deg,var(--wash)_0%,var(--background)_58%)] px-14 pt-[34px] pb-10 max-[900px]:hidden">
        {/* .rtop / .rbrand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Orb size={22} />
            <span className="text-[15px] font-normal text-foreground [font-family:Quicksand,sans-serif]">
              alphacatcher
            </span>
          </div>
        </div>

        {/* .auth-rmid */}
        <div className="m-auto w-full max-w-[430px]">
          {/* .rhead */}
          <h2 className="mb-5 text-left text-[23px] leading-[1.5] font-bold tracking-[-0.015em] text-foreground">
            밤사이 쌓인 소식,
            <br />
            아침 5분이면 충분해요.
          </h2>

          {/* .auth-preview */}
          <div className="rounded-2xl border border-border bg-card px-5 py-[18px] shadow-[0_10px_30px_rgba(20,22,25,.08)]">
            {/* .pv-head */}
            <div className="mb-[11px] flex items-center gap-[7px] text-xs font-semibold text-signal-ink">
              <span className="inline-flex h-3.5 w-3.5 shrink-0">
                <SunIcon />
              </span>
              오늘 아침 브리핑 · 7월 9일 · 5건
            </div>
            {/* .pv-title */}
            <div className="mb-[7px] text-base leading-[1.45] font-bold tracking-[-0.01em] text-foreground">
              밤사이 42건에서 5건을 골랐어요
            </div>
            {/* .pv-sum */}
            <div className="mb-2.5 text-[12.5px] leading-[1.6] text-ink-mid">
              환율·오픈소스 LLM·보유 종목이 오늘의 핵심. 각 항목은 왜 골랐는지 근거와 함께
              정리했어요.
            </div>
            <PreviewRow n="01" title="원/달러 환율 0.8% 하락 — 트리거 충족" meta="#환율 · 신뢰도 높음" />
            <PreviewRow n="02" title="오픈소스 LLM 릴리즈 2건" meta="#AI · 신뢰도 높음" />
            <PreviewRow n="03" title="관심 노트북 12% 할인" meta="#쇼핑 · 3개월 최저가" />
          </div>

          {/* .rcap */}
          <p className="mt-3.5 text-center text-[12.5px] text-ink-mid">
            매일 아침 <b className="font-bold text-signal-ink">7:00</b> · 관심사 기반으로 자동
            정리돼요
          </p>
        </div>
      </aside>

      {/* ── 폼 칼럼 (.auth-l) ── */}
      <div className="relative flex min-w-0 flex-1 flex-col px-14 pt-[30px] pb-7">
        {back ?? (
          /* .auth-back(비노출) — 목업처럼 자리만 유지 */
          <div aria-hidden="true" className="invisible self-start px-2.5 py-[7px] text-[13.5px]">
            뒤로
          </div>
        )}

        {/* .auth-body */}
        <div className="flex flex-1 items-center justify-center py-6">
          {/* .auth-form */}
          <div className="w-[360px] max-w-full text-center">{children}</div>
        </div>

        {/* .auth-footer */}
        <div className="flex justify-between gap-3 pt-4 text-[11.5px] text-muted-foreground">
          <span>매일 아침, 나에게 중요한 것만.</span>
          <span>© 2026 AlphaCatcher</span>
        </div>
      </div>
    </main>
  );
}

/**
 * .auth-back — 뒤로 버튼.
 * href 있으면 실제 네비게이션(Link), 없으면 시각 전용(aria-disabled, P1).
 */
export function AuthBack({ href }: { href?: string }) {
  const className =
    "focus-ring -ml-2.5 inline-flex items-center gap-[7px] self-start rounded-[9px] px-2.5 py-[7px] text-[13.5px] font-semibold text-ink-mid hover:bg-background hover:text-foreground";
  const inner = (
    <>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      뒤로
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-disabled="true" className={className}>
      {inner}
    </button>
  );
}

/** .pv-row — 브리핑 프리뷰 항목 */
function PreviewRow({ n, title, meta }: { n: string; title: string; meta: string }) {
  return (
    <div className="flex gap-2.5 border-t border-border py-[9px]">
      <span className="w-[15px] shrink-0 pt-0.5 text-[11px] font-semibold text-signal-ink [font-family:'Space_Grotesk',monospace]">
        {n}
      </span>
      <div>
        <div className="text-[13px] leading-[1.4] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}

/** .pv-head .sun — 브리핑 해 아이콘 (목업 SVG 그대로, 색만 토큰) */
function SunIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7" cy="7" r="2.8" className="fill-primary" />
      <g className="stroke-primary" strokeWidth={1.3} strokeLinecap="round">
        <line x1="7" y1="1" x2="7" y2="2.5" />
        <line x1="7" y1="11.5" x2="7" y2="13" />
        <line x1="1" y1="7" x2="2.5" y2="7" />
        <line x1="11.5" y1="7" x2="13" y2="7" />
      </g>
    </svg>
  );
}
