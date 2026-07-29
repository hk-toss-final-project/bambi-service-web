"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERROR_CODES, resolveErrorMessage } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { login, signup } from "@/lib/auth";

/** 자동 로그인 성공 후 이동 경로 (홈 피드). */
const REDIRECT_AFTER_SIGNUP = "/";
/** 자동 로그인 실패 시 이동 경로 — 가입은 성공했음을 로그인 화면에서 안내. */
const LOGIN_WITH_NOTICE = "/login?signedUp=1";

/** 목업 .auth .field input 과 동일한 외형 (login-form 과 동일 값). */
const FIELD_INPUT_CLASS =
  "h-[46px] rounded-[10px] bg-card pl-3.5 pr-[42px] text-sm text-foreground placeholder:text-low focus-visible:ring-[3px] focus-visible:ring-wash dark:bg-card";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
};

export function SignupForm() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit =
    displayName.trim() !== "" && email.trim() !== "" && password !== "" && !submitting;

  /** API 타기 전 화면 검증 — 이메일 형식 · 비밀번호 8자 이상 (VALIDATION_ERROR는 최후 안전망). */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (displayName.trim() === "") errors.displayName = "이름을 입력해 주세요.";
    if (email.trim() === "") errors.email = "이메일을 입력해 주세요.";
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "이메일 형식이 올바르지 않아요.";
    if (password.length < 8) errors.password = "비밀번호는 8자 이상 입력해 주세요.";
    return errors;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return; // 중복 제출 방지 (버튼 disabled 외 2차 안전장치)

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const credentials = { email: email.trim(), password };

    // 1) 가입
    try {
      await signup({ ...credentials, displayName: displayName.trim() });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ERROR_CODES.INTERNAL_ERROR;
      if (code === ERROR_CODES.DUPLICATE_RESOURCE) {
        // 가장 흔한 실패 — 이메일 필드에 인라인 ("이미 가입된 이메일이에요.")
        setFieldErrors({ email: resolveErrorMessage(code) });
      } else {
        setFormError(resolveErrorMessage(code));
      }
      setSubmitting(false);
      return;
    }

    // 2) 가입 성공 → 같은 자격증명으로 자동 로그인 (flow B)
    try {
      const data = await login(credentials); // 성공 시 토큰 저장은 login() 내부에서
      setAuthenticatedUser(data.user); // 응답 user 로 인증 상태 즉시 반영
      router.push(REDIRECT_AFTER_SIGNUP);
    } catch {
      // 가입은 완료된 상태 — 재가입을 유도하지 않고 로그인 화면에서 안내한다.
      router.push(LOGIN_WITH_NOTICE);
    }
    // 이동 중 재제출 방지를 위해 submitting 은 유지한다.
  }

  function fieldErrorId(name: keyof FieldErrors): string | undefined {
    return fieldErrors[name] ? `signup-${name}-error` : undefined;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* .field — 이름 (displayName, §7-1 확정: 목업에 없어 동일 패턴으로 추가) */}
      <div className="mb-4 text-left">
        <label
          htmlFor="signup-name"
          className="mb-[7px] block text-[13px] font-semibold text-foreground"
        >
          이름
        </label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="nickname"
          placeholder="이름 입력"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
          }}
          disabled={submitting}
          aria-invalid={fieldErrors.displayName ? true : undefined}
          aria-describedby={fieldErrorId("displayName")}
          className={FIELD_INPUT_CLASS}
        />
        {fieldErrors.displayName && (
          <p id="signup-displayName-error" className="mt-[6px] text-[11.5px] text-destructive">
            {fieldErrors.displayName}
          </p>
        )}
      </div>

      {/* .field — 이메일 */}
      <div className="mb-4 text-left">
        <label
          htmlFor="signup-email"
          className="mb-[7px] block text-[13px] font-semibold text-foreground"
        >
          이메일
        </label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          disabled={submitting}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrorId("email")}
          className={FIELD_INPUT_CLASS}
        />
        {fieldErrors.email && (
          <p id="signup-email-error" className="mt-[6px] text-[11.5px] text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* .field — 비밀번호 (.hint 는 에러 시 에러로 대체) */}
      <div className="mb-4 text-left">
        <label
          htmlFor="signup-password"
          className="mb-[7px] block text-[13px] font-semibold text-foreground"
        >
          비밀번호
        </label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="비밀번호 만들기"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={submitting}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrorId("password") ?? "signup-password-hint"}
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
        {fieldErrors.password ? (
          <p id="signup-password-error" className="mt-[6px] text-[11.5px] text-destructive">
            {fieldErrors.password}
          </p>
        ) : (
          <p id="signup-password-hint" className="mt-[6px] text-[11.5px] text-muted-foreground">
            8자 이상, 영문과 숫자를 함께 사용해 주세요.
          </p>
        )}
      </div>

      {/* 폼 수준 에러 — DUPLICATE_RESOURCE 외 API 에러 (code → 문구, 원문 비노출) */}
      {formError && (
        <p
          role="alert"
          aria-live="assertive"
          className="mb-3 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      {/* .auth-btn.signal.auth-cta */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="mt-[6px] mb-2.5 flex h-[46px] w-full gap-[9px] rounded-[10px] border-primary text-[14.5px] font-semibold hover:bg-primary hover:brightness-[.96]"
      >
        {submitting ? "가입 중…" : "계속하기"}
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
