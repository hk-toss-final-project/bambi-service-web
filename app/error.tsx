"use client";

import { BrandHeader } from "@/components/ui/brand-header";
import { IconAlert } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { resolveErrorMessage } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";

/**
 * 전역 에러 바운더리 — 렌더 중 예외를 잡아 안내 + 재시도(reset)를 제공한다(§9 Error).
 *
 * 문구는 error 의 정규화 코드로 매핑한다(§4):
 *  - ApiError → 이미 정규화된 code(NOT_FOUND·FORBIDDEN·INTERNAL_ERROR 등)로 문구 결정
 *  - 그 외(일반 렌더 오류) → 미상 코드 → INTERNAL_ERROR 문구
 * 서버 error.message 원문은 절대 노출하지 않고 resolveErrorMessage 결과만 표시한다.
 * 인증 컨텍스트에 의존하지 않도록 최소 구성(BrandHeader)만 쓴다(에러 원인이 컨텍스트일 수 있음).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = resolveErrorMessage(error instanceof ApiError ? error.code : undefined);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BrandHeader />
      {/* 이 안내가 화면 본문 전체를 대체하므로 main 랜드마크 + 페이지 h1 이다(A-1·A-3). */}
      <main className="flex flex-1 items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          headingLevel="h1"
          className="w-[440px] max-w-full"
          icon={<IconAlert />}
          title="문제가 발생했어요"
          description={message}
          actions={[
            { label: "다시 시도", onClick: reset, variant: "primary" },
            { label: "홈으로", href: "/", variant: "ghost" },
          ]}
        />
      </main>
    </div>
  );
}
