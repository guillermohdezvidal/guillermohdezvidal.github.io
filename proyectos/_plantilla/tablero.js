// Panel de ejemplo de la plantilla. Usa una base resultados.sqlite con, al menos, estas tablas:
//   metrics (key, value, text, description_en, description_es)   cifras para las tarjetas
//   series (series, label_en, label_es)                          curvas de capital
//   capital_daily (series, day, capital)                         capital diario (puede ser una vista)
//   monthly_returns (series, month, ret)                         rentabilidad mensual
// La pestaña «Datos» se construye sola con todas las tablas de la base.
// Para un proyecto real: añade pestañas en index.html y una función pintar por pestaña aquí.
(function () {
  "use strict";
  const S = window.SITIO, P = window.PANEL, GC = window.GRAFICAS_COMUN;
  const L = () => (S.idioma === "es" ? "es" : "en");
  const vacio = id => GC.vaciar(id, S.t("panel.empty"));

  // Tarjetas: las cifras de la tabla metrics que se quieran destacar (clave, decimales).
  const TARJETAS = [["tests", 0], ["passed", 0], ["best_sharpe", 2]];

  function pintarResumen() {
    const m = Object.fromEntries(P.filas(`SELECT key, value, text, description_${L()} AS d FROM metrics`).map(r => [r.key, r]));
    document.getElementById("kpis-resumen").innerHTML = TARJETAS.filter(([k]) => m[k]).map(([k, dec]) =>
      `<div class="kpi"><b>${m[k].value !== null ? S.num(m[k].value, dec) : m[k].text}</b><span>${m[k].d}</span></div>`).join("");
    const [w, p] = P.rangoFechas("day");
    const series = P.filas(`SELECT series, label_${L()} AS t FROM series ORDER BY rowid`);
    const pal = GC.categorias();
    const trazas = series.map((s, i) => {
      const f = P.filas(`SELECT day, capital FROM capital_daily WHERE series = ? AND ${w} ORDER BY day`, [s.series, ...p]);
      return { type: "scatter", mode: "lines", name: s.t, x: f.map(r => r.day), y: f.map(r => r.capital), line: { color: pal[i % pal.length], width: 2 } };
    }).filter(t => t.x.length);
    if (!trazas.length) return vacio("g-curvas");
    GC.dibujar("g-curvas", trazas, { yaxis: { title: { text: "USD" } } });
  }

  function pintarResultados() {
    const filas = P.filas("SELECT series, month, ret FROM monthly_returns ORDER BY series, month");
    if (!filas.length) return vacio("g-mensual");
    const series = [...new Set(filas.map(r => r.series))], pal = GC.categorias();
    GC.dibujar("g-mensual", series.map((s, i) => {
      const f = filas.filter(r => r.series === s);
      return { type: "bar", name: s, x: f.map(r => r.month), y: f.map(r => 100 * r.ret), marker: { color: pal[i % pal.length] } };
    }), { barmode: "group", yaxis: { title: { text: "%" } } });
  }

  // Datos: un conjunto por tabla, sin filtros (añádelos como en proyectos/arbitraje-estadistico/tablero.js).
  let explorador = null;
  function pintarDatos() {
    if (!explorador) {
      const tablas = P.consultar("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name").values.map(v => v[0]);
      const conjuntos = Object.fromEntries(tablas.map(t => [t, { sql: () => `SELECT * FROM ${t}`, orden: "1", filtros: [] }]));
      tablas.forEach(t => { window.TEXTOS_PAGINA.en["ex.ds." + t] = t; window.TEXTOS_PAGINA.es["ex.ds." + t] = t; });
      explorador = window.EXPLORADOR.montar(document.getElementById("explorador"), {
        conjuntos, orden: tablas, columnas: {}, decimales: {}, descarga: "resultados.sqlite",
        ejemplos: () => [["ex.example", `SELECT * FROM ${tablas[0]} LIMIT 20;`]],
      });
    }
    explorador.pintar();
  }

  const p = (window.PROYECTOS || []).find(x => x.carpeta === document.documentElement.dataset.carpeta) || { enlaces: {} };
  if (p.enlaces && p.enlaces.pdf === "") document.getElementById("enlace-pdf").hidden = true;
  const panelFiltros = document.getElementById("filtros-panel");
  panelFiltros.open = window.innerWidth >= 700;
  P.iniciar({
    bd: "resultados.sqlite.gz", bdPlano: "resultados.sqlite", porDefecto: "resumen",
    pestanas: {
      resumen: { filtros: ["fechas"], pintar: pintarResumen },
      resultados: { filtros: [], pintar: pintarResultados },
      datos: { filtros: [], pintar: pintarDatos },
    },
    rangos: [{ clave: "all" }],
  });
})();
