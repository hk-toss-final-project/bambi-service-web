"use client";

import { useState } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { ERROR_CODES } from "@/constants/errors";
import type { InterestTaxonomyState } from "@/hooks/use-interest-taxonomy";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import { ApiError } from "@/lib/api-client";
import {
  groupInterestsByCategory,
  type CategoryGroup,
  type CategoryItem,
} from "@/lib/interest-category";
import { deleteInterest } from "@/lib/repositories/interests";
import type { InterestDto } from "@/types/interest";

/**
 * 관심사가 하나도 없는 대분류를 화면에 남길지.
 *
 * 원래 의도는 "이 서비스가 다루는 범위"를 보여주려고 빈 대분류도 남기는 것이었는데,
 * 지금은 agent 가 관심사에 taxonomy ID 를 붙여주지 않아 대부분이 [기타]로 떨어진다
 * (2026-08-05 실측: 20건 중 20건). 그 상태로 빈 대분류 8개를 세우면 노이즈만 커져서 일단 접는다.
 * **agent 가 topicId 를 내려주기 시작하면 true 로 되돌린다** — 그때는 대분류가 실제로 채워진다.
 */
const SHOW_EMPTY_CATEGORIES = false;

/**
 * [AI가 이해한 지금의 나] — taxonomy 대분류로 묶어 보여준다(2026-08-05 우석 결정).
 *
 * 이전에는 AI 추론 태그 상위 4건만 나열해서 ⑴ 무엇을 기준으로 뽑힌 4개인지 알 수 없고
 * ⑵ 파악한 관심사 범위가 좁아 보이는 문제가 있었다. 이제 상한 없이 전부 보여주되
 * taxonomy 대분류(테크·IT / 비즈니스·경제 / …)로 묶는다.
 *
 * 데이터: AI 추론 태그(GET /api/wiki/tags, score=0~1 상대 강도) + 내 관심사(GET /api/interests).
 * 분류 규칙은 lib/interest-category.ts 참조(온보딩 선택은 categoryId, 나머지는 이름 대조).
 */
export function WikiMind({
  taxonomy,
  tags,
  myInterests,
  onChanged,
}: {
  taxonomy: InterestTaxonomyState & { refetch: () => void };
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
  onChanged: () => void;
}) {
  return (
    <section aria-label="AI가 이해한 지금의 나" className="mb-8">
      <div className="rounded-[14px] border border-border bg-card px-[18px] py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          AI가 이해한 지금의 나
        </h2>
        <p className="mt-0.5 mb-3.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          주제별로 모아 봤어요 — 직접 추가·삭제한 관심사는 AI 추정보다 우선해요.
        </p>

        <Body taxonomy={taxonomy} tags={tags} myInterests={myInterests} onChanged={onChanged} />
      </div>
    </section>
  );
}

function Body({
  taxonomy,
  tags,
  myInterests,
  onChanged,
}: {
  taxonomy: InterestTaxonomyState & { refetch: () => void };
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
  onChanged: () => void;
}) {
  // 대분류 골격이 없으면 묶어서 보여줄 수 없다 → taxonomy 실패는 별도 에러로 다룬다.
  if (taxonomy.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[160px]"
        icon={<IconAlert />}
        title="관심사 분류를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        actions={[{ label: "다시 시도", onClick: taxonomy.refetch, variant: "primary" }]}
      />
    );
  }
  if (taxonomy.status === "loading" || tags.status === "loading" || myInterests === null) {
    return <FeedSkeleton />;
  }
  if (tags.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[160px]"
        icon={<IconAlert />}
        title="관심사를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        actions={[{ label: "다시 시도", onClick: tags.refetch, variant: "primary" }]}
      />
    );
  }

  const wikiTags = tags.status === "success" ? tags.data : [];
  const groups = groupInterestsByCategory(taxonomy.data, wikiTags, myInterests);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (total === 0) {
    return (
      <StateView
        className="min-h-[160px]"
        icon={<IconEmptyDoc />}
        title="아직 파악한 관심사가 없어요"
        description="관심 자료를 저장하거나 관심사를 직접 추가하면 여기에 주제별로 정리돼요."
      />
    );
  }

  const visible = SHOW_EMPTY_CATEGORIES ? groups : groups.filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {visible.map((group) => (
        <CategoryBlock key={group.id} group={group} onChanged={onChanged} />
      ))}
    </div>
  );
}

/** 대분류 1개 — 제목 줄 + 소속 관심사. 비어 있으면 옅게 두어 "채울 수 있는 자리"로 보이게 한다. */
function CategoryBlock({ group, onChanged }: { group: CategoryGroup; onChanged: () => void }) {
  const empty = group.items.length === 0;
  return (
    <div className={empty ? "opacity-45" : undefined}>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span aria-hidden="true" className="text-[13px]">
          {group.emoji}
        </span>
        <h3 className="text-[13px] font-bold text-foreground">{group.name}</h3>
        {!empty && (
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            {group.items.length}
          </span>
        )}
      </div>

      {empty ? (
        <p className="pl-[22px] text-[12px] text-muted-foreground">아직 없어요</p>
      ) : (
        <ul className="flex flex-col gap-1.5 pl-[22px]">
          {group.items.map((item) => (
            <MindRow key={item.key} item={item} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 관심사 1줄. score 가 있으면 상대 강도 막대를, 없으면(직접 추가만 한 관심사) 안내 문구를 둔다.
 * 막대 최소 폭 8% — 0 에 가까워도 막대가 사라져 보이지 않게 한다(rail 집계와 동일 규칙).
 * 절대 수치로 오해하지 않도록 %는 표기하지 않는다.
 */
function MindRow({ item, onChanged }: { item: CategoryItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const width = item.score === null ? 0 : Math.max(8, Math.round(item.score * 100));

  function remove() {
    if (busy || item.interestId === null) return;
    setBusy(true);
    setFailed(false);
    deleteInterest(item.interestId)
      .then(() => onChanged())
      .catch((err) => {
        // 이미 지워졌으면 목표 상태 달성 — 목록만 다시 읽어 정합시킨다(온보딩 replace 규칙과 동일).
        if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
          onChanged();
          return;
        }
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  return (
    <li className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[13px] font-semibold text-foreground">
        {item.name}
      </span>
      {item.score === null ? (
        <span className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">
          직접 추가한 관심사
        </span>
      ) : (
        <span aria-hidden="true" className="h-2 min-w-0 flex-1 rounded-full bg-background">
          <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
        </span>
      )}
      <span className="w-14 shrink-0 text-right text-[11.5px] text-muted-foreground">
        {item.source === "USER" ? "내 관심사" : "AI 추정"}
      </span>
      {/* AI 추론 태그는 agent 소유라 지울 API 가 없다 → 자리만 비워 행 정렬을 맞춘다. */}
      <span className="w-12 shrink-0 text-right">
        {item.interestId !== null && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-busy={busy}
            aria-label={`${item.name} 관심사 삭제`}
            className="focus-ring rounded-[8px] px-1.5 py-0.5 text-[11.5px] text-muted-foreground hover:text-signal-ink disabled:opacity-50"
          >
            삭제
          </button>
        )}
        {failed && (
          <span role="alert" className="block text-[11px] text-signal-ink">
            실패
          </span>
        )}
      </span>
    </li>
  );
}
