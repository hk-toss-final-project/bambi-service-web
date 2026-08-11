import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

const sourceUrl = new URL("../lib/report-pending.ts", import.meta.url);
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
  ACTIVE_PENDING_POLL_MS,
  IDLE_PENDING_POLL_MS,
  getPreparingReportTitle,
  isGenerationPendingDto,
  observePendingFailure,
  observePendingSuccess,
  REPORT_PENDING_PATH,
} = commonJsModule.exports;

function pending(id, status = "PENDING", reportType = "ON_DEMAND") {
  return {
    id,
    topic: "AI",
    contentType: "briefing",
    reportType,
    status,
    createdAt: "2026-08-10T09:00:00+09:00",
    updatedAt: "2026-08-10T09:00:00+09:00",
    errorCode: null,
  };
}

test("실제 pending 경로와 DTO의 활성 상태만 허용한다", () => {
  assert.equal(REPORT_PENDING_PATH, "/api/reports/pending");
  for (const status of ["PENDING", "RUNNING", "PUBLISHING"]) {
    assert.equal(isGenerationPendingDto(pending("job-a", status)), true);
  }
  assert.equal(isGenerationPendingDto({ ...pending("job-a"), contentType: null }), true);
  assert.equal(isGenerationPendingDto(pending("job-onboarding", "PENDING", "ONBOARDING")), true);
  assert.equal(isGenerationPendingDto(pending("job-a", "COMPLETED")), false);
  assert.equal(isGenerationPendingDto(pending("job-a", "READY")), false);
  const missingUpdatedAt = { ...pending("job-a") };
  delete missingUpdatedAt.updatedAt;
  assert.equal(isGenerationPendingDto(missingUpdatedAt), false);
});

test("처리중 UI는 아침·온보딩·온디맨드 유형별 문구를 사용한다", () => {
  assert.equal(
    getPreparingReportTitle("서버 placeholder", "MORNING_BRIEFING"),
    "오늘의 아침 브리핑을 생성하고 있어요",
  );
  assert.equal(
    getPreparingReportTitle("AI", "ONBOARDING"),
    "첫 리포트를 생성하고 있어요",
  );
  assert.equal(getPreparingReportTitle("AI", "ON_DEMAND"), "AI 보고서");
});

test("활성 pending은 5초, 빈 목록은 30초 polling한다", () => {
  assert.equal(observePendingSuccess(null, [pending("job-a")]).nextIntervalMs, ACTIVE_PENDING_POLL_MS);
  assert.equal(observePendingSuccess(null, []).nextIntervalMs, IDLE_PENDING_POLL_MS);
});

test("최초 빈 목록은 피드 갱신으로 오인하지 않는다", () => {
  const observation = observePendingSuccess(null, []);
  assert.equal(observation.shouldRefreshFeed, false);
});

test("동일 ID의 PENDING → RUNNING → PUBLISHING 전이는 완료가 아니다", () => {
  const first = observePendingSuccess(null, [pending("job-a", "PENDING")]);
  const running = observePendingSuccess(first.snapshot, [pending("job-a", "RUNNING")]);
  const publishing = observePendingSuccess(running.snapshot, [pending("job-a", "PUBLISHING")]);
  assert.equal(running.shouldRefreshFeed, false);
  assert.equal(publishing.shouldRefreshFeed, false);
});

test("기존 pending ID가 사라질 때 한 번만 피드 갱신 신호를 낸다", () => {
  const first = observePendingSuccess(null, [pending("job-a")]);
  const removed = observePendingSuccess(first.snapshot, []);
  const stillEmpty = observePendingSuccess(removed.snapshot, []);
  assert.equal(removed.shouldRefreshFeed, true);
  assert.equal(stillEmpty.shouldRefreshFeed, false);
});

test("API 실패는 작업 완료가 아니며 이전 활성 스냅샷을 유지한다", () => {
  const first = observePendingSuccess(null, [pending("job-a")]);
  const failed = observePendingFailure(first.snapshot);
  assert.equal(failed.shouldRefreshFeed, false);
  assert.equal(failed.snapshot, first.snapshot);
  assert.equal(failed.nextIntervalMs, ACTIVE_PENDING_POLL_MS);
});

test("활성 작업을 아직 발견하지 못한 API 실패도 30초 뒤 재시도한다", () => {
  const failed = observePendingFailure(null);
  assert.equal(failed.shouldRefreshFeed, false);
  assert.equal(failed.snapshot, null);
  assert.equal(failed.nextIntervalMs, IDLE_PENDING_POLL_MS);
});
