import { toArchiveCard } from "@/lib/adapters/report-archive";
import {
  MOCK_ARCHIVE_DEMO_ITEMS,
  MOCK_ARCHIVE_META_POOL,
  REPORT_ARCHIVE_MOCK_ENABLED,
} from "@/lib/mock/report-archive";
import type { ArchiveCard, ArchiveItem } from "@/types/report-archive";

/**
 * mock 병합 seam — 실데이터(ArchiveCard)와 mock 메타를 합쳐 화면 모델(ArchiveItem)을 만드는 **유일한 지점**.
 *
 * - 실 API 모드(기본 — NEXT_PUBLIC_REPORT_ARCHIVE_MOCK 미설정·"true" 아님): 실 카드만, mock=null → 화면은 실측 필드만 렌더.
 * - mock 모드(NEXT_PUBLIC_REPORT_ARCHIVE_MOCK="true" 명시 시에만, opt-in): 디자인 검증용 —
 *   1) 실 카드에는 메타 풀을 인덱스 순환으로 배정한다(실 publicId 를 미리 알 수 없어 "동일 publicId 병합"의
 *      실용적 대체 — 실 API 확정 시 서버 필드가 이 자리를 대체한다).
 *   2) 목업 수준의 화면 밀도를 위해 데모 항목(MOCK_ARCHIVE_DEMO_ITEMS)을 뒤에 붙인다.
 *      데모 publicId 는 기존 mock 상세(REPORT_REGISTRY) id 라 상세 이동까지 동작한다.
 *
 * 실 API 연결 시 교체 지점: 이 파일 전체를 삭제하고 hooks/use-report-archive.ts 가
 * 서버 응답 필드를 그대로 ArchiveItem 으로 변환하게 바꾼다.
 */
export function toArchiveItems(cards: ArchiveCard[]): ArchiveItem[] {
  if (!REPORT_ARCHIVE_MOCK_ENABLED) {
    return cards.map((card) => ({ ...card, mock: null }));
  }

  const merged: ArchiveItem[] = cards.map((card, i) => ({
    ...card,
    mock: MOCK_ARCHIVE_META_POOL[i % MOCK_ARCHIVE_META_POOL.length],
  }));

  const demo: ArchiveItem[] = MOCK_ARCHIVE_DEMO_ITEMS.map(({ card, meta }) => ({
    ...toArchiveCard(card),
    mock: meta,
  }));

  return [...merged, ...demo];
}
