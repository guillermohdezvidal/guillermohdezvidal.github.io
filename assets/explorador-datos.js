// Pestaña «Datos» genérica: tablas con filtros sencillos, consulta SQL (Intro ejecuta, Mayús+Intro añade
// línea), descarga en CSV y de la base completa. Usa la base que ya cargó PANEL.
//
// EXPLORADOR.montar(contenedor, {
//   conjuntos: { clave: { sql: (l) => "SELECT ...", base: "condición fija", orden: "columna",
//                         filtros: [{ id, tipo: "lista"|"texto"|"casilla"|"desde"|"hasta", campo | campos,
//                                     etiqueta, opciones: (l) => [[valor, texto]] }] } },
//   orden: ["clave", ...], ejemplos: (l) => [["clave de texto", "SQL"]], columnas: { col: ["en", "es"] },
//   decimales: { col: n }, descarga: "resultados.sqlite" })
(function () {
  "use strict";
  const MAX_FILAS = 500;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function montar(cont, cfg) {
    const S = window.SITIO, P = window.PANEL;
    const L = () => (S.idioma === "es" ? "es" : "en");
    const est = { conjunto: cfg.orden[0], valores: {}, pestana: "filtros", sqlHecha: false };
    if (cfg.inicial) Object.assign(est.valores, cfg.inicial);

    const col = c => (cfg.columnas[c] ? cfg.columnas[c][S.idioma === "es" ? 1 : 0] : c);
    function formatear(v, c) {
      if (v === null || v === undefined) return "<span class='nota'>—</span>";
      if (typeof v === "number") {
        if (Number.isInteger(v)) return String(v);
        const d = cfg.decimales[c] !== undefined ? cfg.decimales[c] : (Math.abs(v) >= 100 ? 2 : 4);
        return S.num(v, d);
      }
      return esc(v);
    }
    function pintarTabla(tabla, res, traducir) {
      const cab = res.columns.map(c => `<th>${esc(traducir ? col(c) : c)}</th>`).join("");
      const cuerpo = res.values.slice(0, MAX_FILAS).map(f => "<tr>" + f.map((v, i) =>
        `<td class="${typeof v === "number" ? "" : "izq"}">${formatear(v, res.columns[i])}</td>`).join("") + "</tr>").join("");
      tabla.innerHTML = `<thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody>`;
    }
    function descargarCsv(res) {
      const celda = v => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      const texto = [res.columns.join(","), ...res.values.map(f => f.map(celda).join(","))].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
      a.download = "datos.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function resumen(div, res, sqlTexto) {
      const n = res.values.length;
      let html = `<b>${n.toLocaleString(S.idioma === "es" ? "es-ES" : "en-GB")}</b> ${esc(S.t("ex.rows"))}`;
      if (n > MAX_FILAS) html += ` (${esc(S.t("ex.showing"))} ${MAX_FILAS})`;
      html += ` <button type="button" class="boton secundario pequeno" data-accion="csv">${esc(S.t("ex.csv"))}</button>`;
      if (sqlTexto) html += ` <button type="button" class="boton secundario pequeno" data-accion="sql">${esc(S.t("ex.tosql"))}</button>`;
      div.innerHTML = html;
      div.querySelector("[data-accion=csv]").addEventListener("click", () => descargarCsv(res));
      const b = div.querySelector("[data-accion=sql]");
      if (b) b.addEventListener("click", () => { cont.querySelector(".sql").value = sqlTexto; elegir("sql"); ejecutarSql(); });
    }

    // Estructura.
    cont.innerHTML =
      `<p class="nota"><a href="${esc(cfg.descarga)}" download>${esc(S.t("ex.download"))}</a> · ${esc(S.t("ex.readonly"))}</p>` +
      `<div class="subpestanas" role="tablist"><button type="button" role="tab" data-sub="filtros"></button><button type="button" role="tab" data-sub="sql"></button></div>` +
      `<div class="subpanel" data-subpanel="filtros"><div class="filtros"></div><div class="resumen-consulta"></div>` +
      `<div class="tabla-envoltorio resultados"><table></table></div></div>` +
      `<div class="subpanel" data-subpanel="sql" hidden><div class="filtros"><label><span class="et-ejemplos"></span><select class="ejemplos"></select></label>` +
      `<button type="button" class="boton pequeno ejecutar"></button></div><p class="nota ayuda-sql"></p>` +
      `<p><textarea class="sql" spellcheck="false" aria-label="SQL"></textarea></p><div class="error" hidden></div>` +
      `<div class="resumen-consulta"></div><div class="tabla-envoltorio resultados"><table></table></div>` +
      `<h3 class="et-esquema"></h3><div class="esquema"></div></div>`;
    const pf = cont.querySelector("[data-subpanel=filtros]"), ps = cont.querySelector("[data-subpanel=sql]");

    function elegir(cual) {
      est.pestana = cual;
      cont.querySelectorAll("[data-sub]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === cual)));
      pf.hidden = cual !== "filtros"; ps.hidden = cual !== "sql";
    }
    cont.querySelectorAll("[data-sub]").forEach(b => b.addEventListener("click", () => elegir(b.dataset.sub)));

    // Filtros.
    function opciones(lista, actual) {
      return lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(actual) ? " selected" : ""}>${esc(t)}</option>`).join("");
    }
    function controles() {
      const c = cfg.conjuntos[est.conjunto], val = est.valores, todos = ["", S.t("ex.all")];
      let html = `<label><span>${esc(S.t("ex.dataset"))}</span><select data-filtro="conjunto">` +
        opciones(cfg.orden.map(k => [k, S.t("ex.ds." + k)]), est.conjunto) + "</select></label>";
      c.filtros.forEach(f => {
        if (f.tipo === "lista") {
          html += `<label><span>${esc(S.t(f.etiqueta))}</span><select data-filtro="${f.id}">${opciones([todos, ...f.opciones(L())], val[f.id] || "")}</select></label>`;
        } else if (f.tipo === "texto") {
          html += `<label><span>${esc(S.t(f.etiqueta))}</span><input type="search" data-filtro="${f.id}" value="${esc(val[f.id] || "")}"></label>`;
        } else if (f.tipo === "casilla") {
          html += `<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-filtro="${f.id}"${val[f.id] ? " checked" : ""}><span>${esc(S.t(f.etiqueta))}</span></label>`;
        } else {
          html += `<label><span>${esc(S.t(f.tipo === "desde" ? "filter.from" : "filter.to"))}</span><input type="date" data-filtro="${f.id}" value="${esc(val[f.id] || "")}"></label>`;
        }
      });
      const div = pf.querySelector(".filtros");
      div.innerHTML = html;
      div.querySelectorAll("[data-filtro]").forEach(el => {
        el.addEventListener(el.type === "search" ? "input" : "change", () => {
          if (el.dataset.filtro === "conjunto") { est.conjunto = el.value; est.valores = {}; controles(); }
          else est.valores[el.dataset.filtro] = el.type === "checkbox" ? el.checked : el.value;
          ejecutarFiltros();
        });
      });
    }
    function construir() {
      const c = cfg.conjuntos[est.conjunto], val = est.valores;
      const w = c.base ? [c.base] : [], p = [], lit = c.base ? [c.base] : [];
      const q = v => (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
      c.filtros.forEach(f => {
        const v = val[f.id];
        if (v === undefined || v === "" || v === false) return;
        if (f.tipo === "texto") {
          const patron = "%" + String(v).trim().toUpperCase() + "%";
          w.push("(" + f.campos.map(k => `UPPER(${k}) LIKE ?`).join(" OR ") + ")");
          f.campos.forEach(() => p.push(patron));
          lit.push("(" + f.campos.map(k => `UPPER(${k}) LIKE ${q(patron)}`).join(" OR ") + ")");
        } else if (f.tipo === "casilla") { w.push(`${f.campo} = 1`); lit.push(`${f.campo} = 1`); }
        else if (f.tipo === "desde") { w.push(`${f.campo} >= ?`); p.push(v); lit.push(`${f.campo} >= ${q(v)}`); }
        else if (f.tipo === "hasta") { w.push(`${f.campo} <= ?`); p.push(v + "T23:59"); lit.push(`${f.campo} <= ${q(v + "T23:59")}`); }
        else { w.push(`${f.campo} = ?`); p.push(v); lit.push(`${f.campo} = ${q(v)}`); }
      });
      const cola = x => (x.length ? " WHERE " + x.join(" AND ") : "") + " ORDER BY " + c.orden;
      const sql = c.sql(L());
      return { sql: sql + cola(w), params: p, texto: sql + cola(lit) + ";" };
    }
    function ejecutarFiltros() {
      const q = construir(), res = P.consultar(q.sql, q.params);
      pintarTabla(pf.querySelector("table"), res, true);
      resumen(pf.querySelector(".resumen-consulta"), res, q.texto);
    }

    // SQL.
    const ta = ps.querySelector(".sql");
    function ejecutarSql() {
      const err = ps.querySelector(".error");
      try {
        const res = P.consultar(ta.value);
        err.hidden = true;
        est.sqlHecha = true;
        pintarTabla(ps.querySelector("table"), res, false);
        resumen(ps.querySelector(".resumen-consulta"), res, "");
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    }
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ejecutarSql(); }   // Mayús+Intro: nueva línea
    });
    ps.querySelector(".ejecutar").addEventListener("click", ejecutarSql);
    ps.querySelector(".ejemplos").addEventListener("change", e => {
      if (e.target.value === "") return;
      ta.value = cfg.ejemplos(L())[Number(e.target.value)][1];
      ejecutarSql();
    });
    function esquema() {
      const l = L(), notas = {};
      try {
        P.consultar(`SELECT table_name, column_name, description_${l} FROM schema_notes`).values.forEach(([t, c, d]) => { notas[t + "." + c] = d; });
      } catch (e) { /* sin notas */ }
      const tablas = P.consultar("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name").values;
      ps.querySelector(".esquema").innerHTML = tablas.map(([t, tipo]) => {
        const cols = P.consultar(`PRAGMA table_info(${t})`).values;
        const n = P.valor(`SELECT COUNT(*) FROM ${t}`);
        return `<details><summary><code>${esc(t)}</code>${tipo === "view" ? " (view)" : ""} · ${n} ${esc(S.t("ex.rows"))}${notas[t + "."] ? " — " + esc(notas[t + "."]) : ""}</summary><ul>` +
          cols.map(c => `<li><code>${esc(c[1])}</code> <span class="nota">${esc(c[2])}</span>${notas[t + "." + c[1]] ? " — " + esc(notas[t + "." + c[1]]) : ""}</li>`).join("") + "</ul></details>";
      }).join("");
    }

    function textos() {
      cont.querySelector("[data-sub=filtros]").textContent = S.t("ex.tab.filters");
      cont.querySelector("[data-sub=sql]").textContent = S.t("ex.tab.sql");
      ps.querySelector(".et-ejemplos").textContent = S.t("ex.examples");
      ps.querySelector(".ejecutar").textContent = S.t("ex.run");
      ps.querySelector(".ayuda-sql").textContent = S.t("ex.sqlhelp");
      ps.querySelector(".et-esquema").textContent = S.t("ex.schema");
      const sel = ps.querySelector(".ejemplos");
      sel.innerHTML = `<option value="">—</option>` + cfg.ejemplos(L()).map(([k], i) => `<option value="${i}">${esc(S.t(k))}</option>`).join("");
      if (!ta.value) ta.value = cfg.ejemplos(L())[0][1];
    }

    elegir("filtros");
    return {
      pintar() { textos(); controles(); ejecutarFiltros(); esquema(); if (est.sqlHecha) ejecutarSql(); },
      filtrar(valores, conjunto) { est.conjunto = conjunto || cfg.orden[0]; est.valores = Object.assign({}, valores); elegir("filtros"); },
    };
  }

  window.EXPLORADOR = { montar };
})();
