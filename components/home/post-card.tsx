import type { TextSegment } from "@/lib/mock/feed";

/**
 * 강조 세그먼트 렌더러 — 목업 문구의 `<b>` 대응.
 *
 * 원래 이 파일에는 홈 [피드] 탭의 mock 카드(`PostCard`)가 있었다. [피드]가 공개 피드 실 API
 * (GET /api/feed/public)로 연결되면서(components/home/public-feed-card.tsx) 계약에 없던 요소
 * — 차트·이미지, 댓글 수, 보관 토글, 공유, 본인(isMe) 강조, "더 보기", ⋯ 메뉴 — 와 함께 제거됐다.
 *
 * 남은 `Segments` 는 mock 보고서 상세(components/report/report-screen.tsx)가 "왜 나에게 왔나"
 * 문구를 굵게 섞어 렌더할 때 쓴다. mock 상세가 실 API 로 교체되면 이 파일도 함께 정리한다.
 * (import 경로를 유지하려 파일 위치는 그대로 뒀다 — 이름 정리는 후속 리팩터링.)
 */
export function Segments({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.bold ? (
          <b key={i} className="font-semibold text-ink-mid">
            {seg.text}
          </b>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
