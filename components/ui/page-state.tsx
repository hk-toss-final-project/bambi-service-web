import type { ReactNode } from "react";

import { StateView, type StateAction } from "@/components/ui/state-view";

/**
 * 페이지 수준 상태 카드 래퍼 — 404·접근 제한처럼 화면 전체를 대체하는 안내(모달 아님).
 * 헤더 아래 남은 영역(≈ 100dvh − 헤더)을 세로 중앙 정렬하고, 카드 규격을 공통화한다:
 *   width min(100%, 440px) · 패딩 40/32 · 큰 제목/설명/CTA(StateView size="page").
 * 헤더(BrandHeader·HomeNav)는 호출부가 렌더한다. 이 래퍼는 flex-1 로 남은 높이를 채우므로
 * 부모는 `flex min-h-[100dvh] flex-col` 이어야 한다. 화면마다 레이아웃 스타일을 중복 작성하지 않는다.
 *
 * 접근성: 이 카드는 화면 본문을 통째로 대체하므로 `<main>` 랜드마크(A-3)이자 페이지의 유일한
 * 제목(h1, A-1)이다. 호출부가 이 래퍼를 다른 `<main>` 안에 넣지 않는다.
 */
export function PageState({
  icon,
  iconTone,
  title,
  description,
  actions,
  role,
}: {
  icon?: ReactNode;
  iconTone?: "neutral" | "brand";
  title: string;
  description?: ReactNode;
  actions?: StateAction[];
  role?: "status" | "alert";
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <StateView
        size="page"
        headingLevel="h1"
        className="w-[min(100%,440px)]"
        role={role}
        icon={icon}
        iconTone={iconTone}
        title={title}
        description={description}
        actions={actions}
      />
    </main>
  );
}
