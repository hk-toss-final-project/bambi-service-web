import type { Metadata } from "next";

import { MyProfileGate } from "@/components/profile/my-profile-gate";

export const metadata: Metadata = {
  title: "AlphaCatcher — 내 프로필",
  description: "내 공개 브리핑이 쌓이는 프로필.",
};

/**
 * 내 프로필 — /profile. 내비 [프로필]의 정적 진입점.
 * 인증 사용자에서 publicId 를 꺼내 공개 프로필 화면(/users/[publicId]과 동일 컴포넌트)을 재사용한다.
 */
export default function MyProfilePage() {
  return <MyProfileGate />;
}
