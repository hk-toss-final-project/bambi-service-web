"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { ERROR_CODES } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { createBookmark } from "@/lib/repositories/bookmark";
import type { CardResponse, CreateBookmarkRequest } from "@/types/feed";

/**
 * 관심 자료 추가 모달 — 목업 #am-modal 기반. 저장 = POST /api/bookmarks(인증).
 * url·content 중 최소 하나 필수(공백만 입력은 빈 값), title 선택. 성공(201) 시 card 를 즉시 받아
 * onSaved(card)로 상위에 알리고(홈은 member 피드 refetch), 입력 초기화 후 닫는다. 실패는 §4 공통 문구.
 *
 * guest 는 nav ＋버튼에서 requireAuth 가 GuestGateModal 로 가로채므로 이 모달은 열리지 않는다
 * (열리는 시점은 항상 authenticated).
 *
 * 이 모달은 관심 자료 저장만 담당한다. 온디맨드 보고서 생성은 홈 우측 rail 에서 관심사를
 * 선택하는 별도 흐름으로 제공한다.
 */
const FIELD_CLASS =
  "h-[46px] rounded-[10px] bg-card px-3.5 text-sm text-foreground placeholder:text-low focus-visible:ring-[3px] focus-visible:ring-wash dark:bg-card";

const URL_MAX = 2048;
const TITLE_MAX = 500;

/**
 * 저장(POST /api/bookmarks) 문맥의 오류 문구 — 도메인 override.
 * 전역 매핑(constants/errors.ts · resolveErrorMessage)은 회원가입 등 다른 도메인과 공유하므로
 * 바꾸지 않고, 저장 문맥에서만 문구를 재정의한다. 전역 DUPLICATE_RESOURCE 는
 * "이미 가입된 이메일이에요."라 URL 중복 저장(409)에 맞지 않는다 → 저장용 문구로 override.
 */
