/**
 * Urban Revolution — Design Engine · Modality "ranking" (brief §5)
 * Order several options from most to least "you". A soft signal: the flow grades
 * each option's archetype weight by its rank (top counts full, then decays).
 * Accessible reorder via ↑/↓ (the keyboard/tap equivalent of a swipe-rank);
 * commits the ordered id array.
 */
(function () {
  const V = window.DEVisuals;

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const order = (node.options || []).map((o) => o.id);

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const list = V.el("ol", { class: "de-rank" });
    const move = (from, to) => { order.splice(to, 0, order.splice(from, 1)[0]); paint(); };

    function paint() {
      list.innerHTML = "";
      order.forEach((id, idx) => {
        const opt = (node.options || []).find((o) => o.id === id) || { label: {} };
        const li = V.el("li", { class: "de-rank-item" });
        const num = V.el("span", { class: "de-rank-num" }); num.textContent = String(idx + 1);
        const label = V.el("span", { class: "de-rank-label" }); label.textContent = (opt.label && opt.label[lang]) || id;
        const up = V.el("button", { type: "button", class: "de-rank-btn", "aria-label": ctx.t("engine.rank_up") });
        up.textContent = "↑"; up.disabled = idx === 0;
        up.addEventListener("click", () => move(idx, idx - 1));
        const down = V.el("button", { type: "button", class: "de-rank-btn", "aria-label": ctx.t("engine.rank_down") });
        down.textContent = "↓"; down.disabled = idx === order.length - 1;
        down.addEventListener("click", () => move(idx, idx + 1));
        li.appendChild(num); li.appendChild(label); li.appendChild(up); li.appendChild(down);
        list.appendChild(li);
      });
    }
    paint();
    host.appendChild(list);

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(order.slice()));
    host.appendChild(confirm);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.ranking = render;
})();
