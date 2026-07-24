/**
 * Urban Revolution — Design Engine · Modality "slider"
 * A range between two labelled poles. Drags emit ctx.live(value) for a live
 * preview nudge; "confirm" commits the 0..1 value. Keyboard-operable (native
 * range input). Soft archetype nudges at the extremes resolve in the flow.
 * Under the track a live mono readout names the position (value + the pole
 * word it leans to) — the empty space answers instead of staying blank. It is
 * aria-hidden: the native range already announces its value to AT.
 */
(function () {
  const V = window.DEVisuals;

  function render(host, node, ctx) {
    host.innerHTML = "";
    const lang = ctx.lang;
    const axis = (node.axis && node.axis[lang]) || ["", ""];

    const q = V.el("h2", { class: "de-question" });
    q.textContent = node.question ? node.question[lang] : "";
    host.appendChild(q);

    const wrap = V.el("div", { class: "de-slider" });
    const poles = V.el("div", { class: "de-slider-poles" });
    const lo = V.el("span", { class: "de-pole de-pole-lo" }); lo.textContent = axis[0];
    const hi = V.el("span", { class: "de-pole de-pole-hi" }); hi.textContent = axis[1];
    poles.appendChild(lo); poles.appendChild(hi);

    const input = V.el("input", { type: "range", min: "0", max: "100", value: "50", class: "de-range" });
    input.setAttribute("aria-label", node.question ? node.question[lang] : "");
    // Live-Readout: Prozent + das Pol-Wort, zu dem die Position neigt — die
    // Maschinenstimme beziffert den Regler, statt Leerraum zu lassen.
    const read = V.el("p", { class: "de-slider-read", "aria-hidden": "true" });
    const readVal = V.el("b", { class: "de-slider-read-val" });
    const readWord = V.el("span", { class: "de-slider-read-word" });
    read.appendChild(readVal);
    read.appendChild(readWord);
    // --val füttert die CSS-Füllung der Spur; data-side hebt den Pol hervor,
    // dem sich der Regler nähert — die Achse liest sich als Spannung zwischen
    // zwei Worten, nicht als Browser-Widget. (Der Flat morpht ohnehin live.)
    const sync = () => {
      input.style.setProperty("--val", input.value + "%");
      const side = input.value < 34 ? "lo" : input.value > 66 ? "hi" : "mid";
      wrap.dataset.side = side;
      readVal.textContent = input.value + " %";
      readWord.textContent = side === "lo" ? axis[0] : side === "hi" ? axis[1] : ctx.t("engine.slider_mid");
    };
    input.addEventListener("input", () => { sync(); ctx.live(input.value / 100); });
    sync();

    wrap.appendChild(poles);
    wrap.appendChild(input);
    wrap.appendChild(read);
    host.appendChild(wrap);

    const confirm = V.el("button", { type: "button", class: "de-confirm" });
    confirm.textContent = ctx.t("engine.confirm");
    confirm.addEventListener("click", () => ctx.commit(input.value / 100));
    host.appendChild(confirm);
  }

  window.DEModalities = window.DEModalities || {};
  window.DEModalities.slider = render;
})();
