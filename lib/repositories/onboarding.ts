import { apiPost } from "@/lib/api-client";
import type { OnboardingCompleteResponse } from "@/types/onboarding";

const ONBOARDING_COMPLETE_PATH = "/api/onboarding/complete";

/** 관심사 선택 순서를 확정하고 Service 소유의 첫 리포트 생성을 접수한다. */
export function completeOnboarding(
  orderedInterestIds: number[],
  signal?: AbortSignal,
): Promise<OnboardingCompleteResponse> {
  return apiPost<OnboardingCompleteResponse>(
    ONBOARDING_COMPLETE_PATH,
    { orderedInterestIds },
    { signal },
  );
}
