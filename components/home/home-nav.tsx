"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { useRequireAuth } from "@/components/auth/use-require-auth";
import { Orb } from "@/components/brand/orb";
import { MobileNavDrawer } from "@/components/home/mobile-navigation";
import { NotificationMenu } from "@/components/home/notification-menu";
import { MOCK_NAV } from "@/lib/mock/feed";

/**
 * 상단 nav — 인증 상태(§15)에 따라 분기.
 * - authenticated: 기존 로그인 헤더(검색 P1·＋관심자료·알림 P1·아바타 드롭다운[이름·이메일·로그아웃])
 * - guest: 검색·알림·아바타 숨김 · ＋관심자료(중립·hover 주황·클릭 시 GuestGateModal) · 로그인 · 가입하기(Primary)
 * - loading·error: 로그인 전용 정보(아바타·내 보고서)와 guest CTA 를 모두 숨긴 중립 헤더(로고만).
 *   인증 확정 전(loading)·확인 실패(error)에 잘못된 상태의 헤더를 노출하지 않는다.
 *
 * onAddOpen: authenticated 에서 관심 자료 추가 모달을 여는 콜백. guest 는 requireAuth 가
 * 가로채 GuestGateModal 을 띄우므로 실행되지 않는다.
 */
export function HomeNav({ onAddOpen }: { onAddOpen: () => void }) {
  const { status } = useAuth();
  const { requireAuth } = useRequireAuth();
  const [navOpen, setNavOpen] = useState(false);
  const isMember = status === "authenticated";
  const isGuest = status === "guest";
  // loading·error 에는 내비 트리거를 노출하지 않는다(로고만) — SideLeft 도 그 상태에선 렌더되지 않는 맥락.
  const showNav = isMember || isGuest;

  return (
    <nav className="border-b border-border bg-card">
      {/* 데스크톱(≥1101px) gap-[18px]·px-6 그대로, SideLeft 가 숨는 ≤1100px 구간에서만 gap·padding 축소로 겹침 완화 */}
      <div className="relative mx-auto flex h-[58px] max-w-[1440px] items-center gap-2 px-4 min-[1101px]:gap-[18px] min-[1101px]:px-6">
        {/* 모바일·태블릿 메뉴 버튼 — SideLeft 가 숨는 ≤1100px 에서만 노출(데스크톱 숨김). drawer 트리거 */}
        {showNav && (
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="메뉴 열기"
            aria-haspopup="dialog"
            aria-expanded={navOpen}
            aria-controls="mobile-nav-drawer"
            className="focus-ring -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[18px] text-ink-mid hover:bg-background min-[1101px]:hidden"
          >
            ☰
          </button>
        )}

        {/* .logo — 홈 링크(헤더에서 홈 도달 경로 확보). 워드마크는 아주 좁은 폭에서만 숨겨 겹침 방지(Orb 유지) */}
        <Link
          href="/"
          aria-label="홈"
          className="focus-ring flex shrink-0 items-center gap-[9px] rounded-lg"
        >
          <Orb size={26} />
          <span className="text-[17px] font-normal tracking-[.02em] text-foreground [font-family:Quicksand,sans-serif] max-[520px]:hidden">
            alphacatcher
          </span>
        </Link>
        <div className="flex-1" />

        {isMember ? (
          <MemberNavRight onAddOpen={onAddOpen} />
        ) : isGuest ? (
          <GuestNavRight onAdd={() => requireAuth(onAddOpen)} />
        ) : null /* loading·error → 중립(로고만) */}
      </div>

      {/* SideLeft 가 사라지는 ≤1100px 대체 내비. 데스크톱에서는 트리거가 숨겨져 열리지 않는다. */}
      {showNav && (
        <MobileNavDrawer open={navOpen} onClose={() => setNavOpen(false)} guest={isGuest} />
      )}
    </nav>
  );
}

