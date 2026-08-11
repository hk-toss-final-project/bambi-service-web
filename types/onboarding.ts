/** POST /api/onboarding/complete 요청 — 사용자가 관심사를 선택한 정확한 순서. */
export type OnboardingCompleteRequest = {
  orderedInterestIds: number[];
};

/** Service가 접수한 온보딩 리포트 하나의 펜딩 정보. */
export type OnboardingReportDto = {
  slot: number;
  topic: string;
  pendingId: string;
  agentJobId: string | null;
};

/** POST /api/onboarding/complete 응답. 리포트는 최대 3개다. */
export type OnboardingCompleteResponse = {
  reports: OnboardingReportDto[];
};
