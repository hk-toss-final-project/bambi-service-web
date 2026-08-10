import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthBack, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { LoginRedirectForm } from "@/components/auth/login-redirect-form";
import { SignupNotice } from "@/components/auth/signup-notice";
import { Orb } from "@/components/brand/orb";

export const metadata: Metadata = {
  title: "AlphaCatcher — 로그인",
  description: "밤새비서에 로그인하고 오늘 아침 브리핑을 받아보세요.",
};

/**
 * 로그인 화면 — 목업 product/auth-login.html 1:1.
 * 목업의 Google 버튼은 제거했다 — 소셜 로그인은 P2(범위 밖)라 백엔드가 없고,
 * 동작하지 않는 버튼을 남기지 않는다(CLAUDE.md §7-2 확인 항목 해소, 2026-08-10 우석 결정).
 * 비밀번호 찾기는 시각 요소만 목업대로 두고 기능 미연결(P1).
 * 뒤로는 공개 홈(`/`)으로 이동한다(history 유무와 무관하게 항상 `/`, §5 공개 홈).
 */
export default function LoginPage() {
  return (
    <AuthShell back={<AuthBack href="/" />}>
      {/* .auth-orb */}
      <div className="mx-auto mb-5 h-[46px] w-[46px]">
        <Orb size={46} />
      </div>
      {/* .auth-title */}
      <h1 className="mb-[9px] text-[25px] font-bold tracking-[-0.015em] text-foreground">
        로그인
      </h1>
      {/* .auth-sub */}
      <p className="mb-7 text-sm leading-[1.65] text-muted-foreground">다시 만나서 반가워요.</p>

      {/* 가입 직후 자동 로그인 실패 시 안내 (?signedUp=1) */}
      <Suspense fallback={null}>
        <SignupNotice />
      </Suspense>

      <Suspense fallback={<LoginForm />}>
        <LoginRedirectForm />
      </Suspense>

      {/* .auth-switch */}
      <p className="mt-[22px] text-[13.5px] text-muted-foreground">
        아직 계정이 없으세요?
        <Link href="/signup" className="ml-1.5 font-semibold text-signal-ink">
          가입하기
        </Link>
      </p>
    </AuthShell>
  );
}
