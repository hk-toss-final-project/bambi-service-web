"use client";

import { useState } from "react";

import { ERROR_CODES } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { createInterest } from "@/lib/repositories/interests";
import { blockWikiTag } from "@/lib/repositories/wiki";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import type { InterestDto } from "@/types/interest";

/**
 * 후보 표시 상한 — 강도순. 목업은 2건만 뒀지만 실사용에서 후보가 너무 적게 보여
 * "AI가 파악한 범위가 좁다"는 인상을 줬다(2026-08-05 우석 지적).
 * 2026-08-11 에 12 → 20 (agent 추출 상한과 동일). 카드에서 칩으로 바뀌어 자리가 남고,
 * 12 에서 잘리면 agent 가 찾은 걸 화면이 감추는 셈이라 상한을 원천과 맞췄다.
 */
const FOUND_LIMIT = 20;

/**
 * [AI가 최근 발견한 관심사] — 목업 wiki.html .found 기준 (2026-08-05 목업 정렬).
 * 후보 = 자동추출 태그(GET /api/wiki/tags) 중 [내 관심사](source=USER)에 아직 없는 것.
 * - "＋ 추가" = POST /api/interests {name} → 성공 시 내 관심사 목록 refetch(카드가 아래 섹션으로 이동).
 *   409(이미 등록)는 목표 상태 달성으로 간주해 성공 처리한다(온보딩 replace 규칙과 동일).
 * - 목업의 "무시" 버튼은 만들지 않는다 — 무시 상태를 저장할 백엔드가 없어 새로고침이면 되돌아오는
 *   가짜 동작이 된다(동작하지 않는 UI 금지). 후보가 0건이면 섹션 자체를 렌더하지 않는다.
 *
 * <b>레이아웃 = 칩(2026-08-11 우석).</b> 후보 12건을 세로 카드로 세우니 화면을 통째로 먹고
 * 스크롤이 길어졌다(실사용 확인). 온디맨드 패널의 관심사 칩과 같은 형태로 압축한다 —
 * 칩 하나가 곧 "＋ 추가" 버튼이고, 카드마다 반복되던 동일 설명 문구는 섹션 안내 한 줄로 올린다.
 * 근거 문구(evidence)는 title 로 남겨 마우스를 올리면 볼 수 있게 한다(정보 유실 없음).
 */
export function WikiFound({
  tags,
  myInterests,
  removedNames,
  onAdded,
  onHidden,
}: {
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
  /** 이번 화면에서 내 관심사에서 뺀 이름 — 서버 태그가 사라져도 되돌릴 수 있게 후보로 남긴다. */
  removedNames: readonly string[];
  onAdded: (name: string) => void;
  /** 숨긴 이름 — 서버에 저장되므로 화면은 목록만 다시 읽으면 된다. */
  onHidden: (name: string) => void;
}) {
  if (tags.status !== "success" || myInterests === null) return null;

  const owned = new Set(myInterests.map((interest) => normalizeName(interest.name)));
  const fromTags = tags.data.filter((tag) => !owned.has(normalizeName(tag.tag)));
  // 방금 뺀 이름 중 (a) 아직 내 관심사에 없고 (b) 서버 태그에도 안 남은 것만 덧붙인다.
  // 서버가 태그를 갖고 있으면 fromTags 에 이미 있으므로 중복되지 않는다.
  const tagNames = new Set(fromTags.map((tag) => normalizeName(tag.tag)));
  const restorable = removedNames.filter(
    (name) => !owned.has(normalizeName(name)) && !tagNames.has(normalizeName(name)),
  );
  const candidates = [
    ...fromTags.map((tag) => ({ key: tag.tagId, name: tag.tag, reason: tag.reasonMessages[0] })),
    ...restorable.map((name) => ({ key: `removed:${name}`, name, reason: undefined })),
  ].slice(0, FOUND_LIMIT);

  // 후보 0건이어도 섹션을 통째로 지우지 않는다(2026-08-11 우석 — "발견 섹션이 어디 갔냐").
  // 전부 추가해서 비었을 뿐인데 흔적 없이 사라지면 고장으로 읽힌다. 단 AI 가 아직 아무것도
  // 못 찾은 상태(tags 0건)에서는 빈 안내조차 의미가 없으므로 그때만 렌더하지 않는다.
  if (candidates.length === 0) {
    if (tags.data.length === 0) return null;
    return (
      <section
        aria-label="AI가 최근 발견한 관심사"
        className="rounded-[14px] border border-border bg-card px-[18px] py-4"
      >
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          AI가 최근 발견한 관심사
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
          AI가 찾은 주제를 모두 내 관심사에 추가했어요. 자료를 더 저장하면 새 주제를 찾아 여기에 보여드릴게요.
        </p>
      </section>
    );
  }

  return (
    // 카드 박스로 묶는다(2026-08-11 우석) — 온디맨드 패널(.on-demand-panel)과 같은
    // rounded-[14px] border bg-card 컨테이너. 칩만 배경 없이 떠 있으면 어디까지가 이 섹션인지
    // 경계가 안 보인다.
    <section
      aria-label="AI가 최근 발견한 관심사"
      className="rounded-[14px] border border-border bg-card px-[18px] py-4"
    >
      <h2 className="flex items-baseline gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
        AI가 최근 발견한 관심사
        <span className="text-[12px] font-semibold text-muted-foreground">{candidates.length}건</span>
      </h2>
      <p className="mt-1 mb-3 text-[12.5px] leading-[1.6] text-muted-foreground">
        저장한 자료에서 AI가 찾은 주제예요. 누르면 내 관심사로 옮겨가고, ×를 누르면 목록에서 숨겨요.
      </p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <FoundChip
            key={candidate.key}
            name={candidate.name}
            reason={candidate.reason}
            onAdded={onAdded}
            onHidden={onHidden}
          />
        ))}
      </div>
    </section>
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 후보 칩 — 칩 자체가 "＋ 추가" 버튼이다(온디맨드 패널 관심사 칩과 같은 형태).
 * 실패는 칩 옆이 아니라 칩 문구로 알린다 — 칩 사이에 빨간 줄이 끼면 배치가 무너진다.
 */
