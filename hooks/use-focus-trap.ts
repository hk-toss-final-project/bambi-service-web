"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const INERT_TARGET_ID = "app-shell";

// 배경 inert 상태(모듈 단일) — 두 모달이 동시에 열려도 안전하도록 참조 카운트로 관리한다.
let inertRefCount = 0;
let inertRestore: { inert: boolean; ariaHidden: string | null } | null = null;

function focusableWithin(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
}

/** #app-shell 을 inert + aria-hidden="true" 처리 — 첫 모달에서만 이전 값 저장 후 적용. */
function acquireBackgroundInert(): void {
  const target = document.getElementById(INERT_TARGET_ID);
  if (!target) return;
  if (inertRefCount === 0) {
    inertRestore = { inert: target.inert, ariaHidden: target.getAttribute("aria-hidden") };
    target.inert = true;
    target.setAttribute("aria-hidden", "true");
  }
  inertRefCount += 1;
}

/** 배경 inert 해제 — 마지막 모달에서만 저장했던 이전 값으로 정확히 복원. */
function releaseBackgroundInert(): void {
  if (inertRefCount === 0) return;
  inertRefCount -= 1;
  if (inertRefCount > 0) return;
  const target = document.getElementById(INERT_TARGET_ID);
  if (target && inertRestore) {
    target.inert = inertRestore.inert;
    if (inertRestore.ariaHidden === null) target.removeAttribute("aria-hidden");
    else target.setAttribute("aria-hidden", inertRestore.ariaHidden);
  }
  inertRestore = null;
}

/**
 * 모달 접근성 공통 훅 — AddMaterialModal · GuestGateModal 이 재사용한다.
 * 모달은 createPortal 로 #app-shell 바깥(document.body)에 렌더되어 아래 inert 대상이 아니어야 한다.
 *
 * open 인 동안:
 * - 열기 직전 포커스(트리거)를 저장한다(초기 포커스 이동 전에 캡처 — autoFocus 가 트리거를 가로채지 않도록 훅이 초기 포커스도 담당).
 * - 배경(#app-shell)을 inert + aria-hidden="true" 처리한다(키보드·스크린리더에서 배경 제외, 참조 카운트).
 * - 초기 포커스를 컨테이너의 [data-autofocus] (없으면 첫 포커스 대상)로 옮긴다.
 * - Tab / Shift+Tab 을 컨테이너 내부로 순환시킨다.
 *
 * 닫힘(cleanup) 순서: 리스너 제거 → 배경 inert 해제 → 트리거로 포커스 복원.
 * (inert 해제를 먼저 해야 #app-shell 안의 트리거가 다시 포커스 가능해진다.) Esc·backdrop 닫기는 각 모달이 처리한다.
 */
export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  containerRef: RefObject<T | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const current = containerRef.current;
    if (!current) return;
    const node = current;

    // 초기 포커스 이동 전에 트리거 캡처.
    const trigger = document.activeElement as HTMLElement | null;

    acquireBackgroundInert();

    // 초기 포커스: data-autofocus 지정 요소 → 없으면 첫 포커스 대상.
    const initial = node.querySelector<HTMLElement>("[data-autofocus]") ?? focusableWithin(node)[0];
    initial?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = focusableWithin(node);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      releaseBackgroundInert();
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open, containerRef]);
}
