"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { ApiError } from "@/lib/api-client";
import { updateMyProfile } from "@/lib/repositories/profile";
import type { Profile } from "@/types/profile";

const FIELD_CLASS =
  "h-11 rounded-[10px] border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground";

const BIO_MAX = 120; // 목업 profile-self.html 카운터(0/120) = 백엔드 @Size(max=120)와 동일
const NAME_MAX = 100;
const USERNAME_MAX = 30;

/**
 * 프로필 편집 모달 — 목업 profile-self.html 편집 모달의 3필드(이름·핸들·소개).
 * 사진 변경은 API 없음(P2) — 동작하지 않는 버튼을 만들지 않는다(§2 원칙).
 * 저장 성공 시 refreshAuth 로 전역 사용자(헤더 이름)까지 동기화한다.
 * 호출부가 열릴 때만 마운트한다(`{open && <ProfileEditModal/>}`) — 매 오픈마다 새로 마운트돼
 * 폼 초기값이 useState 초기자로 잡히고, effect 내 setState 리셋이 필요 없다(set-state-in-effect 금지).
 */
export function ProfileEditModal({
  profile,
  onClose,
  onSaved,
}: {
  /** 현재 프로필 — 폼 초기값. */
  profile: Profile;
  onClose: () => void;
  /** 저장 성공 시(프로필 재조회는 호출부 책임). */
  onSaved: () => void;
}) {
  const { refreshAuth } = useAuth();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

  useFocusTrap(true, dialogRef);

  // ESC 로 닫기 — 제출 중에는 닫지 않는다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const canSubmit = displayName.trim() !== "" && !submitting;

  function close() {
    if (!submitting) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await updateMyProfile({
        displayName: displayName.trim(),
        // 빈 핸들은 "변경 없음"(백엔드 규칙) — 지우기 기능이 아니다.
        username: username.trim() === "" ? null : username.trim(),
        bio: bio.trim() === "" ? null : bio.trim(),
      });
      await refreshAuth(); // 헤더 이름 등 전역 사용자 동기화
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_RESOURCE") {
        setErrorMessage("이미 사용 중인 핸들이에요. 다른 핸들을 입력해 주세요.");
      } else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        setErrorMessage("핸들은 영문 소문자·숫자·밑줄 3~30자로 입력해 주세요.");
      } else {
        setErrorMessage("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-[rgba(12,14,17,.45)]"
      onClick={close}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <form
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="프로필 편집"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-[460px] max-w-full rounded-2xl border border-border bg-card px-6 py-[22px] shadow-[0_24px_60px_rgba(10,12,15,.28)]"
        >
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-[16.5px] font-bold text-foreground">프로필 편집</span>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="닫기"
              className="focus-ring rounded-[7px] px-[7px] py-1 text-sm text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* 이름 */}
          <div className="mb-3 text-left">
            <label htmlFor="pe-name" className="mb-[7px] block text-[13px] font-semibold text-foreground">
              이름
            </label>
            <Input
              id="pe-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setErrorMessage(null);
              }}
              maxLength={NAME_MAX}
              disabled={submitting}
              data-autofocus
              className={FIELD_CLASS}
            />
          </div>

          {/* 핸들 */}
          <div className="mb-3 text-left">
            <label htmlFor="pe-username" className="mb-[7px] block text-[13px] font-semibold text-foreground">
              핸들
            </label>
            <Input
              id="pe-username"
              placeholder="예: parami_01 (영문 소문자·숫자·밑줄 3~30자)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMessage(null);
              }}
              maxLength={USERNAME_MAX}
              disabled={submitting}
              className={FIELD_CLASS}
            />
          </div>

          {/* 소개 */}
          <div className="mb-2 text-left">
            <label htmlFor="pe-bio" className="mb-[7px] block text-[13px] font-semibold text-foreground">
              소개
            </label>
            <textarea
              id="pe-bio"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setErrorMessage(null);
              }}
              maxLength={BIO_MAX}
              disabled={submitting}
              rows={3}
              className="focus-ring w-full resize-none rounded-[10px] border border-border bg-background px-3 py-2.5 text-[14px] leading-[1.6] text-foreground placeholder:text-muted-foreground"
            />
            <div className="mt-1 text-right text-[11.5px] text-muted-foreground">
              {bio.length} /{BIO_MAX}
            </div>
          </div>

          {/* 오류 — aria-live 로 낭독 */}
          {errorMessage && (
            <p role="alert" className="mb-2 text-[12.5px] leading-[1.6] text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