/** 비로그인(guest·error) 우측: ＋관심자료(중립·게이트) · 로그인 · 가입하기(Primary). */
function GuestNavRight({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      {/* ＋ 관심 자료 — 중립 기본, hover 시 테두리·문자만 주황. 클릭 시 GuestGateModal. 좁은 폭에서는 ＋ 아이콘만 */}
      <button
        type="button"
        onClick={onAdd}
        aria-label="관심 자료 추가"
        className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:border-primary hover:text-signal-ink"
      >
        ＋<span className="max-[520px]:hidden"> 관심 자료</span>
      </button>
      {/* 로그인 — 보조 (핵심 guest CTA 라 좁은 폭에서도 텍스트 유지·축소 금지) */}
      <Link
        href="/login"
        className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-foreground hover:bg-background"
      >
        로그인
      </Link>
      {/* 가입하기 — Primary (좁은 폭에서도 텍스트 유지·축소 금지) */}
      <Link
        href="/signup"
        className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
      >
        가입하기
      </Link>
    </>
  );
}

/** 로그인 사용자 우측: 검색(P1) · ＋관심자료 · 알림(P1) · 아바타 드롭다운. */
function MemberNavRight({ onAddOpen }: { onAddOpen: () => void }) {
  return (
    <>
      {/* .nav-search — P1(검색), 시각 전용. 기능 미구현 placeholder 라 ≤1100px 에서는 숨겨 헤더 겹침을 없앤다
          (absolute 중앙 배치가 좁은 폭에서 우측 CTA·알림·아바타와 겹치던 원인). 데스크톱에서만 노출. */}
      <div
        aria-disabled="true"
        className="absolute top-1/2 left-1/2 flex h-[38px] w-[596px] max-w-[calc(100%-380px)] -translate-x-1/2 -translate-y-1/2 items-center gap-[9px] rounded-[19px] border border-border bg-background px-[15px] text-[13px] text-muted-foreground max-[1100px]:hidden"
      >
        {/* .sico */}
        <span className="relative h-[13px] w-[13px] shrink-0 rounded-full border-[1.5px] border-low after:absolute after:-right-1 after:-bottom-0.5 after:h-[1.5px] after:w-[5px] after:rotate-45 after:bg-low after:content-['']" />
        {MOCK_NAV.searchPlaceholder}
      </div>

      {/* .btn.signal.sm — 관심 자료 추가 모달 (실동작). 좁은 폭에서는 텍스트를 접고 ＋ 아이콘만(접근 이름은 aria-label 로 유지) */}
      <button
        type="button"
        onClick={onAddOpen}
        aria-label="관심 자료 추가"
        className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
      >
        ＋<span className="max-[520px]:hidden"> 관심 자료</span>
      </button>

      <NotificationMenu />

      <AvatarMenu />
    </>
  );
}

/** .nav-avatar + 최소형 드롭다운(이름·이메일·로그아웃). 프로필·설정 등 미구현 메뉴는 추가하지 않는다. */
function AvatarMenu() {
  const { user, logoutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = user?.displayName?.trim()?.[0] ?? MOCK_NAV.avatarInitial;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="내 계정"
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring flex h-[34px] w-[34px] items-center justify-center rounded-full border border-input bg-background text-[12.5px] font-bold text-ink-mid hover:border-wash-strong"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_40px_rgba(10,12,15,.2)]"
        >
          {/* 사용자 정보 */}
          <div className="px-2.5 py-2">
            <div className="truncate text-[13.5px] font-bold text-foreground">
              {user?.displayName ?? "사용자"}
            </div>
            {user?.email && (
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{user.email}</div>
            )}
          </div>
          <div className="my-1 h-px bg-border" />
          {/* 로그아웃 — 토큰 제거 후 guest 전환. 네비게이션하지 않아 현재 공개 화면 유지 */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logoutUser();
            }}
            className="focus-ring w-full rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-foreground hover:bg-background"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
