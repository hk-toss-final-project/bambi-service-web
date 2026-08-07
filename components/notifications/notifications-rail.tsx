/**
 * /notifications 우측 rail — 목업(notifications.html .side-r/.rpanel) 구조를 유지하기 위한
 * 읽기 전용 요약 카드. 실제 알림 설정 API·토글이 없으므로 상태를 텍스트로만 보여주고,
 * 저장되는 UI나 실제 토글 스위치처럼 보이는 컨트롤은 만들지 않는다.
 *
 * 현재 실제로 지원하는 알림 타입은 REPORT_READY 하나뿐이라, 없는 알림 종류(조건 달성·소셜 등)를
 * 항목으로 나열하지 않는다 — 실제로 켜져 있는 것 하나만 정확하게 보여준다.
 * 이동할 실제 설정 페이지가 없어 "설정 관리" 같은 링크는 두지 않는다(§ 기능 없는 링크 금지).
 */
export function NotificationsRail() {
  return (
    <aside className="sticky top-4 w-[300px] shrink-0 max-[1240px]:hidden">
      <section className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
        <h2 className="mb-2.5 text-[13px] font-bold text-foreground">알림 설정</h2>
        <div className="flex items-center justify-between text-[12.5px] text-ink-mid">
          <span>새 보고서 완료 알림</span>
          <b className="font-bold text-ok">켜짐</b>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-[1.6] text-muted-foreground">
          현재는 새 보고서가 완성되면 알려드리는 알림만 제공돼요.
        </p>
      </section>
    </aside>
  );
}