function resolveBookmarkSaveError(code: string): string {
  if (code === ERROR_CODES.DUPLICATE_RESOURCE) return "이미 저장한 자료예요.";
  return "자료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function AddMaterialModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (card: CardResponse) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

  // 포커스 트랩 + 배경(#app-shell) inert + 트리거 복원. 초기 포커스는 url 입력의 data-autofocus.
  // 모달은 아래 createPortal 로 #app-shell 바깥(document.body)에 렌더한다.
  useFocusTrap(open, dialogRef);

  // url·content 중 하나 이상 비공백일 때만 제출 가능(백엔드 검증과 동일 기준). 공백만 입력은 무효.
  const canSubmit = (url.trim() !== "" || content.trim() !== "") && !submitting;
  const hasError = errorMessage !== null;

  // ESC 로 닫기 — 제출 중에는 닫지 않는다(중복 제출·유실 방지). setState 는 콜백 안에서만 호출.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        setUrl("");
        setTitle("");
        setContent("");
        setErrorMessage(null);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  function resetFields() {
    setUrl("");
    setTitle("");
    setContent("");
    setErrorMessage(null);
  }

  function close() {
    if (submitting) return; // 제출 중 닫기 차단
    resetFields();
    onClose();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return; // 무효 입력·제출 중 → 무시(중복 제출 방지)

    setErrorMessage(null);
    setSubmitting(true);

    // optional 필드는 공백이면 전송에서 생략한다(계약: url?/title?/content?).
    const req: CreateBookmarkRequest = {};
    if (url.trim() !== "") req.url = url.trim();
    if (title.trim() !== "") req.title = title.trim();
    if (content.trim() !== "") req.content = content.trim();

    try {
      const data = await createBookmark(req);
      onSaved?.(data.card); // 홈: member 피드 refetch → 새 카드 반영
      resetFields();
      setSubmitting(false);
      onClose();
    } catch (err) {
      // 공통 client 가 ApiError(code)로 던진다. 서버 message 원문은 노출하지 않는다(§4).
      const code = err instanceof ApiError ? err.code : ERROR_CODES.INTERNAL_ERROR;
      setErrorMessage(resolveBookmarkSaveError(code));
      setSubmitting(false); // 재시도 가능하도록 재활성화(입력 유지)
    }
  }

  return createPortal(
    // .modal-bg — 세로로 넘치면 backdrop 이 스크롤되어 모달 전체(footer 포함)에 도달. 배경·여백 클릭 시 닫기(제출 중 제외).
    // createPortal 로 #app-shell 바깥(document.body)에 렌더.
    <div
      className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-[rgba(12,14,17,.45)]"
      onClick={close}
    >
      {/* 세로 중앙 정렬 + 상하 여백. 콘텐츠가 viewport 보다 크면(320px·200% 줌) min-h-full + 바깥 스크롤로 상단 클리핑 없이 저장·취소까지 도달 */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* .modal */}
        <form
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="관심 자료 추가"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-[460px] max-w-full rounded-2xl border border-border bg-card px-6 py-[22px] shadow-[0_24px_60px_rgba(10,12,15,.28)]"
        >
        {/* .mhead */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[16.5px] font-bold text-foreground">관심 자료 추가</span>
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
        {/* .ms */}
        <p className="mb-3.5 text-[13px] leading-[1.65] text-ink-mid">
          링크나 메모를 저장해 두면, AI가 나를 이해하고 브리핑을 고르는 데 활용해요.
        </p>

        {/* 링크(URL) */}
        <div className="mb-3 text-left">
          <label htmlFor="am-url" className="mb-[7px] block text-[13px] font-semibold text-foreground">
            링크(URL)
          </label>
          <Input
            id="am-url"
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErrorMessage(null); // 입력 변경 시 이전 오류 초기화
            }}
            maxLength={URL_MAX}
            disabled={submitting}
            data-autofocus
            className={FIELD_CLASS}
          />
        </div>

        {/* 제목(선택) */}
        <div className="mb-3 text-left">
          <label htmlFor="am-title" className="mb-[7px] block text-[13px] font-semibold text-foreground">
            제목 <span className="font-normal text-muted-foreground">(선택)</span>
          </label>
          <Input
            id="am-title"
            type="text"
            placeholder="제목을 입력하면 카드에 함께 저장돼요"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrorMessage(null);
            }}
            maxLength={TITLE_MAX}
            disabled={submitting}
            className={FIELD_CLASS}
          />
        </div>

        {/* 메모 · 본문 */}
        <div className="mb-1.5 text-left">
          <label htmlFor="am-content" className="mb-[7px] block text-[13px] font-semibold text-foreground">
            메모 · 본문
          </label>
          <textarea
            id="am-content"
            placeholder="링크 없이 메모만 저장할 수도 있어요"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setErrorMessage(null);
            }}
            disabled={submitting}
            rows={3}
            className="min-h-[84px] w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-low focus-visible:ring-[3px] focus-visible:ring-wash disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card"
          />
        </div>
        {/* 검증 힌트 */}
        <p className="mb-3 text-[11.5px] text-muted-foreground">
          링크(URL)나 메모 중 하나는 입력해 주세요.
        </p>

        {/* .amopt.on — 저장하기 (기본 선택, 유일한 선택지) */}
        <div className="mb-[9px] flex items-start gap-[11px] rounded-xl border border-primary bg-wash px-3.5 py-[13px]">
          <span className="relative mt-px h-4 w-4 shrink-0 rounded-full border-[1.5px] border-primary after:absolute after:inset-[3px] after:rounded-full after:bg-primary after:content-['']" />
          <div>
            <div className="text-[13.5px] font-bold text-foreground">저장하기</div>
            <div className="mt-[3px] text-xs leading-[1.55] text-muted-foreground">
              다음 아침 브리핑부터 반영돼요.
            </div>
          </div>
        </div>

        {/* 에러 — §4 공통 문구(코드 기준, 서버 원문 비노출) */}
        {hasError && (
          <p
            role="alert"
            aria-live="assertive"
            className="mb-2.5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}

        {/* .mfoot */}
        <div className="mt-[18px] flex justify-end gap-[9px]">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-[15px] py-[9px] text-[13.5px] font-semibold whitespace-nowrap text-foreground hover:bg-background disabled:opacity-50"
          >
            취소
          </button>
          {/* 저장 — POST /api/bookmarks. 제출 중·무효 입력 시 비활성(중복 제출 방지). */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-primary bg-primary px-[15px] py-[9px] text-[13.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96] disabled:opacity-50"
          >
            {submitting ? "저장 중…" : "저장"}
          </button>
        </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