function FoundChip({
  name,
  reason,
  onAdded,
  onHidden,
}: {
  name: string;
  reason?: string;
  onAdded: (name: string) => void;
  onHidden: (name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function add() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    createInterest(name.trim())
      .then(() => onAdded(name))
      .catch((err) => {
        // 이미 등록돼 있으면 목표 상태 달성 — 성공과 동일하게 목록을 다시 읽어 정합시킨다.
        if (err instanceof ApiError && err.code === ERROR_CODES.DUPLICATE_RESOURCE) {
          onAdded(name);
          return;
        }
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  function hide() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    blockWikiTag(name)
      .then(() => onHidden(name))
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }

  /*
    칩 하나에 동작 두 개다(2026-08-11 우석) — 이름 부분은 "내 관심사로 추가", × 는 "숨기기".
    버튼 중첩(button in button)은 HTML 위반이라 형제 버튼 둘을 한 껍데기 안에 넣고,
    껍데기(span)가 테두리·배경을 그린다. 포커스는 각 버튼이 따로 받는다.
  */
  return (
    <span
      // 근거 문구는 칩에 다 못 쓰므로 title 로 남긴다(정보 유실 없음).
      // 실패해도 이름을 지우지 않는다(2026-08-11) — 이름을 문구로 갈아끼우면 어느 칩이 실패했는지
      // 알 수 없고 다시 누를 대상도 못 찾는다. 테두리 색과 title 로만 알린다.
      title={failed ? "처리하지 못했어요. 다시 눌러 주세요." : reason}
      className={`inline-flex max-w-full items-center rounded-full border text-[12.5px] font-semibold whitespace-nowrap ${
        failed
          ? "border-destructive text-destructive"
          : "border-border bg-background text-foreground hover:border-primary"
      } ${busy ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={add}
        disabled={busy}
        aria-busy={busy}
        aria-label={`${name} 내 관심사로 추가`}
        className="focus-ring inline-flex min-w-0 items-center gap-1.5 rounded-full py-1.5 pr-1 pl-3 hover:text-signal-ink disabled:cursor-not-allowed"
      >
        <span className="min-w-0 truncate">{name}</span>
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">
          ＋
        </span>
      </button>
      <button
        type="button"
        onClick={hide}
        disabled={busy}
        aria-label={`${name} 발견 목록에서 숨기기`}
        title="이 주제 숨기기"
        className="focus-ring rounded-full py-1.5 pr-2.5 pl-1 text-[13px] text-muted-foreground hover:text-destructive disabled:cursor-not-allowed"
      >
        ×
      </button>
    </span>
  );
}
