"use client";

import type { InterestTaxonomyCategory } from "@/types/interest";

/**
 * 관심사 선택 그리드 — 목업 onboarding.html 의 .ob-cat / .ob-chips / .chip / .ob-addrow 1:1.
 *
 * - category 는 표시 전용 그룹(fieldset+legend)이고, 서버로는 topic(name)만 간다(constants/interests.ts).
 * - chip 은 실제 <button type="button"> + aria-pressed 토글. 목업 .pl 과 동일하게
 *   미선택 = ＋ / 선택 = ✓ 아이콘을 함께 그려 색상 외 수단으로도 상태를 전달한다.
 * - 직접 추가(.ob-addrow)는 점선 구분선 아래 중앙 정렬 — 버튼·안내·추가된 chip 순(목업 DOM 순서).
 */
export function InterestPicker({
  categories,
  customTopics,
  selected,
  disabled,
  atLimit,
  onToggle,
  onOpenAdd,
}: {
  /** Service DB 활성 taxonomy Category·Topic 목록. */
  categories: InterestTaxonomyCategory[];
  /** 사용자가 직접 추가했거나 서버에 있던 카탈로그 밖 topic 목록. */
  customTopics: string[];
  selected: ReadonlySet<string>;
  /** 저장(제출) 중 상호작용 차단. */
  disabled: boolean;
  /**
   * 선택 상한에 도달 — <b>미선택 chip 만</b> 비활성한다. 이미 고른 것은 그대로 눌러서 뺄 수 있어야
   * 상한에 걸린 사용자가 스스로 빠져나올 수 있다. 눌러도 아무 일이 없는 것보다 흐려져서 안 눌리는
   * 편이 이유가 드러난다(하단 안내가 "최대 N개까지 골랐어요" 를 함께 말한다).
   */
  atLimit: boolean;
  onToggle: (name: string) => void;
  onOpenAdd: () => void;
}) {
  return (
    <>
      {categories.map((category) => (
        <fieldset key={category.id} className="mt-6">
          {/* .ob-cat — 13px/700, ink-mid */}
          <legend className="mb-2.5 text-[13px] font-bold text-ink-mid">
            <span aria-hidden="true">{category.emoji} </span>
            {category.name}
          </legend>
          {/* .ob-chips — gap 9px */}
          <div className="flex flex-wrap gap-[9px]">
            {category.topics.map((topic) => (
              <InterestChip
                key={topic.id}
                name={topic.name}
                selected={selected.has(topic.name)}
                disabled={disabled || (atLimit && !selected.has(topic.name))}
                onToggle={() => onToggle(topic.name)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {/* .ob-addrow — 점선 구분선 아래 중앙 정렬 세로 배치 (서버 계약: 자유 문자열 name 저장 지원 확인됨) */}
      <fieldset className="mt-[30px] flex flex-col items-center gap-2 border-t border-dashed border-input pt-[22px]">
        <legend className="sr-only">관심사 직접 추가</legend>
        {/* .chip.add — 주황 점선 테두리 */}
        <button
          type="button"
          onClick={onOpenAdd}
          disabled={disabled || atLimit}
          className="focus-ring inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-dashed border-primary bg-card px-4 py-[9px] text-[13.5px] font-bold whitespace-nowrap text-signal-ink hover:bg-wash disabled:opacity-45"
        >
          + 관심사 직접 추가
        </button>
        {/* .ob-addhint */}
        <span className="text-xs text-muted-foreground">
          찾는 주제가 없나요? 자유롭게 입력해 주세요
        </span>
        {/* .ob-added — 추가된 topic 은 카탈로그 chip 과 동일 형태, 중앙 정렬 */}
        {customTopics.length > 0 && (
          <div className="mt-0.5 flex flex-wrap justify-center gap-[9px]">
            {customTopics.map((topic) => (
              <InterestChip
                key={topic}
                name={topic}
                selected={selected.has(topic)}
                disabled={disabled || (atLimit && !selected.has(topic))}
                onToggle={() => onToggle(topic)}
              />
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

/** .chip — 미선택: ＋ 아이콘 + line-strong 테두리 / 선택(.on): ✓ 아이콘 + 주황 테두리·wash 배경. */
function InterestChip({
  name,
  selected,
  disabled,
  onToggle,
}: {
  name: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`focus-ring inline-flex items-center gap-[7px] rounded-full border px-4 py-[9px] text-[13.5px] font-semibold whitespace-nowrap transition-colors disabled:opacity-45 ${
        selected
          ? "border-primary bg-wash text-signal-ink"
          : "border-input bg-card text-ink-mid hover:border-primary hover:text-foreground"
      }`}
    >
      {selected ? <ChipCheckIcon /> : <ChipPlusIcon />}
      {name}
    </button>
  );
}

/** .chip .pl — 미선택 ＋ (ink-dim). 설정의 아침 브리핑 관심사 chip 도 같은 아이콘을 쓴다. */
export function ChipPlusIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 11 11" aria-hidden="true" className="shrink-0 text-muted-foreground">
      <path d="M5.5 0.8v9.4M0.8 5.5h9.4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/** .chip.on .pl — 선택 ✓ (signal-ink). 완료 화면 요약 chip 도 재사용한다. */
export function ChipCheckIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 11 11" aria-hidden="true" className="shrink-0 text-signal-ink">
      <path d="M1.4 5.8 4.1 8.4 9.6 2.6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
