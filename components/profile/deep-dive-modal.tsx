"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useWikiInterests } from "@/hooks/use-wiki-interests";
import { ApiError } from "@/lib/api-client";
import { resolveErrorMessage } from "@/constants/errors";
import { generateDeepDiveReport } from "@/lib/repositories/generation";
import type { WikiTag } from "@/types/wiki";

/**
 * 관심사 깊게 파기 모달 — 내 프로필 헤더에서 연다(2026-08-10 우석·기용, 위치는 기용 제안).
 *
 * 위키 관심사 1개를 골라 **연결 노드 묶음까지 통합 서술하는 범주 리포트**를 접수한다
 * (service-api #72 → agent generation_scope=INTEREST_BUNDLE). 온디맨드 topic 경로와 달리
 * 보낼 값이 이름이 아니라 **tagId(위키 관심사 UUID)** 라서, 자유 입력 없이 목록 선택만 받는다.
 *
 * 성공은 접수 확인일 뿐이다 — 완료를 약속하는 문구(소요 시간 등)를 쓰지 않고,
 * 진행 확인처는 홈 [내 보고서] 처리중 슬롯으로 안내한다(저장 ≠ 생성 규약과 동일 태도).
 *
 * 호출부가 열릴 때만 마운트한다(`{open && <DeepDiveModal/>}`) — ProfileEditModal 과 같은 규약.
 */
export function DeepDiveModal({ onClose }: { onClose: () => void }) {
  const interests = useWikiInterests();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(true, dialogRef);

  // ESC 로 닫기 — 제출 중에는 닫지 않는다(ProfileEditModal 과 동일).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  function close() {
    if (!submitting) onClose();
  }

  // tagId 없는 태그는 고를 수 없다 — 계약상 tagId 가 비어 올 수 있고(호출부가 다룬다),
  // 깊게 파기는 tagId 로만 요청하므로 목록에서부터 제외한다(눌리는데 안 되는 행 금지).
  const selectable: WikiTag[] =
    interests.status === "success" ? interests.data.filter((t) => t.tagId.trim() !== "") : [];

  async function handleSubmit() {
    if (selectedId === null || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await generateDeepDiveReport({ interestTagId: selectedId });
      setAccepted(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INTEREST_NOT_FOUND") {
        // 위키 재계산으로 방금 고른 태그가 사라진 경우 — 목록을 다시 받아 재선택하게 한다.
        setSelectedId(null);
        interests.refetch();
        setErrorMessage(resolveErrorMessage(err.code));
      } else {
        setErrorMessage("요청을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
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
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="관심사 깊게 파기"
          onClick={(e) => e.stopPropagation()}
          className="w-[460px] max-w-full rounded-2xl border border-border bg-card px-6 py-[22px] shadow-[0_24px_60px_rgba(10,12,15,.28)]"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[16.5px] font-bold text-foreground">관심사 깊게 파기</span>
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

          {accepted ? (
            /* 접수 완료 — 완료 시점을 약속하지 않고 확인처만 안내한다. */
            <div className="pt-2 text-left">
              <p className="text-[14px] leading-[1.65] text-foreground">
                깊게 파기 보고서 생성을 접수했어요.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-foreground">
                분석이 끝나면 홈 [내 보고서]에 표시돼요. 진행 상태는 처리중 슬롯에서 확인할 수
                있어요.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                  닫기
                </Button>
                <Button asChild>
                  <Link href="/">홈에서 확인</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] leading-[1.6] text-muted-foreground">
                고른 관심사를 뿌리로, 내 위키에서 연결된 주제까지 한 장으로 깊게 정리해 드려요.
              </p>

              {interests.status === "loading" && (
                <div aria-busy="true" className="space-y-2 py-1" data-testid="dd-loading">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-[10px] bg-secondary" />
                  ))}
                </div>
              )}

              {interests.status === "error" && (
                <div role="alert" className="py-3 text-left text-[13px] leading-[1.6] text-ink-mid">
                  관심사 목록을 불러오지 못했어요.{" "}
                  <button
                    type="button"
                    onClick={interests.refetch}
                    className="focus-ring rounded-[3px] font-semibold text-signal-ink"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {(interests.status === "empty" ||
                (interests.status === "success" && selectable.length === 0)) && (
                <div className="py-3 text-left text-[13px] leading-[1.6] text-ink-mid">
                  아직 깊게 팔 관심사가 없어요. 자료를 저장하면 AI가 관심사를 이해하기 시작해요.
                </div>
              )}

              {interests.status === "success" && selectable.length > 0 && (
                /* 라디오 그룹 — 위키 화면과 같은 데이터(태그명 + score 상대 강도 바)만 보여준다. */
                <div role="radiogroup" aria-label="깊게 팔 관심사 선택" className="space-y-1.5">
                  {selectable.map((t) => {
                    const selected = t.tagId === selectedId;
                    return (
                      <button
                        key={t.tagId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={submitting}
                        onClick={() => {
                          setSelectedId(t.tagId);
                          setErrorMessage(null);
                        }}
                        className={`focus-ring flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left ${
                          selected
                            ? "border-primary bg-wash"
                            : "border-border bg-background hover:border-ink-mid"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
                          {t.tag}
                        </span>
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-[72px] shrink-0 overflow-hidden rounded-full bg-secondary"
                        >
                          <span
                            className="block h-full rounded-full bg-primary/70"
                            style={{ width: `${Math.round(Math.min(Math.max(t.score, 0), 1) * 100)}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {errorMessage && (
                <p role="alert" className="mt-3 text-[12.5px] leading-[1.6] text-destructive">
                  {errorMessage}
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={selectedId === null || submitting}
                  aria-busy={submitting}
                >
                  {submitting ? "접수 중…" : "깊게 파기 시작"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
