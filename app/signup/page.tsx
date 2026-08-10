import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Orb } from "@/components/brand/orb";

export const metadata: Metadata = {
  title: "AlphaCatcher — 가입 — 방식 선택",
  description: "밤새비서 계정을 만들고 내일 아침 첫 브리핑을 받아보세요.",
};

/**
 * 회원가입(방식 선택) — 목업 product/auth-signup-choice.html 1:1.
 * 목업의 choice 뷰는 뒤로 버튼이 비노출(visibility:hidden) → back 슬롯 생략.
 * 목업의 Google 버튼은 제거했다 — 소셜 로그인은 P2(범위 밖)라 백엔드가 없고,
 * 동작하지 않는 버튼을 남기지 않는다(CLAUDE.md §7-2 확인 항목 해소, 2026-08-10 우석 결정).
 * 그래서 현재 가입 방식은 "이메일로 계속하기" 하나다.
 */
export default function SignupChoicePage() {
  return (
    <AuthShell>
      {/* .auth-orb */}
      <div className="mx-auto mb-5 h-[46px] w-[46px]">
        <Orb size={46} />
      </div>
      {/* .auth-title */}
      <h1 className="mb-[9px] text-[25px] font-bold tracking-[-0.015em] text-foreground">
        시작하기
      </h1>
      {/* .auth-sub */}
      <p className="mb-7 text-sm leading-[1.65] text-muted-foreground">
        내일 아침, 첫 브리핑이 도착해요.
      </p>

      {/* .auth-btn.signal — 실제 이동 */}
      <Link
        href="/signup/email"
        className="mb-2.5 flex h-[46px] w-full items-center justify-center gap-[9px] rounded-[10px] border border-primary bg-primary text-[14.5px] font-semibold text-primary-foreground transition-[filter] hover:brightness-[.96]"
      >
        이메일로 계속하기
      </Link>

      {/* .auth-switch */}
      <p className="mt-[22px] text-[13.5px] text-muted-foreground">
        이미 계정이 있으세요?
        <Link href="/login" className="ml-1.5 font-semibold text-signal-ink">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
