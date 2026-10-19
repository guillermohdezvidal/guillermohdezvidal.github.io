// Motor común de los paneles de proyecto: carga la base SQLite en el navegador (sql.js), gestiona las
// pestañas (cada una con su dirección #pestaña) y la barra de filtros, y vuelve a dibujar la pestaña
// visible cuando cambia un filtro, el idioma o el tema. No hay servidor: todo ocurre en la página.
//
// Uso: PANEL.iniciar({ bd: "resultados.sqlite.gz", bdPlano: "resultados.sqlite", porDefecto: "resumen",
//   pestanas: { id: { filtros: ["prueba", "fechas", "contrato"], pintar: (estado) => {...} } },
//   opcionesPrueba: () => [[valor, texto]], pruebaPorDefecto: "P2", opcionesContrato: () => ["PF_XBTUSD", ...],
//   rangos: [{ clave, desde, hasta }] })
(function () {
  "use strict";
  const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
  const S = () => window.SITIO;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let bd = null, cfg = null, actual = null, pendientes = new Set(), temporizador = null, errorCarga = null;
  const estado = { prueba: "", desde: "", hasta: "", contrato: "" };

  // --- Base de datos ----------------------------------------------------------------------------------------
  async function cargarBD(url, plano) {
    const SQL = await initSqlJs({ locateFile: f => SQLJS + f });
    let bytes;
    try {
      const r = await fetch(url, { cache: "no-cache" });       // revalida: si no cambió, no se descarga
      if (!r.ok) throw new Error(String(r.status));
      bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {          // gzip: lo descomprime el navegador
        if (!("DecompressionStream" in window)) throw new Error("sin DecompressionStream");
        const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        bytes = new Uint8Array(await new Response(flujo).arrayBuffer());
      }
    } catch (e) {                                            // navegador antiguo: la copia sin comprimir
      const r = await fetch(plano, { cache: "no-cache" });
      bytes = new Uint8Array(await r.arrayBuffer());
    }
    return new SQL.Database(bytes);
  }
  function consultar(sql, params) {
    const res = bd.exec(sql, params || []);
    return res.length ? res[res.length - 1] : { columns: [], values: [] };
  }
  function filas(sql, params) {
    const r = consultar(sql, params);
    return r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]])));
  }
  function valor(sql, params) {
    const r = consultar(sql, params);
    return r.values.length ? r.values[0][0] : null;
  }

  // --- Barra de filtros ------------------------------------------------------------------------------------
  function barraFiltros() {
    const cont = document.getElementById("filtros-panel");
    if (!cont) return;
    const t = S().t;
    const pruebas = cfg.opcionesPrueba ? cfg.opcionesPrueba() : [];
    const contratos = cfg.opcionesContrato ? cfg.opcionesContrato() : [];
    const rapidos = (cfg.rangos || []).map(r => `<button type="button" class="boton secundario pequeno" data-rango="${esc(r.clave)}">${esc(t("filter.range." + r.clave))}</button>`).join("");
    cont.innerHTML = `<summary>${esc(t("filter.show"))}</summary><div class="filtros">` +
      `<label data-filtro="prueba"><span>${esc(t("filter.test"))}</span><select id="f-prueba">` +
      pruebas.map(([v, n]) => `<option value="${esc(v)}"${v === estado.prueba ? " selected" : ""}>${esc(n)}</option>`).join("") + `</select></label>` +
      `<label data-filtro="fechas"><span>${esc(t("filter.from"))}</span><input type="date" id="f-desde" value="${esc(estado.desde)}"></label>` +
      `<label data-filtro="fechas"><span>${esc(t("filter.to"))}</span><input type="date" id="f-hasta" value="${esc(estado.hasta)}"></label>` +
      `<div class="rapidos" data-filtro="fechas">${rapidos}</div>` +
      `<label data-filtro="contrato"><span>${esc(t("filter.contract"))}</span><input type="search" id="f-contrato" list="lista-contratos" value="${esc(estado.contrato)}" placeholder="${esc(t("filter.contract.ph"))}">` +
      `<datalist id="lista-contratos">${contratos.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>` +
      `<button type="button" class="boton secundario pequeno" id="f-limpiar">${esc(t("filter.reset"))}</button></div>` +
      `<p class="nota-filtros" id="nota-filtros"></p>`;
    const cambio = (clave, v, inmediato) => {
      estado[clave] = v;
      clearTimeout(temporizador);
      temporizador = setTimeout(redibujarTodo, inmediato ? 0 : 250);
    };
    document.getElementById("f-prueba").addEventListener("change", e => cambio("prueba", e.target.value, true));
    document.getElementById("f-desde").addEventListener("change", e => cambio("desde", e.target.value, true));
    document.getElementById("f-hasta").addEventListener("change", e => cambio("hasta", e.target.value, true));
    document.getElementById("f-contrato").addEventListener("input", e => cambio("contrato", e.target.value.trim().toUpperCase(), false));
    cont.querySelectorAll("[data-rango]").forEach(b => b.addEventListener("click", () => {
      const r = cfg.rangos.find(x => x.clave === b.dataset.rango);
      estado.desde = r.desde || ""; estado.hasta = r.hasta || "";
      document.getElementById("f-desde").value = estado.desde;
      document.getElementById("f-hasta").value = estado.hasta;
      redibujarTodo();
    }));
    document.getElementById("f-limpiar").addEventListener("click", () => {
      estado.desde = ""; estado.hasta = ""; estado.contrato = ""; estado.prueba = cfg.pruebaPorDefecto || "";
      barraFiltros(); mostrarFiltros(); redibujarTodo();
    });
    mostrarFiltros();
  }
  function mostrarFiltros() {
    const cont = document.getElementById("filtros-panel");
    if (!cont || !actual) return;
    const usados = (cfg.pestanas[actual] && cfg.pestanas[actual].filtros) || [];
    cont.hidden = usados.length === 0;
    cont.querySelectorAll("[data-filtro]").forEach(el => { el.hidden = !usados.includes(el.dataset.filtro); });
    const nota = document.getElementById("nota-filtros");
    if (nota) nota.textContent = S().t("filter.note." + actual) === "filter.note." + actual ? "" : S().t("filter.note." + actual);
  }

  // --- Pestañas ------------------------------------------------------------------------------------------------
  function pestanaDeHash() {
    const h = location.hash.replace("#", "").split("?")[0];
    return cfg.pestanas[h] ? h : cfg.porDefecto;
  }
  function mostrar(id) {
    actual = id;
    document.querySelectorAll("[data-pestana]").forEach(a => a.setAttribute("aria-selected", String(a.dataset.pestana === id)));
    document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== id; });
    mostrarFiltros();
    if (pendientes.has(id) || !pintadas.has(id)) pintar(id);
    const a = document.querySelector(`[data-pestana="${id}"]`);
    if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  const pintadas = new Set();
  function pintar(id) {
    const p = cfg.pestanas[id];
    if (!p) return;
    if (!bd) { pendientes.add(id); return; }
    pendientes.delete(id);
    pintadas.add(id);
    try { p.pintar(estado); } catch (e) { console.error(e); }
  }
  function redibujarTodo() {
    Object.keys(cfg.pestanas).forEach(id => { if (id !== actual) pendientes.add(id); });
    if (actual) pintar(actual);
  }

  async function iniciar(config) {
    cfg = config;
    estado.prueba = cfg.pruebaPorDefecto || "";
    document.querySelectorAll("[data-pestana]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      history.replaceState(null, "", "#" + a.dataset.pestana);
      mostrar(a.dataset.pestana);
      window.scrollTo({ top: 0 });
    }));
    window.addEventListener("hashchange", () => mostrar(pestanaDeHash()));
    S().alCambiarIdioma(() => { if (bd) barraFiltros(); estadoCarga(); redibujarTodo(); });
    S().alCambiarTema(() => redibujarTodo());
    let ancho = window.innerWidth;
    window.addEventListener("resize", () => {           // al cruzar el umbral del móvil cambian los márgenes
      if ((ancho < 700) !== (window.innerWidth < 700)) { ancho = window.innerWidth; redibujarTodo(); }
    });
    S().iniciar();
    mostrar(pestanaDeHash());
    estadoCarga();
    try {
      bd = await cargarBD(cfg.bd, cfg.bdPlano);
    } catch (e) {
      errorCarga = e;
      console.error(e);
    }
    estadoCarga();
    if (bd) { barraFiltros(); redibujarTodo(); }
  }
  function estadoCarga() {
    if (bd) return;
    const texto = errorCarga ? S().t("panel.error") + " " + errorCarga.message : S().t("panel.loading");
    document.querySelectorAll(".grafica").forEach(g => {
      if (!g.querySelector(".main-svg")) g.innerHTML = `<div class="cargando" style="height:100%">${esc(texto)}</div>`;
    });
  }

  // Cláusula de fechas: devuelve [sql, params] para una columna de fecha (texto ISO).
  function rangoFechas(columna) {
    const w = [], p = [];
    if (estado.desde) { w.push(`${columna} >= ?`); p.push(estado.desde); }
    if (estado.hasta) { w.push(`${columna} <= ?`); p.push(estado.hasta + "T23:59"); }
    return [w.length ? w.join(" AND ") : "1 = 1", p];
  }

  window.PANEL = {
    iniciar, consultar, filas, valor, rangoFechas, estado,
    get bd() { return bd; },
  };
})();
