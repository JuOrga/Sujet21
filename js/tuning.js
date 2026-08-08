"use strict";

// Banc de réglage (§13, outil prioritaire) : tous les paramètres de ressenti
// en sliders modifiables en direct, export des valeurs en JSON.
const Tuning = (() => {
  const panel = document.getElementById("panel");
  const rows = document.getElementById("panelRows");

  for (const [key, label, min, max, step] of PARAM_SCHEMA) {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = label;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = P[key];
    lab.append(name, val);
    const input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = P[key];
    input.addEventListener("input", () => {
      P[key] = parseFloat(input.value);
      val.textContent = P[key];
    });
    row.append(lab, input);
    rows.append(row);
  }

  document.getElementById("exportBtn").addEventListener("click", () => {
    const out = {};
    for (const [key] of PARAM_SCHEMA) out[key] = P[key];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tension-de-surface-params.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function toggle() {
    panel.style.display = panel.style.display === "block" ? "none" : "block";
  }

  return { toggle };
})();
