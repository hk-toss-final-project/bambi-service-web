"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveErrorMessage } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { login } from "@/lib/auth";

/** 로그인 성공 후 이동 경로 (홈 피드). */
const REDIRECT_AFTER_LOGIN = "/";

/** 목업 .auth .field input 과 동일한 외형 (h46 · r10 · pr42 · placeholder --low · focus wash 링). */
const FIELD_INPUT_CLASS =
  "h-[46px] rounded-[10px] bg-card pl-3.5 pr-[42px] text-sm text-foreground placeholder:text-low focus-visible:ring-[3px] focus-visible:ring-wash dark:bg-card";

export function LoginForm() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasError = errorMessage !== null;
  const canSubmit = email.trim() !== "" && password !== "" && !submitting;
  // 폼 레벨 오류(자격 증명 불일치 등)는 어느 필드가 틀렸는지 알 수 없다 → 개별 필드를 invalid 로 표시하지 않고
  // 두 입력에 오류 문구를 describedby 로 연결만 한다(A-4). 필드 단위 검증 오류가 생기면 그때 aria-invalid 를 쓴다.
  const errorId = "login-error";
  const describedBy = hasError ? errorId : undefined;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return; // 중복 제출 방지 (버튼 disabled 외 2차 안전장치)

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const data = await login({ email: email.trim(), password });
      // 성공: accessToken 저장은 login() 내부에서 완료. 응답에 동봉된 user 로 인증 상태를
      // 즉시 반영해(getMe 재호출 없이) 헤더 등이 바로 authenticated 로 갱신되게 한다.
      setAuthenticatedUser(data.user);
      // 홈으로 이동하고 submitting 상태를 유지해(재활성화하지 않음) 이동 중 재제출을 막는다.
      router.push(REDIRECT_AFTER_LOGIN);
    } catch (err) {
      // 공통 client가 실패를 ApiError(code)로 던진다. 서버 message 원문은 쓰지 않는다.
      const code = err instanceof ApiError ? err.code : "INTERNAL_ERROR";
      setErrorMessage(resolveErrorMessage(code));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* .field — 이메일 */}
      <div className="mb-4 text-left">
        <label
          htmlFor="login-email"
          className="mb-[7px] block text-[13px] font-semibold text-foreground"
        >
          이메일
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-describedby={describedBy}
          className={FIELD_INPUT_CLASS}
        />
      </div>

      {/* .field — 비밀번호 (.frow: 라벨 + 비밀번호 찾기) */}
      <div className="mb-4 text-left">
        <div className="mb-[7px] flex items-center justify-between">
          <label htmlFor="login-password" className="block text-[13px] font-semibold text-foreground">
            비밀번호
          </label>
          {/* .link — 시각 전용, 기능 미연결(P1) */}
          <button
            type="button"
            aria-disabled="true"
            className="text-xs font-semibold text-signal-ink"
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            aria-describedby={describedBy}
            className={FIELD_INPUT_CLASS}
          />
          {/* .eye */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={submitting}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            aria-pressed={showPassword}
            // tabIndex={-1} 제거 — 키보드만 쓰는 사용자도 표시/숨기기에 도달할 수 있어야 한다(A-5).
            className="focus-ring absolute top-1/2 right-[13px] inline-flex -translate-y-1/2 rounded-[6px] text-muted-foreground disabled:opacity-50"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* 에러 — 목업에 별도 스펙 없음. §4 인라인 에러 (code → 문구, 원문 비노출) */}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mb-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {/* .auth-btn.signal.auth-cta */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="mt-[6px] mb-2.5 flex h-[46px] w-full gap-[9px] rounded-[10px] border-primary text-[14.5px] font-semibold hover:bg-primary hover:brightness-[.96]"
      >
        {submitting ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
