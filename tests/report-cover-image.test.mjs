import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

function compileCommonJs(relativePath, requireModule = () => {
  throw new Error("unexpected require");
}) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: sourceUrl.pathname,
  });
  const commonJsModule = { exports: {} };
  vm.runInNewContext(
    compiled.outputText,
    { module: commonJsModule, exports: commonJsModule.exports, require: requireModule, URL, Intl },
    { filename: sourceUrl.pathname },
  );
  return commonJsModule.exports;
}

const normalize = compileCommonJs("../lib/normalize.ts");
const reportAdapter = compileCommonJs("../lib/adapters/report.ts", (id) => {
  if (id === "@/lib/normalize") return normalize;
  throw new Error(`unexpected require: ${id}`);
});
const { toReportCoverImage } = reportAdapter;

test("HTTP(S) 이미지와 원문 출처를 화면 모델로 정규화한다", () => {
  const cover = toReportCoverImage({
    url: "https://cdn.example.com/cover.jpg",
    sourceUrl: "https://news.example.com/article",
    sourceTitle: "  기사 제목  ",
  });

  assert.equal(cover.url, "https://cdn.example.com/cover.jpg");
  assert.equal(cover.sourceUrl, "https://news.example.com/article");
  assert.equal(cover.sourceLabel, "기사 제목");
});

test("출처 제목이 없으면 원문 host를 출처 라벨로 사용한다", () => {
  const cover = toReportCoverImage({
    url: "https://cdn.example.com/cover.jpg",
    sourceUrl: "https://news.example.com/article",
    sourceTitle: null,
  });

  assert.equal(cover.sourceLabel, "news.example.com");
});

test("이미지나 원문 URL이 안전하지 않으면 대표 이미지를 렌더하지 않는다", () => {
  assert.equal(
    toReportCoverImage({
      url: "javascript:alert(1)",
      sourceUrl: "https://news.example.com/article",
    }),
    null,
  );
  assert.equal(
    toReportCoverImage({
      url: "https://cdn.example.com/cover.jpg",
      sourceUrl: "/relative/article",
    }),
    null,
  );
  assert.equal(
    toReportCoverImage({
      url: "http://127.0.0.1/admin.png",
      sourceUrl: "https://news.example.com/article",
    }),
    null,
  );
  assert.equal(
    toReportCoverImage({
      url: "http://192.168.0.10/cover.jpg",
      sourceUrl: "https://news.example.com/article",
    }),
    null,
  );
});
