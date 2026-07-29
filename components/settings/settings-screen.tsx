"use client";

import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { useTheme } from "@/components/theme/theme-provider";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import type { ThemeMode } from "@/lib/theme";

const SETTINGS_MENU_LABEL = "설정";

/**
 * 설정 — member 전용(§15). 화면 구조·스타일은 docs/design-handoff/product/settings.html 의
 * `.set-sec`/`.srow` 섹션-행 구조를 따른다. 기능은 지금 실제 지원 가능한 것만 포함한다:
 * 테마(라이트/다크/시스템), 계정 이메일(읽기 전용, auth user), 로그아웃.
 *
 * 목업의 브리핑·공개범위·이메일 변경·비밀번호 변경·회원 탈퇴·요금제 레일은 실 API·비활성 표현이 없어 제외한다
 * (동작하지 않는 토글·버튼을 만들지 않는다).
 *
 * 인증 상태 4분기(홈·상세와 동일 패턴): loading→스켈레톤 / error→복원오류 / guest→접근제한 / authenticated→본문.
 */
export function SettingsScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <SettingsSkeleton />;
  if (status === "error") return <SettingsAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <SettingsAccessRestricted />;
  return <SettingsView />;
}

/** 본문 — authenticated 에서만 도달. 계정 정보는 auth user 를 그대로 쓴다(가짜 필드 없음). */
function SettingsView() {
  const { user, logoutUser } = useAuth();
  const router = useRouter();
  const [amOpen, setAmOpen] = useState(false);

  const email = user?.email ?? "";

  // 로그아웃 = 로컬 토큰 제거 + guest 전환(기존 logoutUser) → 공개 홈(/)으로 이동.
  function handleLogout() {
    logoutUser();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft current={SETTINGS_MENU_LABEL} footLines={[]} />

          <main className="min-w-0 max-w-[760px] flex-1">
            {/* .set-head */}
            <div className="mb-4">
              <h1 className="text-[22px] font-bold tracking-[-0.015em] text-foreground">설정</h1>
              <p className="mt-[5px] text-[13px] leading-[1.6] text-muted-foreground">
                계정과 화면 테마를 관리해요.
              </p>
            </div>

            {/* .set-sec — 테마 */}
            <SettingsSection title="테마">
              <SettingsRow
                label="화면 테마"
                description="시스템을 선택하면 기기 설정을 따라가요."
                control={<ThemeModeSegment />}
              />
            </SettingsSection>

            {/* .set-sec — 계정 (실 API 있는 항목만: 이메일 표시 · 로그아웃) */}
            <SettingsSection title="계정">
              <SettingsRow label="이메일" description={<span className="break-all">{email}</span>} />
              <SettingsRow
                label="로그아웃"
                description="이 기기에서 로그아웃하고 공개 홈으로 이동해요."
                control={
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="focus-ring inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground hover:bg-background"
                  >
                    로그아웃
                  </button>
                }
              />
            </SettingsSection>
          </main>
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

/**
 * 화면 테마 선택 — 목업 `.kseg`/`.ks` 세그먼트 컨트롤. 선택 상태는 배경(카드)+그림자+글자색+aria-checked 로
 * 전달한다(색상만으로 구분하지 않음). ARIA radiogroup + roving tabindex(선택 항목만 tab 진입) + 방향키/Home/End.
 */
function ThemeModeSegment() {
  const { mode, setMode } = useTheme();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = THEME_OPTIONS.length;
    let next = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setMode(THEME_OPTIONS[next].value);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className="inline-flex shrink-0 gap-0.5 rounded-[9px] border border-border bg-accent p-0.5"
    >
      {THEME_OPTIONS.map((option, index) => {
        const selected = mode === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setMode(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`focus-ring inline-flex items-center whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-semibold transition-colors ${
              selected
                ? "bg-card text-foreground shadow-[var(--shadow)]"
                : "text-muted-foreground hover:text-ink-mid"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** .set-sec — 섹션 카드(제목 st2 + 행들). 제목은 heading 이어야 아웃라인(h1 → h2)이 성립한다(A-2). */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3.5 rounded-2xl border border-border bg-card px-[22px] py-1.5">
      <h2 className="pt-4 pb-1 text-[14.5px] font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** .srow — 좌측 라벨(t2)+설명(d2), 우측 컨트롤. 좁은 폭에서는 컨트롤이 아래로 자연 wrap. */
function SettingsRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 border-b border-border py-[15px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-foreground">{label}</div>
        {description != null && (
          <div className="mt-[3px] text-[12px] leading-[1.55] text-muted-foreground">{description}</div>
        )}
      </div>
      {control}
    </div>
  );
}

/** 인증 복원 중 — 중립 스켈레톤(개인 정보·CTA 없음). HomeNav 는 loading 상태라 로고만 렌더한다. */
function SettingsSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14" aria-hidden="true">
          <main className="min-w-0 max-w-[760px] flex-1">
            <div className={`mb-5 h-6 w-24 ${bar}`} />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="mb-3.5 animate-pulse rounded-2xl border border-border bg-card px-[22px] py-4">
                <div className={`mb-4 h-4 w-16 ${bar}`} />
                <div className={`mb-2 h-9 w-full ${bar}`} />
              </div>
            ))}
          </main>
        </div>
      </div>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공. member 화면을 대체 노출하지 않는다. */
function SettingsAuthError({ onRetry }: { onRetry: () => void }) {
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
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}

/** guest 접근 — 개인 설정이라 본문 대신 접근 제한만 안내한다(§15). 로그인 경로 제공. */
function SettingsAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="설정은 로그인한 사용자만 볼 수 있어요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
