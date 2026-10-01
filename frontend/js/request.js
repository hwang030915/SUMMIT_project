/* 3. 결산 요청 등록 (+ 7. 요청 등록 완료 / 8. 취소) */
(() => {
  const user = Layout.mount({
    active: "request",
    title: "결산 요청 등록",
    subtitle: "재무 담당자가 월말 결산 요청을 등록할 수 있습니다.",
  });
  if (!user) return;

  Icons.hydrate();
  document.getElementById("promo").insertAdjacentHTML("afterbegin", Icons.promoArt());

  const esc = Utils.escapeHtml;
  const RECENT_COUNT = 5;
  const recentList = document.getElementById("recentList");
  let highlightId = null;

  function recentStatus(item) {
    if (Utils.isDone(item)) return { tone: "success", label: "완료" };
    if (Utils.isLate(item)) return { tone: "danger", label: "지연" };
    return { tone: "warning", label: "대기중" };
  }

  async function loadRecent() {
    recentList.innerHTML = '<li class="recent-empty"><span class="spinner spinner-dark"></span> 불러오는 중...</li>';
    try {
      const all = await Store.list();
      const recent = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_COUNT);
      recentList.innerHTML = recent.length
        ? recent
            .map((item) => {
              const s = recentStatus(item);
              return `
                <li>
                  <a class="recent-item ${item.id === highlightId ? "is-new" : ""}" href="submit.html?id=${encodeURIComponent(item.id)}"
                     title="제출 체크에서 보기">
                    <span class="recent-icon tone-${s.tone}">${Icons.get("fileFill")}</span>
                    <span class="recent-body">
                      <span class="recent-title">${esc(item.title)}${UI.attachmentBadge(item)}</span>
                      <span class="recent-meta">${esc(item.department)}<i></i>${esc(item.deadline)}</span>
                    </span>
                    <span class="badge badge-${s.tone}">${s.label}</span>
                    <span class="row-chevron">${Icons.get("chevronRight")}</span>
                  </a>
                </li>`;
            })
            .join("")
        : '<li class="recent-empty">등록된 요청이 없습니다.</li>';
    } catch {
      recentList.innerHTML = `<li class="recent-empty">목록을 불러오지 못했습니다.<br />
        <button type="button" class="btn btn-sm btn-outline" id="retryRecent">다시 불러오기</button></li>`;
      document.getElementById("retryRecent").addEventListener("click", loadRecent);
    }
  }

  RequestForm.mount(document.getElementById("requestForm"), {
    onSuccess(item) {
      highlightId = item.id;
      UI.banner(document.getElementById("pageAlerts"), {
        title: "요청이 등록되었습니다.",
        message: `'${item.title}' 결산 자료 요청이 ${item.department}에 성공적으로 등록되었습니다.`,
      });
      loadRecent();
    },
    // 화면 정리서: 취소 = 저장하지 않고 이전 화면(결산 현황)으로 이동
    onCancel() {
      location.href = "main.html";
    },
  });

  loadRecent();
})();
