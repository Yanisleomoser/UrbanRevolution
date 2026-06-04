/**
 * Urban Revolution — Design Engine · Modality "hotspot" (brief §5)
 * Tap a region on the live preview ("z.B. Kragen am Modell antippen"). The node
 * declares `regions` positioned over the garment proxy; tapping a dot opens that
 * region's choices; picking sets the region's attribute. Confirm commits the
 * merged effects. Skipping a region simply leaves it for inference to fill.
 */
(function () {
  const V = window.DEVisuals;

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const picked = { set: {}, weight: {} };

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const stage = V.el("div", { class: "de-hotspot" });
    const proxy = V.el("div", { class: "de-hotspot-proxy" });
    if (window.DesignPreview && ctx.dna) window.DesignPreview.renderInto(proxy, ctx.dna);
    stage.appendChild(proxy);

    const strip = V.el("div", { class: "de-hotspot-strip", hidden: "hidden" });

    (node.regions || []).forEach((region) => {
      const dot = V.el("button", { type: "button", class: "de-hotspot-dot", "aria-label": (region.label && region.label[lang]) || region.id });
      dot.style.left = region.x + "%";
      dot.style.top = region.y + "%";
      const tag = V.el("span", { class: "de-hotspot-tag" });
      tag.textContent = (region.label && region.label[lang]) || region.id;
      dot.appendChild(tag);
      dot.addEventListener("click", () => {
        stage.querySelectorAll(".de-hotspot-dot").forEach((d) => d.classList.remove("is-active"));
        dot.classList.add("is-active");
        strip.hidden = false;
        strip.innerHTML = "";
        (region.choices || []).forEach((choice) => {
          const b = V.el("button", { type: "button", class: "de-hotspot-choice" });
          b.textContent = (choice.label && choice.label[lang]) || choice.id;
          b.addEventListener("click", () => {
            if (choice.effects && choice.effects.set) Object.assign(picked.set, choice.effects.set);
            if (choice.effects && choice.effects.weight) Object.assign(picked.weight, choice.effects.weight);
            dot.classList.add("is-done");
            dot.classList.remove("is-active");
            strip.hidden = true;
          });
          strip.appendChild(b);
        });
      });
      stage.appendChild(dot);
    });

    host.appendChild(stage);
    host.appendChild(strip);

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(picked));
    host.appendChild(confirm);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.hotspot = render;
})();
