"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Orb } from "@/components/brand/orb";
import type { GuestGateMode } from "@/components/auth/use-require-auth";
import { useFocusTrap } from "@/hooks/use-focus-trap";

/**
 * GuestGateModal — 인증 필요 액션 차단 시 뜨는 가입 유도/오류 안내 모달.
 * 목업 #guest-modal(variants/*-guest.html) 시각 언어 재현: Orb · 제목/설명 위계 ·
 * 가입하기 Primary / 로그인 Secondary / 계속 둘러볼게요 Tertiary. 폼 입력 없음.
 *
 * - signup: 가입 유도 (가입하기 → /signup, 로그인 → /login)
 * - error: 인증 상태 확인 실패 안내 + 다시 시도(onRetry)
 *
 * 접근성: role=dialog · aria-modal · aria-labelledby/describedby · 열릴 때 주 CTA 포커스 ·
 * Esc·backdrop 클릭으로 닫기.
 */
const AUTH_ROUTES = { signup: "/signup", login: "/login" } as const;

export function GuestGateModal({
  open,
  mode,
  onClose,
  onRetry,
}: {
  open: boolean;
  mode: GuestGateMode;
  onClose: () => void;
  onRetry: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  // 포커스 트랩 + 배경(#app-shell) inert + 트리거 복원. 초기 포커스는 주 CTA 의 data-autofocus.
  // 모달은 아래 createPortal 로 #app-shell 바깥(document.body)에 렌더한다.
  useFocusTrap(open, dialogRef);

  // Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isError = mode === "error";
  const title = isError ? "인증 상태를 확인하지 못했어요" : "계정이 필요한 기능이에요";
  const desc = isError
    ? "네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요. 공개 콘텐츠는 계속 볼 수 있어요."
    : "가입하면 관심사를 설정하고, 보고서를 저장하고, 댓글과 공유 기능을 사용할 수 있어요.";

  function goSignup() {
    onClose();
    router.push(AUTH_ROUTES.signup);
  }
  function goLogin() {
    onClose();
    router.push(AUTH_ROUTES.login);
  }

  const primaryBtn =
    "focus-ring flex h-[46px] w-full items-center justify-center gap-[9px] rounded-[10px] border border-primary bg-primary text-[14.5px] font-semibold text-primary-foreground hover:brightness-[.96]";
  const secondaryBtn =
    "focus-ring flex h-[46px] w-full items-center justify-center gap-[9px] rounded-[10px] border border-border bg-card text-[14.5px] font-semibold text-foreground hover:bg-background";

  return createPortal(
    // .modal-bg — backdrop(대비 강화), 클릭 시 닫기. createPortal 로 #app-shell 바깥(document.body)에 렌더.
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgba(12,14,17,.62)]"
      onClick={onClose}
    >
      {/* .modal */}
      <div
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        aria-labelledby="guest-gate-title"
        aria-describedby="guest-gate-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[calc(100%-48px)] rounded-2xl border border-border bg-card px-6 py-[26px] text-center shadow-[0_24px_60px_rgba(10,12,15,.28)]"
      >
        <div className="mx-auto mb-3.5 h-11 w-11">
          <Orb size={44} />
        </div>
        <div
          id="guest-gate-title"
          className="text-lg font-bold tracking-[-0.01em] text-foreground"
        >
          {title}
        </div>
        <p id="guest-gate-desc" className="mt-2 text-[13px] leading-[1.65] text-ink-mid">
          {desc}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {isError ? (
            <>
              <button data-autofocus type="button" onClick={onRetry} className={primaryBtn}>
                다시 시도
              </button>
              <button type="button" onClick={onClose} className={secondaryBtn}>
                계속 둘러볼게요
              </button>
            </>
          ) : (
            <>
              <button data-autofocus type="button" onClick={goSignup} className={primaryBtn}>
                가입하기
              </button>
              <button type="button" onClick={goLogin} className={secondaryBtn}>
                로그인
              </button>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring mt-0.5 text-[13px] text-muted-foreground hover:text-ink-mid"
              >
                계속 둘러볼게요
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
