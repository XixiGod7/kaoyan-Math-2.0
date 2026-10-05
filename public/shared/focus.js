(() => {
  const selector =
    ".study-modal-backdrop,.ai-modal-mask,.eb-modal-overlay,.modal-overlay,.mx-shot-mask,.install-mask,.mf-modal-backdrop,.srcpg-mask,.english-study-drawer";
  let active,
    previous,
    hidden = [];
  const visible = (el) =>
    !el.hidden &&
    getComputedStyle(el).display !== "none" &&
    el.getClientRects().length > 0;
  const focusable = (el) =>
    [
      ...el.querySelectorAll("button,a[href],input,textarea,select,[tabindex]"),
    ].filter((e) => visible(e) && !e.disabled && e.tabIndex >= 0);
  function release() {
    for (const [el, value] of hidden) el.inert = value;
    hidden = [];
    if (previous?.isConnected) previous.focus();
    active = null;
  }
  function update() {
    if (document.querySelector("dialog[open]")) {
      if (active) release();
      return;
    }
    const top = [...document.querySelectorAll(selector)].filter(visible).pop();
    if (top === active) return;
    if (active) release();
    if (!top) return;
    active = top;
    previous = document.activeElement;
    const drawer = top.matches(".english-study-drawer");
    top.setAttribute("role", "dialog");
    top.setAttribute("aria-modal", String(!drawer));
    if (!drawer) {
      for (const branch of document.body.children) {
        if (branch === top || branch.contains(top)) continue;
        hidden.push([branch, branch.inert]);
        branch.inert = true;
      }
    }
    focusable(top)[0]?.focus();
  }
  document.addEventListener("keydown", (e) => {
    if (!active || e.key !== "Tab" || document.querySelector("dialog[open]"))
      return;
    const list = focusable(active);
    if (!list.length) return;
    const first = list[0],
      last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  new MutationObserver(update).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "style", "open"],
  });
})();
