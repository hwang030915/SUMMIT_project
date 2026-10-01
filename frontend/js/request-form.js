/**
 * 결산 요청 등록 폼
 * - 7.요청 등록: 저장 성공 시 onSuccess(item) 호출
 * - 8.취소: 입력 중이면 "작성 중인 내용을 취소하시겠습니까?" 확인 후 onCancel()
 * - 첨부파일: 끌어다 놓기 / 클릭 선택, 최대 5개 · 파일당 10MB
 */
const RequestForm = (() => {
  const MEMO_MAX = 300;
  // 이 크기 이하 파일은 내용까지 저장해 바로 내려받을 수 있음 (목업 저장 공간 한계 때문)
  const INLINE_LIMIT = 512 * 1024;
  const ALLOWED = /\.(pdf|xlsx?|csv|docx?|hwpx?|pptx?|txt|png|jpe?g|gif|zip)$/i;

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`'${file.name}' 파일을 읽지 못했습니다.`));
      reader.readAsDataURL(file);
    });
  }

  function mount(container, { onSuccess, onCancel } = {}) {
    const uid = "rf";
    const defaultMonth = Utils.lastMonth();

    container.innerHTML = `
      <form class="request-form" novalidate>
        <div class="form-alert" role="alert"></div>

        <div class="field">
          <label class="field-label" for="${uid}-month">결산월<span class="required">*</span></label>
          <div class="input-wrap">
            <span class="input-icon">${Icons.get("calendar")}</span>
            <select class="input select" id="${uid}-month" name="month">${UI.monthOptionsHtml(Utils.monthOptions(), defaultMonth)}</select>
          </div>
          <p class="field-error"></p>
        </div>

        <div class="field">
          <label class="field-label" for="${uid}-title">자료명<span class="required">*</span></label>
          <input class="input" type="text" id="${uid}-title" name="title" maxlength="50" autocomplete="off"
            placeholder="예) 영업비용 내역, 인건비 정산 자료 등" />
          <p class="field-hint">요청할 결산 자료의 명칭을 입력해주세요.</p>
          <p class="field-error"></p>
        </div>

        <div class="field">
          <label class="field-label" for="${uid}-dept">담당 부서<span class="required">*</span></label>
          <select class="input select" id="${uid}-dept" name="department">
            <option value="">부서를 선택하세요</option>
            ${Store.DEPARTMENTS.map((d) => `<option value="${d}">${d}</option>`).join("")}
          </select>
          <div class="chip-group" role="group" aria-label="부서 빠른 선택">
            ${Store.DEPARTMENTS.map((d) => `<button type="button" class="chip" data-dept="${d}" aria-pressed="false">${d}</button>`).join("")}
          </div>
          <p class="field-error"></p>
        </div>

        <div class="field">
          <label class="field-label" for="${uid}-deadline">제출 기한<span class="required">*</span></label>
          <div class="input-wrap">
            <span class="input-icon">${Icons.get("calendar")}</span>
            <input class="input date-input" type="date" id="${uid}-deadline" name="deadline" />
          </div>
          <p class="field-hint">자료 제출이 필요한 기한을 선택해주세요.</p>
          <p class="field-error"></p>
        </div>

        <div class="field">
          <label class="field-label" for="${uid}-memo">요청 메모</label>
          <textarea class="input textarea" id="${uid}-memo" name="requestMemo" maxlength="${MEMO_MAX}" rows="3"
            placeholder="부서에 전달할 추가 안내 사항을 입력하세요.&#10;(선택)"></textarea>
          <div class="textarea-counter"></div>
          <p class="field-error"></p>
        </div>

        <div class="field">
          <span class="field-label" id="${uid}-files-label">첨부파일</span>
          <div class="dropzone" tabindex="0" role="button" aria-labelledby="${uid}-files-label" aria-describedby="${uid}-files-hint">
            <span class="dropzone-icon">${Icons.get("upload")}</span>
            <span class="dropzone-text"><strong>파일을 끌어다 놓거나 클릭하여 선택</strong>하세요</span>
            <span class="dropzone-hint" id="${uid}-files-hint">최대 ${Store.MAX_FILES}개 · 파일당 10MB 이하 (PDF, 엑셀, 워드, 한글, 이미지, ZIP 등)</span>
          </div>
          <input type="file" class="sr-only" multiple tabindex="-1" aria-hidden="true"
            accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip" />
          <ul class="file-list"></ul>
          <p class="field-error"></p>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-cancel>취소</button>
          <button type="submit" class="btn btn-primary" data-submit>${Icons.get("send")}<span>요청 등록</span></button>
        </div>
      </form>`;

    const form = container.querySelector("form");
    const alertEl = form.querySelector(".form-alert");
    const submitBtn = form.querySelector("[data-submit]");
    const els = {
      month: form.elements.month,
      title: form.elements.title,
      department: form.elements.department,
      deadline: form.elements.deadline,
      requestMemo: form.elements.requestMemo,
    };
    const dropzone = form.querySelector(".dropzone");
    const fileInput = form.querySelector('input[type="file"]');
    const fileList = form.querySelector(".file-list");
    const chips = [...form.querySelectorAll(".chip")];
    const updateCounter = UI.bindCounter(els.requestMemo, form.querySelector(".textarea-counter"));
    let files = [];

    /* ---------- 부서 칩 ↔ 드롭다운 동기화 ---------- */
    function syncChips() {
      chips.forEach((chip) => {
        const on = chip.dataset.dept === els.department.value;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", String(on));
      });
    }
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        els.department.value = chip.dataset.dept;
        UI.setFieldError(els.department, "");
        syncChips();
      })
    );
    els.department.addEventListener("change", syncChips);

    Object.values(els).forEach((el) => {
      el.addEventListener("input", () => UI.setFieldError(el, ""));
      el.addEventListener("change", () => UI.setFieldError(el, ""));
    });

    /* ---------- 첨부파일 ---------- */
    function renderFiles() {
      fileList.innerHTML = files
        .map(
          (f, i) => `
          <li class="file-item">
            <span class="file-icon">${Icons.get("paperclip")}</span>
            <span class="file-name" title="${Utils.escapeHtml(f.name)}">${Utils.escapeHtml(f.name)}</span>
            <span class="file-size">${Utils.formatBytes(f.size)}</span>
            <button type="button" class="file-remove" data-index="${i}" aria-label="${Utils.escapeHtml(f.name)} 삭제">${Icons.get("x")}</button>
          </li>`
        )
        .join("");
      dropzone.classList.toggle("is-full", files.length >= Store.MAX_FILES);
    }

    function addFiles(list) {
      const problems = [];
      for (const file of list) {
        if (files.some((f) => f.name === file.name && f.size === file.size)) continue; // 같은 파일 중복 방지
        if (files.length >= Store.MAX_FILES) {
          problems.push(`첨부파일은 최대 ${Store.MAX_FILES}개까지 등록할 수 있습니다.`);
          break;
        }
        if (!ALLOWED.test(file.name)) {
          problems.push(`'${file.name}'은(는) 첨부할 수 없는 형식입니다.`);
          continue;
        }
        if (file.size > Store.MAX_FILE_SIZE) {
          problems.push(`'${file.name}'은(는) 10MB를 넘어 첨부할 수 없습니다.`);
          continue;
        }
        files.push(file);
      }
      UI.setFieldError(dropzone, problems[0] || "");
      renderFiles();
    }

    const openPicker = () => fileInput.click();
    dropzone.addEventListener("click", openPicker);
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
    });
    fileInput.addEventListener("change", () => {
      addFiles(fileInput.files);
      fileInput.value = ""; // 같은 파일을 지웠다가 다시 고를 수 있게
    });
    ["dragenter", "dragover"].forEach((type) =>
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((type) =>
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      })
    );
    dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
    fileList.addEventListener("click", (e) => {
      const btn = e.target.closest(".file-remove");
      if (!btn) return;
      files.splice(Number(btn.dataset.index), 1);
      UI.setFieldError(dropzone, "");
      renderFiles();
    });

    /* ---------- 상태 ---------- */
    function values() {
      return {
        month: els.month.value,
        title: els.title.value,
        department: els.department.value,
        deadline: els.deadline.value,
        requestMemo: els.requestMemo.value,
      };
    }

    function isDirty() {
      const v = values();
      return Boolean(
        v.title.trim() || v.department || v.deadline || v.requestMemo.trim() || v.month !== defaultMonth || files.length
      );
    }

    function reset() {
      form.reset();
      els.month.value = defaultMonth;
      files = [];
      renderFiles();
      [...Object.values(els), dropzone].forEach((el) => UI.setFieldError(el, ""));
      UI.showFormAlert(alertEl, "");
      updateCounter();
      syncChips();
    }

    /* ---------- 8. 취소 ---------- */
    form.querySelector("[data-cancel]").addEventListener("click", async () => {
      if (isDirty()) {
        const ok = await UI.confirm({
          icon: "trash",
          title: "작성 중인 내용을 취소하시겠습니까?",
          message: "지금까지 입력한 내용과 첨부파일은 저장되지 않습니다.",
          cancelText: "계속 작성",
          okText: "취소하기",
        });
        if (!ok) return;
      }
      reset();
      if (onCancel) onCancel();
    });

    /* ---------- 7. 요청 등록 ---------- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return; // 중복 클릭 방지
      UI.showFormAlert(alertEl, "");

      const meta = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));
      const { errors, valid } = Store.validateRequest({ ...values(), attachments: meta });
      const targets = { ...els, attachments: dropzone };
      let first = null;
      Object.entries(targets).forEach(([key, el]) => {
        UI.setFieldError(el, errors[key] || "");
        if (errors[key] && !first) first = el;
      });
      if (!valid) {
        first.focus();
        return;
      }

      UI.setButtonLoading(submitBtn, true, "등록 중...");
      try {
        const attachments = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            dataUrl: f.size <= INLINE_LIMIT ? await readAsDataUrl(f) : null,
          }))
        );
        const item = await Store.create({ ...values(), attachments });
        reset();
        if (onSuccess) onSuccess(item);
      } catch (err) {
        // 실패 시 입력값·첨부파일 유지 + 재시도 안내
        UI.showFormAlert(alertEl, `${err.message || "등록에 실패했습니다."} 잠시 후 다시 시도하세요.`);
      } finally {
        UI.setButtonLoading(submitBtn, false);
      }
    });

    return { reset, isDirty, form };
  }

  return { mount };
})();
