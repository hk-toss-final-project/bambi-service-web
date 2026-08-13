import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 온보딩 관심사 선택 상한(12개)의 불변식.
 *
 * 이 상한은 우리가 고른 UX 숫자가 아니라 **agent 계약값**이다. 관심사를 저장·삭제할 때마다
 * agent `/internal/v1/users/{id}/context` 로 전체 목록이 동기화되는데, 13개 이상이면 422
 * (`too_long`, `body.selected_topic_ids`)로 거절되고 service 가 503 으로 바꿔 내려준다.
 *
 * 그래서 화면 상한이 사라지면 저장이 통째로 실패한다. 2026-08-13 에 실제로 온보딩이 막혔고,
 * 사용자에게는 "잠시 후 다시 시도해 주세요" 만 반복해서 보였다 — 몇 개까지인지 알 방법이 없었다.
 */
const constants = readFileSync(new URL("../constants/interests.ts", import.meta.url), "utf8");
const screen = readFileSync(
  new URL("../components/onboarding/onboarding-screen.tsx", import.meta.url),
  "utf8",
);
const picker = readFileSync(
  new URL("../components/onboarding/interest-picker.tsx", import.meta.url),
  "utf8",
);

/** "이 표기가 없어야 한다" 류 검사는 주석을 뺀 코드만 본다(결정 근거를 파일에 남길 수 있어야 한다). */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("상한 값은 agent 계약(12)과 같고 한 곳에만 정의된다", () => {
  const match = constants.match(/export const INTEREST_SELECTION_MAX = (\d+)/);
  assert.ok(match, "INTEREST_SELECTION_MAX 가 constants/interests.ts 에 있어야 한다");
  assert.equal(match[1], "12", "agent 가 selected_topic_ids 를 12개까지만 받는다");
});

test("화면은 상수를 import 해서 쓴다 — 숫자를 따로 적지 않는다", () => {
  assert.match(screen, /INTEREST_SELECTION_MAX/);
  assert.doesNotMatch(
    code(screen),
    /최대\s*12\s*개/,
    "문구에 12를 직접 쓰면 상한이 바뀔 때 화면만 낡는다",
  );
});

test("상한을 넘기면 제출을 막는다", () => {
  assert.match(
    code(screen),
    /const\s+overLimit\s*=\s*selected\.length\s*>\s*INTEREST_SELECTION_MAX/,
    "서버가 어차피 거절하므로 눌러봐야 실패만 반복된다",
  );
  assert.match(code(screen), /canSubmit\s*=.*!overLimit/);
});

test("상한에 걸려도 선택 해제는 된다 — 스스로 빠져나올 수 있어야 한다", () => {
  const toggle = code(screen).match(/function toggle\([\s\S]*?\n {2}}/);
  assert.ok(toggle, "toggle 함수를 찾지 못했다");
  const body = toggle[0];
  const removeIndex = body.indexOf("filter");
  const limitIndex = body.indexOf("INTEREST_SELECTION_MAX");
  assert.ok(removeIndex > -1 && limitIndex > -1);
  assert.ok(
    removeIndex < limitIndex,
    "해제 분기가 상한 검사보다 먼저여야 상한 초과 상태에서도 뺄 수 있다",
  );
});

test("상한에 도달하면 미선택 chip 만 비활성한다", () => {
  assert.match(code(picker), /atLimit\s*&&\s*!selected\.has\(/, "이미 고른 chip 은 계속 눌려야 한다");
  assert.match(code(screen), /atLimit=\{atLimit\}/, "화면이 picker 에 상한 도달을 넘겨야 한다");
});

test("몇 개까지인지 사용자에게 보인다", () => {
  assert.match(screen, /최소 1개 · 최대/, "평소에는 범위를 알려준다");
  assert.match(screen, /개를 빼주세요/, "초과 상태에서는 몇 개를 빼야 하는지 알려준다");
});
