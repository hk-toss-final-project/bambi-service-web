import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileScreen } from "@/components/profile/profile-screen";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AlphaCatcher — 프로필",
  description: "공개 프로필과 공개 브리핑.",
};

/**
 * 공개 프로필 — /users/[publicId]. 게스트 열람 허용(공개 데이터).
 * 서버는 id 형식만 판정한다: UUID 가 아니면 존재할 수 없는 사용자 → 404.
 * 존재 여부·팔로우 상태는 클라이언트가 API 로 확인한다(카드 상세와 동일 패턴).
 */
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!isUuid(publicId)) notFound();
  return <ProfileScreen publicId={publicId} />;
}
