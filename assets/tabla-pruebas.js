// Tabla común de pruebas registradas de antemano, con una fila de detalles desplegable.
// Cada prueba es un objeto como los que escribe publicacion/scripts/sitio.py en window.DATOS.pruebas:
// {id, en, es, registro (ISO), commit, regla_commit, criterio_en, criterio_es, resultado
//  ("passed" | "not_passed" | "rejected" | "inconclusive"), resultado_en, resultado_es,
//  ret, sr, dsr, n, dd, mp, meses, ops, dias, run_id}.
(function () {
  "use strict";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // opciones: {repo: URL del repositorio o "", explorador: "explorador.html" o "",
  //            alVerOperaciones: función(id) que muestra las operaciones de la prueba (opcional)}
  function pintar(tabla, pruebas, opciones) {
    const S = window.SITIO, l = S.idioma, t = S.t, repo = (opciones && opciones.repo) || "";
    const explorador = (opciones && opciones.explorador) || "";
    const enlaceCommit = h => (repo ? `<a href="${esc(repo)}/commit/${esc(h)}"><code>${esc(h.slice(0, 7))}</code></a>`
                                    : `<code>${esc(h.slice(0, 7))}</code>`);
    const filas = pruebas.map((p, i) => {
      const nombre = p[l].replace(/^\S+\s*/, "");
      const clase = p.resultado === "passed" ? "bien" : (p.resultado === "inconclusive" ? "" : "mal");
      const partes = [`${esc(t("tests.sharpe"))} ${S.num(p.sr, 2)}`, `${esc(t("tests.months"))} ${S.pct(p.mp, 0)} ${esc(t("tests.of"))} ${p.meses}`,
                      `${p.dias} ${esc(t("tests.days"))}`, `${esc(t("tests.run"))} <code>${esc(p.run_id)}</code>`];
      if (opciones && opciones.alVerOperaciones) partes.push(`<a href="#datos" data-ver="${esc(p.id)}">${esc(t("tests.trades"))}</a>`);
      else if (explorador) partes.push(`<a href="${esc(explorador)}?test=${encodeURIComponent(p.id)}">${esc(t("tests.trades"))}</a>`);
      const detalle = `<p><b>${esc(t("tests.rule"))}</b> (${esc(t("tests.rulecommit"))} ${enlaceCommit(p.regla_commit)}): ${esc(p["criterio_" + l])}</p>` +
        `<p><b>${esc(t("tests.outcome"))}:</b> ${esc(p["resultado_" + l])}</p><p>${partes.join(" · ")}</p>`;
      return `<tr><td class="izq"><b>${esc(p.id)}</b> ${esc(nombre)}</td><td class="izq">${esc(S.fecha(p.registro, true))}</td>` +
        `<td class="izq">${enlaceCommit(p.commit)}</td><td class="izq"><span class="${clase}">${esc(t("tests." + p.resultado))}</span></td>` +
        `<td>${S.pct(p.ret, 2, true)}</td><td>${S.num(p.dsr, 2)} <small>(N=${p.n})</small></td><td>${S.pct(p.dd, 1)}</td><td>${p.ops}</td>` +
        `<td><button type="button" class="desplegar" aria-expanded="false" aria-controls="detalle-${i}">${esc(t("tests.details"))} ▾</button></td></tr>` +
        `<tr class="detalle" id="detalle-${i}" hidden><td colspan="9"><div class="detalle-cuerpo">${detalle}</div></td></tr>`;
    }).join("");
    tabla.innerHTML = `<thead><tr><th class="izq">${esc(t("tests.test"))}</th><th class="izq">${esc(t("tests.registered"))}</th>` +
      `<th class="izq">${esc(t("tests.commit"))}</th><th class="izq">${esc(t("tests.result"))}</th><th>${esc(t("tests.ret"))}</th>` +
      `<th>${esc(t("tests.dsr"))}</th><th>${esc(t("tests.dd"))}</th><th>${esc(t("tests.ops"))}</th><th></th></tr></thead><tbody>${filas}</tbody>`;
    tabla.querySelectorAll("button.desplegar").forEach(b => b.addEventListener("click", () => {
      const fila = document.getElementById(b.getAttribute("aria-controls"));
      const abierto = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!abierto));
      fila.hidden = abierto;
    }));
    if (opciones && opciones.alVerOperaciones) {
      tabla.querySelectorAll("a[data-ver]").forEach(a => a.addEventListener("click", e => {
        e.preventDefault();
        opciones.alVerOperaciones(a.dataset.ver);
      }));
    }
  }

  window.TABLA_PRUEBAS = { pintar };
})();
