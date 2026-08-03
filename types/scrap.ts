/**
 * 스크랩 도메인 타입 (07-31 실측 기반).
 * 백엔드: GET /api/scraps · POST/DELETE /api/cards/{publicId}/scrap (전부 인증 필요)
 * 스크랩 = 남의 공개(PUBLIC) 카드 담기. 내 관심 자료 저장(bookmarks)과 다른 개념(§CLAUDE.md).
 */

/** GET /api/scraps 목록 항목 — 담아둔 공개 카드의 요약·태그·작성자. */
export type ScrapCard = {
  publicId: string;
  title: string;
  summary: string;
  tags: string[];
  author: { publicId: string | null; username: string | null; displayName: string | null };
  createdAt: string;
};

/** POST/DELETE /api/cards/{publicId}/scrap 의 data — 확정된 내 스크랩 상태. */
export type ScrapData = {
  scrapped: boolean;
};
