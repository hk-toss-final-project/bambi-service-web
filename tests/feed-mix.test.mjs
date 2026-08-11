import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

// report-pending.test.mjs 와 같은 패턴 — lib/feed-mix.ts 는 타입 전용 import만 있어(런타임
// require 없음) require shim 없이 그대로 트랜스파일+vm 격리가 된다.
const sourceUrl = new URL("../lib/feed-mix.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: sourceUrl.pathname,
});
const commonJsModule = { exports: {} };
vm.runInNewContext(
  compiled.outputText,
  { module: commonJsModule, exports: commonJsModule.exports },
  { filename: sourceUrl.pathname },
);

const {
  buildMixedFeed,
  followedAuthorIdsOf,
  interleaveFeed,
  isRecommendedCandidate,
  pickRecommendedCandidates,
} = commonJsModule.exports;

/** PublicFeedCardVM 최소 형태 — 테스트에 필요한 필드만 채운다. */
function card(publicId, { authorId = null, matchedTopics = [], matchedCategories = [] } = {}) {
  return {
    publicId,
    title: `title-${publicId}`,
    summary: "",
    author: { publicId: authorId, displayName: null, username: null, initial: null },
    social: null,
    scrapped: null,
    sources: [],
    createdAtLabel: "",
    tags: [],
    matchedTopics: matchedTopics.map((topicId) => ({ topicId, name: topicId })),
    matchedCategories: matchedCategories.map((categoryId) => ({ categoryId, name: categoryId })),
  };
}

// vm.runInNewContext 로 만든 배열은 outer 렐름의 Array.prototype 과 달라 assert.deepEqual이
// "같은 구조지만 참조가 다르다"로 실패한다(cross-realm). Array.from으로 outer 배열로 옮겨 비교한다.
function toIds(cards) {
  return Array.from(cards, (c) => c.publicId);
}

test("isRecommendedCandidate: topic 매칭이 있으면 후보, 없으면 category 매칭만 봐도 후보", () => {
  assert.equal(isRecommendedCandidate(card("A", { matchedTopics: ["ai"] })), true);
  assert.equal(isRecommendedCandidate(card("B", { matchedCategories: ["tech"] })), true);
  assert.equal(isRecommendedCandidate(card("C")), false);
});

test("추천 후보는 topic/category 매칭 여부와 무관하게 서버 응답 순서를 그대로 유지한다(topic 우선 재정렬 없음)", () => {
  const allPublic = [
    card("A", { matchedCategories: ["tech"] }),
    card("B", { matchedTopics: ["ai"] }),
    card("C", { matchedTopics: ["ai"] }),
    card("D", { matchedCategories: ["tech"] }),
  ];
  const result = pickRecommendedCandidates({
    allPublic,
    followingCards: [],
    followedAuthorIds: new Set(),
    viewerPublicId: null,
  });
  assert.deepEqual(toIds(result), ["A", "B", "C", "D"]);
});

test("팔로잉·본인·매칭 없는 카드는 제외하되 나머지 순서는 그대로 유지한다", () => {
  const allPublic = [
    card("A", { matchedTopics: ["ai"] }),
    card("B", { authorId: "author-following", matchedTopics: ["ai"] }),
    card("C", { authorId: "author-self", matchedTopics: ["ai"] }),
    card("D", { matchedCategories: ["tech"] }),
    card("E"), // 매칭 없음
  ];
  const result = pickRecommendedCandidates({
    allPublic,
    followingCards: [],
    followedAuthorIds: new Set(["author-following"]),
    viewerPublicId: "author-self",
  });
  assert.deepEqual(toIds(result), ["A", "D"]);
});

test("interleaveFeed는 중복 publicId를 최초 등장 순서로 한 번만 남긴다", () => {
  const following = [card("F1"), card("F2")];
  const recommended = [card("F2"), card("R1"), card("R2")];
  const result = interleaveFeed({ followingCards: following, recommendedCards: recommended, limit: 10 });
  const ids = toIds(result);
  assert.deepEqual(ids, ["F1", "F2", "R1", "R2"]);
  assert.equal(ids.filter((id) => id === "F2").length, 1);
});

test("팔로잉 2 : 추천 1 교차 배치에서도 추천 카드끼리의 서버 순서는 바뀌지 않는다", () => {
  const following = [card("F1"), card("F2"), card("F3"), card("F4")];
  const recommended = [
    card("A", { matchedCategories: ["tech"] }),
    card("B", { matchedTopics: ["ai"] }),
    card("C", { matchedTopics: ["ai"] }),
  ];
  const result = buildMixedFeed({ followingCards: following, recommendedCards: recommended, limit: 20 });
  const ids = toIds(result);
  const recommendedOrderInResult = ids.filter((id) => ["A", "B", "C"].includes(id));
  assert.deepEqual(recommendedOrderInResult, ["A", "B", "C"]);
  assert.deepEqual(ids, ["F1", "F2", "A", "F3", "F4", "B", "C"]);
});

test("같은 입력에는 항상 같은 결과가 나온다(비결정적 요소 없음)", () => {
  const following = [card("F1"), card("F2")];
  const recommended = [card("A", { matchedTopics: ["ai"] }), card("B", { matchedCategories: ["tech"] })];
  const run = () => toIds(buildMixedFeed({ followingCards: following, recommendedCards: recommended }));
  assert.deepEqual(run(), run());
  assert.deepEqual(run(), run());
});

test("추천 후보가 부족하거나 비어 있어도, 팔로잉이 비어 있어도 오류 없이 처리한다", () => {
  assert.equal(buildMixedFeed({ followingCards: [], recommendedCards: [] }).length, 0);
  assert.deepEqual(toIds(buildMixedFeed({ followingCards: [card("F1")], recommendedCards: [] })), ["F1"]);
  assert.deepEqual(
    toIds(buildMixedFeed({ followingCards: [], recommendedCards: [card("A", { matchedTopics: ["ai"] })] })),
    ["A"],
  );
  assert.equal(
    pickRecommendedCandidates({
      allPublic: [],
      followingCards: [],
      followedAuthorIds: new Set(),
      viewerPublicId: null,
    }).length,
    0,
  );
});

test("followedAuthorIdsOf는 팔로잉 카드 작성자 publicId만 모은다(null 제외)", () => {
  const following = [
    card("F1", { authorId: "author-1" }),
    card("F2", { authorId: null }),
    card("F3", { authorId: "author-2" }),
  ];
  const ids = followedAuthorIdsOf(following);
  assert.deepEqual([...ids].sort(), ["author-1", "author-2"]);
});
