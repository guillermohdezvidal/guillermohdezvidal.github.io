// Panel del proyecto de arbitraje estadístico. Todas las gráficas se calculan en el navegador a partir de
// resultados.sqlite (cargada por assets/panel.js) y responden a los filtros de la pestaña visible.
(function () {
  "use strict";
  const S = window.SITIO, P = window.PANEL, GC = window.GRAFICAS_COMUN;
  const L = () => (S.idioma === "es" ? "es" : "en");
  const es = () => S.idioma === "es";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tx = (k, v) => Object.keys(v || {}).reduce((s, n) => s.replace("{" + n + "}", v[n]), S.t(k));
  const PROYECTO = (window.PROYECTOS || []).find(p => p.carpeta === "arbitraje-estadistico") || { enlaces: {} };

  // --- Utilidades ------------------------------------------------------------------------------------------
  let M = null, PRUEBAS = null;
  function m() {
    if (!M) { M = {}; P.filas("SELECT key, value, text FROM metrics").forEach(r => { M[r.key] = r.value !== null ? r.value : r.text; }); }
    return M;
  }
  function pruebas() { if (!PRUEBAS) PRUEBAS = P.filas("SELECT * FROM tests ORDER BY rowid"); return PRUEBAS; }
  const nombreCorto = p => p.id + " " + p["name_" + L()].replace(/^\S+\s*/, "");
  function kpis(id, lista) {
    document.getElementById(id).innerHTML = lista.map(([v, t, clase]) =>
      `<div class="kpi ${clase || ""}"><b>${v}</b><span>${t}</span></div>`).join("");
  }
  const DESTACADAS = ["P2", "A1", "B1", "C1", "C1-full"];
  function colorSerie(id) { const c = GC.colores(); return { P2: c.verde, A1: c.azul, B1: c.rojo, C1: c.naranja, "C1-full": c.morado }[id] || c.gris; }
  function capital(serie) {
    const [w, p] = P.rangoFechas("day");
    return P.filas(`SELECT day, capital FROM capital_daily WHERE series = ? AND ${w} ORDER BY day`, [serie, ...p]);
  }
  function caidas(ys) { let max = -Infinity; return ys.map(y => { max = Math.max(max, y); return 100 * (y / max - 1); }); }
  function filtroContrato(campos) {
    const c = P.estado.contrato;
    if (!c) return ["1 = 1", []];
    return ["(" + campos.map(k => `UPPER(${k}) LIKE ?`).join(" OR ") + ")", campos.map(() => "%" + c + "%")];
  }
  const hayFiltros = () => !!(P.estado.desde || P.estado.hasta || P.estado.contrato);
  const corto = s => String(s || "").replace(/^PF_/, "").replace(/USD$/, "");
  const vacio = id => GC.vaciar(id, S.t("panel.empty"));
  const usd = (x, d) => (x > 0 ? "+" : "") + S.num(x, d === undefined ? 2 : d);
  function lineaV(x, color, punteada) {
    return { type: "line", x0: x, x1: x, y0: 0, y1: 1, yref: "paper", line: { color, width: 1.3, dash: punteada ? "dot" : "dash" } };
  }
  function lineaH(y, color, eje) {
    return { type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, yref: eje || "y", line: { color, width: 1.2, dash: "dash" } };
  }
  // Cascada con barras flotantes (base + altura): pasos [etiqueta, valor, color, esTotal].
  function cascada(id, pasos) {
    let acumulado = 0;
    const base = [], alto = [], color = [], texto = [];
    pasos.forEach(([, v, c, total]) => {
      if (total) { base.push(0); alto.push(v); acumulado = v; }
      else { base.push(acumulado); alto.push(v); acumulado += v; }
      color.push(c); texto.push(usd(v, 1));
    });
    GC.dibujar(id, [{ type: "bar", x: pasos.map(p => p[0]), y: alto, base, marker: { color }, text: texto, textposition: "outside",
                      cliponaxis: false, hovertemplate: "%{x}: %{text}<extra></extra>" }],
               { showlegend: false, yaxis: { title: { text: "USD" } }, margin: { t: 24, b: 60 } });
  }
  // Capital (arriba) y caída desde el máximo (abajo) de una serie.
  function capitalYCaida(id, serie, color, extra) {
    const f = capital(serie);
    if (!f.length) return vacio(id);
    const x = f.map(r => r.day), y = f.map(r => r.capital), c = GC.colores();
    const datos = [
      { type: "scatter", mode: "lines", x, y, line: { color, width: 2 }, name: serie, hovertemplate: "%{x|%d %b %Y}: %{y:.2f} USD<extra></extra>" },
      { type: "scatter", mode: "lines", x, y: caidas(y), xaxis: "x2", yaxis: "y2", fill: "tozeroy", line: { color: c.rojo, width: 1 },
        name: es() ? "caída" : "drawdown", hovertemplate: "%{x|%d %b %Y}: %{y:.2f} %<extra></extra>" },
    ];
    const layout = Object.assign({
      showlegend: false, hovermode: "x",
      yaxis: { domain: [0.36, 1], title: { text: "USD" } }, xaxis: { anchor: "y", showticklabels: false, range: [x[0], x[x.length - 1]] },
      yaxis2: { domain: [0, 0.27], title: { text: es() ? "caída %" : "drawdown %" }, rangemode: "tozero" },
      xaxis2: { anchor: "y2", matches: "x" },
      shapes: [lineaH(1000, c.gris)],
    }, extra || {});
    if (extra && extra.shapes) layout.shapes = [lineaH(1000, c.gris), ...extra.shapes];
    GC.dibujar(id, datos, layout);
  }

  // --- Resumen ------------------------------------------------------------------------------------------------
  let visibles = null;
  function pintarResumen() {
    const v = m();
    kpis("kpis-resumen", [
      ["16", S.t("kpi.tests")],
      ["0", S.t("kpi.passed"), "mal"],
      [String(v.weeks), `${S.t("kpi.period")} · ${S.fecha(v.period_start)} – ${S.fecha(v.period_end)}`],
      [String(v.contracts), `${S.t("kpi.contracts")} · ${tx("kpi.contracts.detail", { v: v.contracts_live, d: v.contracts_delisted })}`],
    ]);
    document.getElementById("fecha-generado").textContent = S.fecha(v.generated) + " (commit " + v.commit + ")";
    const series = P.filas("SELECT series, label_en, label_es FROM series ORDER BY rowid");
    if (!visibles) visibles = new Set(series.map(s => s.series));
    const chips = document.getElementById("chips-curvas");
    chips.innerHTML = `<button type="button" data-todas="1" aria-pressed="false">${esc(S.t("ex.all"))}</button>` +
      `<button type="button" data-todas="0" aria-pressed="false">${esc(es() ? "Ninguna" : "None")}</button>` +
      series.map(s => `<button type="button" data-serie="${esc(s.series)}" aria-pressed="${visibles.has(s.series)}" title="${esc(s["label_" + L()])}">` +
        `<span class="punto" style="background:${colorSerie(s.series)}"></span>${esc(s.series)}</button>`).join("");
    chips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.todas === "1") series.forEach(s => visibles.add(s.series));
      else if (b.dataset.todas === "0") visibles.clear();
      else if (visibles.has(b.dataset.serie)) visibles.delete(b.dataset.serie);
      else visibles.add(b.dataset.serie);
      pintarResumen();
    }));
    const c = GC.colores();
    const trazas = series.filter(s => visibles.has(s.series)).map(s => {
      const f = capital(s.series);
      const dest = DESTACADAS.includes(s.series);
      return { type: "scatter", mode: "lines", x: f.map(r => r.day), y: f.map(r => r.capital), name: s.series,
               line: { color: colorSerie(s.series), width: dest ? 2.2 : 1.1, dash: s.series === "C1-full" ? "dot" : "solid" },
               opacity: dest ? 1 : 0.75,
               hovertemplate: `<b>${esc(s.series)}</b> ${esc(s["label_" + L()].replace(/^\S+\s*/, ""))}<br>%{x|%d %b %Y}: %{y:.2f} USD<extra></extra>` };
    });
    if (!trazas.length) return vacio("g-res-curvas");
    GC.dibujar("g-res-curvas", trazas, { showlegend: false, yaxis: { title: { text: "USD" } }, shapes: [lineaH(1000, c.gris)] });
  }

  // --- Pares ------------------------------------------------------------------------------------------------------
  function pintarPares() {
    const c = GC.colores();
    const id = P.estado.prueba || "P2";
    const prueba = pruebas().find(p => p.id === id) || pruebas()[1];
    const nombre = nombreCorto(prueba);
    document.getElementById("t-par-capital").textContent = tx("par.capital.title", { t: nombre });
    document.getElementById("t-par-ops").textContent = tx("par.trades.title", { t: nombre });

    const [wd, pd] = P.rangoFechas("week");
    const [wc, pc] = filtroContrato(["y", "x"]);
    const base = `FROM pairs_tested WHERE source = 'backtest' AND ${wd} AND ${wc}`, params = [...pd, ...pc];
    const cuenta = extra => P.valor(`SELECT COUNT(*) ${base} ${extra || ""}`, params);
    const contrastados = cuenta(), p05 = cuenta("AND p_pair < 0.05");
    const bh = cuenta("AND outcome IN ('selected', 'unstable', 'half_life')"), filtros = cuenta("AND outcome IN ('selected', 'unstable')");
    const sel = cuenta("AND selected = 1"), semanasSel = P.valor(`SELECT COUNT(DISTINCT week) ${base} AND selected = 1`, params);
    const [wu, pu] = P.rangoFechas("week");
    const posibles = P.estado.contrato
      ? P.valor(`SELECT COALESCE(SUM(n - 1), 0) FROM (SELECT week, COUNT(*) AS n, SUM(UPPER(symbol) LIKE ?) AS tiene FROM universe WHERE ${wu} GROUP BY week) WHERE tiene > 0`, ["%" + P.estado.contrato + "%", ...pu])
      : P.valor(`SELECT COALESCE(SUM(n * (n - 1) / 2), 0) FROM (SELECT week, COUNT(*) AS n FROM universe WHERE ${wu} GROUP BY week)`, pu);

    const [wt, pt] = P.rangoFechas("t.entry_utc");
    const [wtc, ptc] = filtroContrato(["t.leg_y", "t.leg_x"]);
    const ops = P.filas(`SELECT t.*, l.label_${L()} AS motivo FROM trades t LEFT JOIN labels l ON l.code = t.exit_reason ` +
                        `WHERE t.test_id = ? AND ${wt} AND ${wtc} ORDER BY t.entry_utc`, [prueba.id, ...pt, ...ptc]);
    kpis("kpis-pares", [
      [S.num(contrastados, 0), S.t("kpi.par.tested")],
      [S.num(bh, 0), S.t("kpi.par.bh")],
      [S.num(sel, 0), `${S.t("kpi.par.selected")} · ${tx("kpi.par.weeks", { n: semanasSel })}`],
      [S.num(ops.length, 0), tx("kpi.par.trades", { t: prueba.id })],
      [S.num(prueba.deflated_sharpe, 2), tx("kpi.par.dsr", { t: prueba.id }) + " (≥ 0,95)".replace("0,95", S.num(0.95, 2))],
    ]);

    // Embudo.
    const etapas = es()
      ? ["Pares-semana posibles", "Contrastados (mismo grupo)", "p < 0,05 en ambos sentidos", "Benjamini–Hochberg 5 %", "+ filtros del diferencial", `Seleccionados (${semanasSel} sem.)`]
      : ["Possible pair-weeks", "Tested (same group)", "p < 0.05 both directions", "Benjamini–Hochberg 5 %", "+ spread filters", `Selected (${semanasSel} wks)`];
    const valores = [posibles, contrastados, p05, bh, filtros, sel];
    const esperados = 0.05 * contrastados;
    GC.dibujar("g-par-embudo", [{ type: "bar", orientation: "h", y: etapas.slice().reverse(), x: valores.slice().reverse(),
      text: valores.slice().reverse().map(v => S.num(v, 0)), textposition: "outside", cliponaxis: false,
      marker: { color: [c.naranja, c.verde, c.verde, c.azul, c.azul, c.gris] }, hovertemplate: "%{y}: %{text}<extra></extra>" }],
      { showlegend: false, xaxis: { type: "log", range: [-0.1, Math.log10(Math.max(posibles, 10)) + 0.5] }, margin: { l: 10, r: 30, t: 24, b: 30 },
        shapes: esperados > 0 ? [lineaV(esperados, c.rojo)] : [],
        annotations: esperados > 0 ? [{ x: Math.log10(esperados), y: 1.04, yref: "paper", showarrow: false, font: { color: c.rojo, size: 11 },
          text: (es() ? "esperados por azar: " : "expected by chance: ") + S.num(esperados, 0) }] : [] });

    // Pares contrastados por semana y resultado.
    const porSemana = P.filas(`SELECT week, outcome, COUNT(*) AS n ${base} GROUP BY week, outcome ORDER BY week`, params);
    const etiquetas = Object.fromEntries(P.filas(`SELECT code, label_${L()} AS t FROM labels WHERE kind = 'pair_outcome'`).map(r => [r.code, r.t]));
    const colores = { not_cointegrated: c.gris, unstable: c.naranja, half_life: c.morado, selected: c.verde };
    const trazasSem = ["not_cointegrated", "unstable", "half_life", "selected"].map(o => {
      const f = porSemana.filter(r => r.outcome === o);
      return { type: "bar", x: f.map(r => r.week), y: f.map(r => r.n), name: etiquetas[o] || o, marker: { color: colores[o] },
               hovertemplate: `${esc(etiquetas[o] || o)} · %{x|%d %b %Y}: %{y}<extra></extra>` };
    }).filter(t => t.x.length);
    if (trazasSem.length) GC.dibujar("g-par-semanas", trazasSem, { barmode: "stack", bargap: 0.1, yaxis: { title: { text: es() ? "pares" : "pairs" } } });
    else vacio("g-par-semanas");

    // Capital y caída de la variante.
    capitalYCaida("g-par-capital", prueba.id, colorSerie(prueba.id) === c.gris ? c.azul : colorSerie(prueba.id));

    // Operaciones en el tiempo, por motivo de salida.
    if (!ops.length) vacio("g-par-ops");
    else {
      const motivos = [...new Set(ops.map(o => o.motivo))];
      const pal = GC.categorias();
      GC.dibujar("g-par-ops", motivos.map((mo, i) => {
        const f = ops.filter(o => o.motivo === mo);
        return { type: "scatter", mode: "markers", name: mo, x: f.map(o => o.entry_utc), y: f.map(o => o.net),
                 marker: { color: pal[i % pal.length], size: f.map(o => Math.min(22, 6 + Math.sqrt(o.hours || 0))), opacity: 0.85,
                           line: { width: 0.5, color: c.fondo } },
                 customdata: f.map(o => [`${corto(o.leg_y)}/${corto(o.leg_x)}`, o.gross, o.costs, o.funding, o.hours, o.exit_utc]),
                 hovertemplate: "<b>%{customdata[0]}</b> · " + esc(mo) + "<br>%{x|%d %b %Y %H:%M} → %{customdata[5]}<br>" +
                   (es() ? "neto" : "net") + " %{y:.2f} · " + (es() ? "bruto" : "gross") + " %{customdata[1]:.2f} · " +
                   (es() ? "costes" : "costs") + " %{customdata[2]:.2f} · funding %{customdata[3]:.2f} · %{customdata[4]} h<extra></extra>" };
      }), { yaxis: { title: { text: es() ? "neto (USD)" : "net (USD)" }, zeroline: true }, shapes: [lineaH(0, c.gris)] });
    }

    // Grupos de OPTICS: con qué frecuencia coinciden dos contratos.
    const [wg, pg] = P.rangoFechas("week");
    const grupos = P.filas(`SELECT week, symbol, cluster FROM clusters WHERE ${wg} ORDER BY week`, pg);
    const presencia = {}, juntos = {}, ambos = {}, semanas = {};
    grupos.forEach(r => { (semanas[r.week] = semanas[r.week] || []).push(r); presencia[r.symbol] = (presencia[r.symbol] || 0) + 1; });
    Object.values(semanas).forEach(lista => {
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
        const [a, b] = [lista[i].symbol, lista[j].symbol].sort(), k = a + "|" + b;
        ambos[k] = (ambos[k] || 0) + 1;
        if (lista[i].cluster >= 0 && lista[i].cluster === lista[j].cluster) juntos[k] = (juntos[k] || 0) + 1;
      }
    });
    const cuota = (a, b) => { const k = [a, b].sort().join("|"); return ambos[k] >= 4 ? (juntos[k] || 0) / ambos[k] : null; };
    const maxN = window.innerWidth < 700 ? 12 : 20;
    let simbolos = Object.keys(presencia).sort((a, b) => presencia[b] - presencia[a]);
    const elegido = P.estado.contrato ? simbolos.find(s => s.toUpperCase().includes(P.estado.contrato)) : null;
    if (elegido) {
      simbolos = [elegido, ...simbolos.filter(s => s !== elegido).sort((a, b) => (cuota(elegido, b) || 0) - (cuota(elegido, a) || 0))];
    }
    simbolos = simbolos.slice(0, maxN);
    if (simbolos.length < 2) vacio("g-par-grupos");
    else {
      const z = simbolos.map(a => simbolos.map(b => (a === b ? null : (cuota(a, b) === null ? null : 100 * cuota(a, b)))));
      const fondo = S.tema() === "light" ? "#eef3f8" : "#1c2230";
      GC.dibujar("g-par-grupos", [{ type: "heatmap", x: simbolos.map(corto), y: simbolos.map(corto), z, zmin: 0, zmax: 100,
        colorscale: [[0, fondo], [1, c.azul]], hoverongaps: false, colorbar: { title: { text: "%" }, thickness: 12 },
        hovertemplate: "%{y} · %{x}: %{z:.0f} %<extra></extra>" }],
        { showlegend: false, yaxis: { autorange: "reversed", tickfont: { size: 11 } }, xaxis: { tickangle: -45, tickfont: { size: 11 } },
          margin: { l: 56, r: 10, t: 10, b: 60 } });
    }
  }

  // --- Avellaneda–Lee ---------------------------------------------------------------------------------------------
  function pintarAL() {
    const c = GC.colores(), v = m();
    const [wd, pd] = P.rangoFechas("t.entry_utc");
    const [wc, pc] = filtroContrato(["t.leg_y"]);
    const ops = P.filas(`SELECT t.*, l.label_${L()} AS motivo FROM trades t LEFT JOIN labels l ON l.code = t.exit_reason ` +
                        `WHERE t.test_id = 'B1' AND ${wd} AND ${wc} ORDER BY t.entry_utc`, [...pd, ...pc]);
    const suma = k => ops.reduce((s, o) => s + (o[k] || 0), 0);
    const g = suma("gross"), co = suma("costs"), fu = suma("funding"), ne = suma("net"), n = ops.length;
    kpis("kpis-al", [
      [S.num(n, 0), S.t("kpi.al.trades")],
      [n ? S.num(g / n, 2) : "—", S.t("kpi.al.gross")],
      [n ? S.num(co / n, 2) : "—", S.t("kpi.al.cost")],
      [usd(ne, 1), S.t("kpi.al.net")],
      [n ? S.pct(ops.filter(o => o.net > 0).length / n, 0) : "—", S.t("kpi.al.hit")],
      [S.fecha(v.b1_stop), S.t("kpi.al.stop"), "mal"],
    ]);
    if (!n) { ["g-al-cascada", "g-al-dist", "g-al-motivos"].forEach(vacio); }
    else {
      const et = es() ? ["Bruto", "Costes", "Funding", "Neto (operaciones)", "Libro de coberturas", "Cuenta"]
                      : ["Gross", "Costs", "Funding", "Net (trades)", "Hedge book", "Account"];
      const pasos = [[et[0], g, c.azul], [et[1], -co, c.rojo], [et[2], fu, c.verde], [et[3], ne, c.gris, true]];
      if (!hayFiltros()) pasos.push([et[4], v.b1_hedge_residual, c.morado], [et[5], ne + v.b1_hedge_residual, c.naranja, true]);
      cascada("g-al-cascada", pasos);
      document.getElementById("n-al-cascada").textContent = S.t(hayFiltros() ? "al.waterfall.note.filtered" : "al.waterfall.note");

      const todos = ops.map(o => o.gross).concat(ops.map(o => o.net)).sort((a, b) => a - b);
      const q = p => todos[Math.min(todos.length - 1, Math.max(0, Math.round(p * (todos.length - 1))))];
      const lim = [Math.floor(q(0.02) - 2), Math.ceil(q(0.98) + 2)];
      const fuera = ops.filter(o => o.gross < lim[0] || o.gross > lim[1] || o.net < lim[0] || o.net > lim[1]).length;
      GC.dibujar("g-al-dist", [
        { type: "histogram", x: ops.map(o => o.gross), name: es() ? "bruto" : "gross", opacity: 0.6, marker: { color: c.azul }, xbins: { size: 2 } },
        { type: "histogram", x: ops.map(o => o.net), name: es() ? "neto" : "net", opacity: 0.6, marker: { color: c.naranja }, xbins: { size: 2 } },
      ], { barmode: "overlay", xaxis: { title: { text: "USD" }, range: lim }, yaxis: { title: { text: es() ? "operaciones" : "trades" } },
           shapes: [lineaV(g / n, c.azul), lineaV(co / n, c.rojo)],
           annotations: [{ x: 1, y: 1, xref: "paper", yref: "paper", xanchor: "right", yanchor: "top", showarrow: false, align: "right",
             text: (es() ? "bruto medio " : "mean gross ") + S.num(g / n, 2) + "<br>" + (es() ? "coste medio " : "mean cost ") + S.num(co / n, 2) +
               (fuera ? "<br>" + (es() ? "fuera de escala: " : "off scale: ") + fuera : "") }] });

      const porMotivo = {};
      ops.forEach(o => { const k = o.motivo; porMotivo[k] = porMotivo[k] || { n: 0, s: 0 }; porMotivo[k].n++; porMotivo[k].s += o.net; });
      const filas = Object.entries(porMotivo).sort((a, b) => a[1].n - b[1].n);
      GC.dibujar("g-al-motivos", [{ type: "bar", orientation: "h", y: filas.map(f => f[0]), x: filas.map(f => f[1].n),
        marker: { color: filas.map(f => (f[1].s >= 0 ? c.verde : c.rojo)) },
        text: filas.map(f => (es() ? "media " : "avg ") + usd(f[1].s / f[1].n, 2)), textposition: "auto", cliponaxis: false,
        hovertemplate: "%{y}: %{x} · %{text}<extra></extra>" }],
        { showlegend: false, xaxis: { title: { text: es() ? "operaciones" : "trades" } }, margin: { l: 10, r: 80, t: 10, b: 40 } });
    }
    const parada = v.b1_stop;
    capitalYCaida("g-al-capital", "B1", c.rojo, {
      shapes: [lineaV(parada, c.rojo)],
      annotations: [{ x: parada, y: 1, yref: "paper", xanchor: "left", yanchor: "top", showarrow: false, font: { color: c.rojo, size: 11 },
                      text: " " + (es() ? "parada " : "stop ") + S.fecha(parada) }],
    });
  }

  // --- Carry de funding ---------------------------------------------------------------------------------------------
  function pintarCarry() {
    const c = GC.colores(), v = m();
    const c1 = pruebas().find(p => p.id === "C1");
    const fmc = v.c1_funding_legs + v.c1_funding_hedge - v.c1_costs_legs - v.c1_costs_hedge;
    kpis("kpis-carry", [
      [S.pct(c1.total_return, 1, true), S.t("kpi.ca.real"), "bien"],
      [S.num(c1.sharpe_annual, 2) + " / " + S.num(c1.deflated_sharpe, 2), S.t("kpi.ca.sharpe")],
      [S.pct(v.c1_full_drawdown, 2), S.t("kpi.ca.dd"), "mal"],
      [usd(fmc, 1), S.t("kpi.ca.fmc")],
    ]);

    const [wp, pp] = P.rangoFechas("week");
    const per = P.filas(`SELECT week, rank_correlation AS r, next_week_spread AS d FROM carry_persistence WHERE ${wp} ORDER BY week`, pp);
    if (!per.length) { vacio("g-ca-persist"); vacio("g-ca-difer"); }
    else {
      const media = per.reduce((s, r) => s + r.r, 0) / per.length;
      GC.dibujar("g-ca-persist", [{ type: "bar", x: per.map(r => r.week), y: per.map(r => r.r), marker: { color: per.map(r => (r.r >= 0 ? c.azul : c.rojo)) },
        hovertemplate: "%{x|%d %b %Y}: ρ = %{y:.2f}<extra></extra>" }],
        { showlegend: false, yaxis: { title: { text: "ρ" } }, shapes: [lineaH(media, c.texto)],
          annotations: [{ x: 1, xref: "paper", y: media, xanchor: "right", yanchor: "bottom", showarrow: false,
                          text: (es() ? "media " : "mean ") + S.num(media, 2), font: { size: 11 } }] });
      const tope = 78;
      GC.dibujar("g-ca-difer", [{ type: "bar", x: per.map(r => r.week), y: per.map(r => Math.min(100 * r.d, tope)),
        marker: { color: per.map(r => (100 * r.d >= 100 * v.carry_breakeven_rule ? c.verde : c.gris)) }, showlegend: false,
        text: per.map(r => (100 * r.d > tope ? S.num(100 * r.d, 0) + " %" : "")), textposition: "inside",
        customdata: per.map(r => 100 * r.d), hovertemplate: "%{x|%d %b %Y}: %{customdata:.1f} %<extra></extra>" }],
        { yaxis: { title: { text: es() ? "% anual" : "% per year" }, range: [-20, 80] } });
      const extremos = [per[0].week, per[per.length - 1].week];
      Plotly.addTraces("g-ca-difer", [
        { type: "scatter", mode: "lines", x: extremos, y: [100 * v.carry_breakeven_rule, 100 * v.carry_breakeven_rule], line: { color: c.rojo, dash: "dash", width: 1.5 },
          name: (es() ? "equilibrio con τ = 0,44: " : "break-even with τ = 0.44: ") + S.num(100 * v.carry_breakeven_rule, 1) + " %", hoverinfo: "skip" },
        { type: "scatter", mode: "lines", x: extremos, y: [100 * v.carry_breakeven_backtest, 100 * v.carry_breakeven_backtest], line: { color: c.naranja, dash: "dot", width: 1.5 },
          name: (es() ? "equilibrio con τ = 0,16: " : "break-even with τ = 0.16: ") + S.num(100 * v.carry_breakeven_backtest, 1) + " %", hoverinfo: "skip" }]);
    }

    const real = capital("C1"), comp = capital("C1-full");
    if (!real.length && !comp.length) vacio("g-ca-capital");
    else {
      GC.dibujar("g-ca-capital", [
        { type: "scatter", mode: "lines", x: comp.map(r => r.day), y: comp.map(r => r.capital), line: { color: c.morado, width: 1.6, dash: "dot" },
          name: es() ? "periodo completo (funding estimado antes de oct-2025)" : "full period (funding estimated before Oct 2025)",
          hovertemplate: "%{x|%d %b %Y}: %{y:.2f} USD<extra></extra>" },
        { type: "scatter", mode: "lines", x: real.map(r => r.day), y: real.map(r => r.capital), line: { color: c.naranja, width: 2.2 },
          name: es() ? "tramo con funding real" : "real-funding period", hovertemplate: "%{x|%d %b %Y}: %{y:.2f} USD<extra></extra>" },
      ], { yaxis: { title: { text: "USD" } },
           shapes: [{ type: "rect", x0: v.c1_dd_peak, x1: v.c1_dd_trough, y0: 0, y1: 1, yref: "paper", fillcolor: c.rojo, opacity: 0.12, line: { width: 0 }, layer: "below" },
                    lineaV(v.real_funding_start, c.gris, true), lineaH(1000, c.gris)],
           annotations: [{ x: v.c1_dd_trough, y: 1, yref: "paper", xanchor: "right", yanchor: "top", showarrow: false, font: { color: c.rojo, size: 11 },
                           text: (es() ? "caída 2023–24: " : "2023–24 drawdown: ") + S.pct(v.c1_full_drawdown, 2) + " " }] });
    }

    let pasos;
    const et = es() ? ["Funding (patas)", "Precio (patas)", "Cobertura BTC/ETH", "Costes (patas)", "Neto"]
                    : ["Funding (legs)", "Price (legs)", "BTC/ETH hedge", "Costs (legs)", "Net"];
    if (!hayFiltros()) {
      const cob = v.c1_price_hedge + v.c1_funding_hedge - v.c1_costs_hedge;
      pasos = [[et[0], v.c1_funding_legs, c.verde], [et[1], v.c1_price_legs, c.azul], [et[2], cob, c.morado], [et[3], -v.c1_costs_legs, c.rojo],
               [et[4], v.c1_funding_legs + v.c1_price_legs + cob - v.c1_costs_legs, c.naranja, true]];
    } else {
      const [wd, pd] = P.rangoFechas("entry_utc");
      const [wc, pc] = filtroContrato(["leg_y"]);
      const r = P.filas(`SELECT COALESCE(SUM(funding), 0) AS f, COALESCE(SUM(gross), 0) AS g, COALESCE(SUM(costs), 0) AS k, COUNT(*) AS n FROM trades WHERE test_id = 'C1' AND ${wd} AND ${wc}`, [...pd, ...pc])[0];
      pasos = r.n ? [[et[0], r.f, c.verde], [et[1], r.g, c.azul], [et[3], -r.k, c.rojo], [et[4], r.f + r.g - r.k, c.naranja, true]] : null;
    }
    if (pasos) cascada("g-ca-desglose", pasos); else vacio("g-ca-desglose");
    document.getElementById("n-ca-desglose").textContent = S.t(hayFiltros() ? "ca.breakdown.note.filtered" : "ca.breakdown.note");

    const lados = es() ? ["Cortos (más funding)", "Largos (menos funding)"] : ["Shorts (highest funding)", "Longs (lowest funding)"];
    GC.dibujar("g-ca-caida", [
      { type: "bar", x: lados, y: [v.c1_dd_shorts_price, v.c1_dd_longs_price], name: es() ? "precio" : "price", marker: { color: c.azul },
        text: [usd(v.c1_dd_shorts_price, 0), usd(v.c1_dd_longs_price, 0)], textposition: "outside", cliponaxis: false },
      { type: "bar", x: lados, y: [v.c1_dd_shorts_funding, v.c1_dd_longs_funding], name: "funding", marker: { color: c.verde },
        text: [usd(v.c1_dd_shorts_funding, 0), usd(v.c1_dd_longs_funding, 0)], textposition: "outside", cliponaxis: false },
    ], { barmode: "group", yaxis: { title: { text: "USD" } }, shapes: [lineaH(0, c.gris)], margin: { t: 24 } });
  }

  // --- Comparativa --------------------------------------------------------------------------------------------------
  function pintarComparativa() {
    const c = GC.colores();
    const fam = { pairs: es() ? "pares" : "pairs", avellaneda_lee: "Avellaneda–Lee", carry: "carry" };
    const colorFam = { pairs: c.azul, avellaneda_lee: c.rojo, carry: c.naranja };
    const ps = pruebas();
    GC.dibujar("g-co-dispersion", Object.keys(fam).map(f => {
      const g = ps.filter(p => p.family === f);
      return { type: "scatter", mode: "markers+text", name: fam[f], x: g.map(p => p.deflated_sharpe), y: g.map(p => 100 * p.total_return),
               text: g.map(p => (["P2", "A1", "B1", "C1"].includes(p.id) ? p.id : "")), textposition: "top center", textfont: { size: 11 }, marker: { color: colorFam[f], size: 11, line: { width: 1, color: c.fondo } },
               customdata: g.map(p => [nombreCorto(p), p.sharpe_annual, 100 * p.max_drawdown, 100 * p.positive_months]),
               hovertemplate: "<b>%{customdata[0]}</b><br>" + (es() ? "rentabilidad" : "return") + " %{y:.2f} % · " + (es() ? "Sharpe deflactado" : "deflated Sharpe") +
                 " %{x:.2f}<br>Sharpe %{customdata[1]:.2f} · " + (es() ? "caída" : "drawdown") + " %{customdata[2]:.1f} % · " +
                 (es() ? "meses +" : "months +") + " %{customdata[3]:.0f} %<extra></extra>" };
    }), { xaxis: { title: { text: es() ? "Sharpe deflactado" : "deflated Sharpe ratio" }, range: [-0.04, 1.04] },
          yaxis: { title: { text: es() ? "rentabilidad (%)" : "return (%)" } },
          shapes: [{ type: "rect", x0: 0.95, x1: 1.04, y0: 0, y1: 1, yref: "paper", fillcolor: c.verde, opacity: 0.14, line: { width: 0 }, layer: "below" },
                   lineaV(0.95, c.verde), lineaH(0, c.gris)],
          annotations: [{ x: 0.95, y: 0, yref: "paper", xanchor: "right", yanchor: "bottom", showarrow: false, font: { color: c.verde, size: 11 },
                          text: (es() ? "umbral " : "threshold ") + S.num(0.95, 2) + " " }] });

    const orden = P.filas("SELECT series FROM series ORDER BY rowid").map(r => r.series);
    const w = [], p = [];
    if (P.estado.desde) { w.push("month >= ?"); p.push(P.estado.desde.slice(0, 7)); }
    if (P.estado.hasta) { w.push("month <= ?"); p.push(P.estado.hasta.slice(0, 7)); }
    const mensual = P.filas(`SELECT series, month, ret FROM monthly_returns ${w.length ? "WHERE " + w.join(" AND ") : ""}`, p);
    const meses = [...new Set(mensual.map(r => r.month))].sort();
    if (!meses.length) vacio("g-co-mensual");
    else {
      const idx = Object.fromEntries(meses.map((mm, i) => [mm, i]));
      const z = orden.map(() => meses.map(() => null));
      mensual.forEach(r => { z[orden.indexOf(r.series)][idx[r.month]] = 100 * r.ret; });
      const neutro = S.tema() === "light" ? "#f4f4f4" : "#1c2230";
      GC.dibujar("g-co-mensual", [{ type: "heatmap", x: meses, y: orden, z, zmin: -5, zmax: 5, zmid: 0, hoverongaps: false, xgap: 1, ygap: 1,
        colorscale: [[0, c.rojo], [0.5, neutro], [1, c.verde]], colorbar: { title: { text: "%" }, thickness: 12 },
        hovertemplate: "%{y} · %{x}: %{z:.2f} %<extra></extra>" }],
        { showlegend: false, yaxis: { autorange: "reversed", type: "category" }, xaxis: { type: "category", tickangle: -45, nticks: window.innerWidth < 700 ? 7 : 18 },
          margin: { l: 56, r: 10, t: 10, b: 60 } });
    }

    window.TABLA_PRUEBAS.pintar(document.getElementById("tabla-pruebas"), ps.map(q => ({
      id: q.id, en: q.name_en, es: q.name_es, registro: q.registered_at, commit: q.registration_commit, regla_commit: q.rule_commit,
      criterio_en: q.criterion_en, criterio_es: q.criterion_es, resultado: q.outcome, resultado_en: q.outcome_en, resultado_es: q.outcome_es,
      ret: q.total_return, sr: q.sharpe_annual, dsr: q.deflated_sharpe, n: q.n_trials, dd: q.max_drawdown, mp: q.positive_months,
      meses: q.months, ops: q.trades, dias: q.days, run_id: q.run_id,
    })), { repo: PROYECTO.enlaces.codigo || "", alVerOperaciones: verOperaciones });
  }

  // --- Por qué falla ---------------------------------------------------------------------------------------------------
  function normInv(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function srMinimo(T, n) {
    const g = 0.5772156649;
    const sr0 = n > 1 ? Math.sqrt(m().var_daily_sharpe_pairs) * ((1 - g) * normInv(1 - 1 / n) + g * normInv(1 - 1 / (n * Math.E))) : 0;
    return (sr0 + 1.6448536 / Math.sqrt(T - 1)) * Math.sqrt(365);
  }
  function pintarAmplitud() {
    const c = GC.colores(), v = m();
    const brs = Array.from({ length: 121 }, (_, k) => Math.pow(10, k / 20));
    const trazas = [[0.01, c.gris], [0.02, c.cian], [0.05, c.azul], [0.10, c.morado]].map(([ic, col]) => ({
      type: "scatter", mode: "lines", x: brs, y: brs.map(x => ic * Math.sqrt(x)), name: "IC = " + S.num(ic, 2), line: { color: col, width: 2 },
      hovertemplate: "BR %{x:.0f} · IR %{y:.2f}<extra>IC " + S.num(ic, 2) + "</extra>" }));
    trazas.push({ type: "scatter", mode: "markers", x: [v.breadth_carry], y: [v.ic_total * Math.sqrt(v.breadth_carry)],
      error_y: { type: "data", array: [2 * v.ic_total_se * Math.sqrt(v.breadth_carry)], color: c.verde }, marker: { color: c.verde, size: 11 },
      name: "C1 carry: IC " + S.num(v.ic_total, 3) + " ± " + S.num(2 * v.ic_total_se, 3) });
    const marcas = [[v.trades_per_year_p1, c.naranja, es() ? "P1 pares" : "P1 pairs"], [v.trades_per_year_b1, c.rojo, "B1"],
                    [252000, c.texto, es() ? "1.000 acciones a diario" : "1,000 stocks daily"]];
    GC.dibujar("g-pq-amplitud", trazas, {
      xaxis: { type: "log", title: { text: es() ? "BR (apuestas independientes al año, log)" : "BR (independent bets per year, log)" } },
      yaxis: { range: [-1.3, 5], title: { text: "IR" } },
      shapes: marcas.map(([x, col]) => lineaV(x, col)).concat([lineaH(1, c.gris)]),
      annotations: marcas.map(([x, col, n]) => ({ x: Math.log10(x), y: 4.8, text: " " + n, showarrow: false, xanchor: "left", font: { color: col, size: 11 } })),
    });
  }
  function pintarPotencia() {
    const n = Number(document.getElementById("control-n").value), c = GC.colores(), v = m();
    document.getElementById("valor-n").textContent = n;
    document.getElementById("lectura-n").innerHTML = (es() ? "SR* exigido: <b>" : "required SR*: <b>") + S.num(srMinimo(365, n), 2) +
      "</b> " + (es() ? "con 12 meses" : "with 12 months") + " · <b>" + S.num(srMinimo(90, n), 2) + "</b> " + (es() ? "con 3 meses" : "with 3 months");
    const xs = [], ys = [], ys1 = [];
    for (let k = 0; k <= 120; k++) { const t = Math.round(30 * Math.pow(10, k * 2.15 / 120)); xs.push(t); ys.push(srMinimo(t, n)); ys1.push(srMinimo(t, 1)); }
    const datos = [
      { x: xs, y: ys1, type: "scatter", mode: "lines", name: es() ? "una prueba (N = 1)" : "one test (N = 1)", line: { color: c.azul, width: 2, dash: n > 1 ? "dot" : "solid" } },
      { x: [v.c1_days], y: [v.c1_sharpe], type: "scatter", mode: "markers+text", marker: { color: c.texto, size: 10 },
        text: ["C1: " + S.num(v.c1_sharpe, 2)], textposition: "bottom left", name: es() ? "carry, tramo real" : "carry, real period" },
    ];
    if (n > 1) datos.unshift({ x: xs, y: ys, type: "scatter", mode: "lines", name: "N = " + n, line: { color: c.rojo, width: 2.5 } });
    GC.dibujar("g-pq-potencia", datos, {
      xaxis: { type: "log", tickvals: [30, 90, 182, 365, 730, 1461, 3652],
               ticktext: es() ? ["1 m", "3 m", "6 m", "1 año", "2 años", "4 años", "10 años"] : ["1 m", "3 m", "6 m", "1 yr", "2 yrs", "4 yrs", "10 yrs"],
               title: { text: es() ? "duración del historial (escala log)" : "track-record length (log scale)" } },
      yaxis: { range: [0, 5.2], title: { text: "SR*" } }, shapes: [lineaV(90, c.gris, true), lineaV(365, c.gris, true)],
    });
  }
  function pintarPrima() {
    const v = m(), c = GC.colores();
    const cPct = Number(document.getElementById("control-c").value) / 100, coste = cPct / 100;
    document.getElementById("valor-c").textContent = S.num(cPct, 2) + " %";
    const pi = v.pi + v.costs_per_notional * (1 - coste / v.cost_per_execution);    // devuelve los costes que ya no se pagan
    const den = v.sigma * Math.sqrt(2 * (1 - v.rho_bar));
    const patas = pi > 0 ? Math.ceil(Math.pow(1.65 * den / pi, 2)) : Infinity;
    document.getElementById("lectura-c").innerHTML = "π = <b>" + S.pct(pi, 1) + "</b> · " + (es() ? "SR con 3 patas: <b>" : "SR with 3 legs: <b>") +
      S.num(pi * Math.sqrt(3) / den, 2) + "</b> · " + (es() ? "patas por lado para SR 1,65: <b>" : "legs per side for SR 1.65: <b>") + (isFinite(patas) ? patas : "∞") + "</b>";
    const ns = Array.from({ length: 100 }, (_, i) => i + 1);
    const base = Math.abs(coste - v.cost_per_execution) < 1e-9;
    const datos = [{ x: ns, y: ns.map(n => v.pi * Math.sqrt(n) / den), type: "scatter", mode: "lines", name: (es() ? "medido: π = " : "measured: π = ") + S.pct(v.pi, 1),
                     line: { color: c.verde, width: 2, dash: base ? "solid" : "dot" } }];
    if (!base) datos.push({ x: ns, y: ns.map(n => pi * Math.sqrt(n) / den), type: "scatter", mode: "lines", name: (es() ? "con este coste: π = " : "with this cost: π = ") + S.pct(pi, 1), line: { color: c.azul, width: 2.5 } });
    GC.dibujar("g-pq-prima", datos, {
      xaxis: { title: { text: es() ? "patas por lado n" : "legs per side n" } }, yaxis: { range: [0, 3], title: { text: "SR" } }, hovermode: "x unified",
      shapes: [lineaV(3, c.texto, true), lineaH(1.65, c.rojo)],
      annotations: [{ x: 3, y: 2.9, text: es() ? " nuestra cartera: 3" : " our book: 3", showarrow: false, xanchor: "left", font: { size: 11 } },
                    { x: 99, y: 1.72, text: es() ? "SR exigido con 12 meses" : "SR required with 12 months", showarrow: false, xanchor: "right", font: { size: 11, color: c.rojo } }],
    });
  }
  function pintarPorque() { pintarAmplitud(); pintarPotencia(); pintarPrima(); }

  // --- Universo -----------------------------------------------------------------------------------------------------------
  function pintarUniverso() {
    const c = GC.colores();
    const [wd, pd] = P.rangoFechas("week");
    const semanas = P.filas(`SELECT week FROM (SELECT week FROM universe UNION SELECT week FROM universe_exclusions) WHERE ${wd} ORDER BY week`, pd).map(r => r.week);
    const cuenta = Object.fromEntries(P.filas(`SELECT week, COUNT(*) AS n FROM universe WHERE ${wd} GROUP BY week`, pd).map(r => [r.week, r.n]));
    const ns = semanas.map(w => cuenta[w] || 0);
    const distintos = P.valor(`SELECT COUNT(DISTINCT symbol) FROM universe WHERE ${wd}`, pd);
    kpis("kpis-universo", [
      [ns.length ? S.num(ns.reduce((a, b) => a + b, 0) / ns.length, 1) : "—", S.t("kpi.un.mean")],
      [ns.length ? String(Math.max(...ns)) : "—", S.t("kpi.un.max")],
      [S.num(distintos, 0), S.t("kpi.un.distinct")],
      [String(ns.filter(n => n < 5).length), S.t("kpi.un.thin")],
    ]);
    if (!semanas.length) { ["g-un-semanas", "g-un-exclusiones", "g-un-top"].forEach(vacio); return; }
    const con = new Set();
    if (P.estado.contrato) P.filas(`SELECT DISTINCT week FROM universe WHERE UPPER(symbol) LIKE ? AND ${wd}`, ["%" + P.estado.contrato + "%", ...pd]).forEach(r => con.add(r.week));
    GC.dibujar("g-un-semanas", [{ type: "bar", x: semanas, y: ns, marker: { color: semanas.map(w => (con.has(w) ? c.naranja : c.azul)) },
      hovertemplate: "%{x|%d %b %Y}: %{y}<extra></extra>" }],
      { showlegend: false, bargap: 0.15, yaxis: { title: { text: es() ? "contratos" : "contracts" } } });

    const etiquetas = Object.fromEntries(P.filas(`SELECT code, label_${L()} AS t FROM labels WHERE kind = 'exclusion_reason'`).map(r => [r.code, r.t]));
    const excl = P.filas(`SELECT week, reason, contracts FROM universe_exclusions WHERE ${wd} ORDER BY week`, pd);
    const motivos = Object.entries(excl.reduce((a, r) => { a[r.reason] = (a[r.reason] || 0) + r.contracts; return a; }, {})).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const pal = GC.categorias();
    GC.dibujar("g-un-exclusiones", motivos.map((mo, i) => {
      const porSemana = Object.fromEntries(excl.filter(r => r.reason === mo).map(r => [r.week, r.contracts]));
      return { type: "scatter", mode: "lines", stackgroup: "uno", name: etiquetas[mo] || mo, x: semanas, y: semanas.map(w => porSemana[w] || 0),
               line: { width: 0.5, color: pal[i % pal.length] }, hovertemplate: `${esc(etiquetas[mo] || mo)} · %{x|%d %b %Y}: %{y}<extra></extra>` };
    }), { yaxis: { title: { text: es() ? "contratos excluidos" : "contracts excluded" } }, hovermode: "x unified" });

    const top = P.filas(`SELECT symbol, COUNT(*) AS n FROM universe WHERE ${wd} GROUP BY symbol ORDER BY n DESC LIMIT 20`, pd).reverse();
    GC.dibujar("g-un-top", [{ type: "bar", orientation: "h", y: top.map(r => corto(r.symbol)), x: top.map(r => r.n),
      marker: { color: top.map(r => (P.estado.contrato && r.symbol.toUpperCase().includes(P.estado.contrato) ? c.naranja : c.azul)) },
      customdata: top.map(r => r.symbol), hovertemplate: "%{customdata}: %{x}<extra></extra>" }],
      { showlegend: false, xaxis: { title: { text: es() ? "semanas" : "weeks" } }, margin: { l: 10, r: 16, t: 10, b: 40 } });
  }

  // --- Datos ----------------------------------------------------------------------------------------------------------------
  let explorador = null;
  const COLUMNAS = {
    id: ["Test", "Prueba"], test_id: ["Test", "Prueba"], name: ["Name", "Nombre"], family: ["Family", "Familia"],
    registered_at: ["Registered", "Registro"], registration_commit: ["Commit", "Commit"], outcome: ["Outcome", "Resultado"],
    total_return: ["Return", "Rentabilidad"], sharpe_annual: ["Sharpe", "Sharpe"], deflated_sharpe: ["Deflated Sharpe", "Sharpe deflactado"],
    n_trials: ["N", "N"], max_drawdown: ["Max drawdown", "Caída máxima"], positive_months: ["Positive months", "Meses positivos"],
    trades: ["Trades", "Operaciones"], leg_y: ["Leg y", "Pata y"], leg_x: ["Leg x", "Pata x"], side: ["Side", "Lado"],
    entry_utc: ["Entry (UTC)", "Entrada (UTC)"], exit_utc: ["Exit (UTC)", "Salida (UTC)"], hours: ["Hours", "Horas"],
    gross: ["Gross", "Bruto"], costs: ["Costs", "Costes"], funding: ["Funding", "Funding"], net: ["Net", "Neto"],
    exit_reason: ["Exit reason", "Motivo de salida"], series: ["Series", "Serie"], week: ["Week", "Semana"], day: ["Day", "Día"],
    capital: ["Capital (USD)", "Capital (USD)"], month: ["Month", "Mes"], ret: ["Return", "Rentabilidad"],
    cluster: ["Group", "Grupo"], p_pair: ["p (pair)", "p (par)"], q_bh: ["q (BH)", "q (BH)"], beta: ["β", "β"], hurst: ["Hurst", "Hurst"],
    half_life_h: ["Half-life (h)", "Vida media (h)"], selected: ["Selected", "Seleccionado"], symbol: ["Contract", "Contrato"],
    rank: ["Rank", "Puesto"], age_days: ["Age (days)", "Antigüedad (días)"], volume_median_30d_musd: ["Median volume 30 d (M$)", "Volumen mediano 30 d (M$)"],
    spread_bp: ["Spread (bp)", "Spread (pb)"], funding_annual_abs: ["|Funding| per year", "|Funding| anual"], reason: ["Reason", "Motivo"],
    contracts: ["Contracts", "Contratos"], rank_correlation: ["Rank correlation ρ", "Correlación de rangos ρ"],
    next_week_spread: ["Next-week spread", "Diferencial siguiente"], n_components: ["PCA components", "Componentes PCA"],
    explained_variance: ["Explained variance", "Varianza explicada"], run_id: ["Run", "Ejecución"], executed_at_utc: ["Executed (UTC)", "Ejecutada (UTC)"],
    strategy: ["Strategy", "Estrategia"], variants: ["Variants", "Variantes"], counted: ["Counted", "Cuenta"], note: ["Note", "Nota"],
  };
  function configDatos() {
    const lista = (sql) => (l) => P.consultar(sql.replace(/\{l\}/g, l)).values;
    const fechas = campo => [{ id: "desde", tipo: "desde", campo }, { id: "hasta", tipo: "hasta", campo }];
    return {
      descarga: "resultados.sqlite", columnas: COLUMNAS,
      decimales: { gross: 2, costs: 2, funding: 2, net: 2, capital: 2, hours: 0, half_life_h: 1, avg_net: 2, total_net: 2,
                   volume_median_30d_musd: 1, spread_bp: 1, contracts: 0 },
      orden: ["trades", "tests", "capital", "monthly", "pairs", "universe", "exclusions", "clusters", "persistence", "runs"],
      conjuntos: {
        trades: { sql: l => `SELECT t.test_id, t.leg_y, t.leg_x, t.side, t.entry_utc, t.exit_utc, t.hours, t.gross, t.costs, t.funding, t.net, l.label_${l} AS exit_reason FROM trades t LEFT JOIN labels l ON l.code = t.exit_reason`,
                  orden: "t.entry_utc", filtros: [{ id: "test", tipo: "lista", campo: "t.test_id", etiqueta: "ex.f.test", opciones: lista("SELECT id, name_{l} FROM tests ORDER BY rowid") },
                    { id: "simbolo", tipo: "texto", campos: ["t.leg_y", "t.leg_x"], etiqueta: "ex.f.symbol" },
                    { id: "motivo", tipo: "lista", campo: "t.exit_reason", etiqueta: "ex.f.reason", opciones: lista("SELECT code, label_{l} FROM labels WHERE kind = 'exit_reason' ORDER BY 2") },
                    ...fechas("t.entry_utc")] },
        tests: { sql: l => `SELECT id, name_${l} AS name, family, registered_at, registration_commit, outcome_${l} AS outcome, total_return, sharpe_annual, deflated_sharpe, n_trials, max_drawdown, positive_months, trades FROM tests`,
                 orden: "rowid", filtros: [{ id: "familia", tipo: "lista", campo: "family", etiqueta: "ex.f.family", opciones: () => [["pairs", "pairs"], ["avellaneda_lee", "avellaneda_lee"], ["carry", "carry"]] }] },
        capital: { sql: () => "SELECT series, day, capital FROM capital_daily", orden: "series, day",
                   filtros: [{ id: "serie", tipo: "lista", campo: "series", etiqueta: "ex.f.series", opciones: lista("SELECT series, label_{l} FROM series ORDER BY rowid") }, ...fechas("day")] },
        monthly: { sql: () => "SELECT series, month, ret FROM monthly_returns", orden: "series, month",
                   filtros: [{ id: "serie", tipo: "lista", campo: "series", etiqueta: "ex.f.series", opciones: lista("SELECT series, label_{l} FROM series ORDER BY rowid") }] },
        pairs: { sql: l => `SELECT p.week, p.y, p.x, p.cluster, p.p_pair, p.q_bh, p.beta, p.hurst, p.half_life_h, p.selected, l.label_${l} AS outcome FROM pairs_tested p LEFT JOIN labels l ON l.code = p.outcome`,
                 base: "p.source = 'backtest'", orden: "p.week, p.p_pair",
                 filtros: [{ id: "simbolo", tipo: "texto", campos: ["p.y", "p.x"], etiqueta: "ex.f.symbol" },
                   { id: "resultado", tipo: "lista", campo: "p.outcome", etiqueta: "ex.f.outcome", opciones: lista("SELECT code, label_{l} FROM labels WHERE kind = 'pair_outcome' ORDER BY 2") },
                   { id: "seleccionados", tipo: "casilla", campo: "p.selected", etiqueta: "ex.f.selected" }, ...fechas("p.week")] },
        universe: { sql: () => "SELECT week, symbol, rank, age_days, volume_median_30d_musd, spread_bp, funding_annual_abs FROM universe", orden: "week, rank",
                    filtros: [{ id: "simbolo", tipo: "texto", campos: ["symbol"], etiqueta: "ex.f.symbol" }, ...fechas("week")] },
        exclusions: { sql: l => `SELECT e.week, l.label_${l} AS reason, e.contracts FROM universe_exclusions e LEFT JOIN labels l ON l.code = e.reason`, orden: "e.week, e.contracts DESC",
                      filtros: [{ id: "motivo", tipo: "lista", campo: "e.reason", etiqueta: "ex.f.reason", opciones: lista("SELECT code, label_{l} FROM labels WHERE kind = 'exclusion_reason' ORDER BY 2") }, ...fechas("e.week")] },
        clusters: { sql: () => "SELECT week, symbol, cluster, n_components, explained_variance FROM clusters", orden: "week, cluster",
                    filtros: [{ id: "simbolo", tipo: "texto", campos: ["symbol"], etiqueta: "ex.f.symbol" }, ...fechas("week")] },
        persistence: { sql: () => "SELECT week, rank_correlation, next_week_spread FROM carry_persistence", orden: "week", filtros: [] },
        runs: { sql: l => `SELECT run_id, executed_at_utc, strategy, variants, counted, note_${l} AS note FROM runs`, orden: "executed_at_utc", filtros: [] },
      },
      ejemplos: l => [
        ["ex.q1", "SELECT test_id, COUNT(*) AS trades, ROUND(AVG(net), 3) AS avg_net, ROUND(SUM(net), 2) AS total_net\nFROM trades\nGROUP BY test_id\nORDER BY total_net DESC;"],
        ["ex.q2", `SELECT l.label_${l} AS exit_reason, COUNT(*) AS trades, ROUND(AVG(t.net), 2) AS avg_net\nFROM trades t JOIN labels l ON l.code = t.exit_reason\nWHERE t.test_id = 'B1'\nGROUP BY 1\nORDER BY 2 DESC;`],
        ["ex.q3", "SELECT week, y, x, ROUND(p_pair, 4) AS p_pair, ROUND(q_bh, 4) AS q_bh, ROUND(half_life_h / 24, 1) AS half_life_days\nFROM pairs_tested\nWHERE selected = 1\nORDER BY week;"],
        ["ex.q4", "SELECT symbol, COUNT(*) AS weeks, ROUND(AVG(volume_median_30d_musd), 1) AS avg_volume_musd\nFROM universe\nGROUP BY symbol\nORDER BY weeks DESC\nLIMIT 20;"],
        ["ex.q5", "SELECT series, COUNT(*) AS months, SUM(ret > 0) AS positive,\n       ROUND(100.0 * SUM(ret > 0) / COUNT(*), 1) AS pct_positive\nFROM monthly_returns\nGROUP BY series\nORDER BY pct_positive DESC;"],
        ["ex.q6", "SELECT leg_y AS contract, COUNT(*) AS legs, ROUND(SUM(funding), 2) AS funding,\n       ROUND(SUM(costs), 2) AS costs, ROUND(SUM(net), 2) AS net\nFROM trades\nWHERE test_id = 'C1'\nGROUP BY leg_y\nORDER BY net DESC;"],
        ["ex.q7", "SELECT series, ROUND(100 * MIN(capital / peak - 1), 2) AS max_drawdown_pct\nFROM (SELECT series, day, capital,\n             MAX(capital) OVER (PARTITION BY series ORDER BY day) AS peak\n      FROM capital_daily)\nGROUP BY series\nORDER BY max_drawdown_pct;"],
      ],
    };
  }
  function pintarDatos() {
    if (!explorador) explorador = window.EXPLORADOR.montar(document.getElementById("explorador"), configDatos());
    explorador.pintar();
  }
  function verOperaciones(id) {
    if (!explorador) explorador = window.EXPLORADOR.montar(document.getElementById("explorador"), configDatos());
    explorador.filtrar({ test: id }, "trades");
    location.hash = "#datos";
  }

  // --- Arranque -------------------------------------------------------------------------------------------------------------
  // Filtros: siempre abiertos en pantallas anchas; en el móvil empiezan plegados.
  const panelFiltros = document.getElementById("filtros-panel");
  panelFiltros.open = window.innerWidth >= 700;
  window.addEventListener("resize", () => { if (window.innerWidth >= 700) panelFiltros.open = true; });
  document.getElementById("control-n").addEventListener("input", () => { if (P.bd) pintarPotencia(); });
  document.getElementById("control-c").addEventListener("input", () => { if (P.bd) pintarPrima(); });
  P.iniciar({
    bd: "resultados.sqlite.gz", bdPlano: "resultados.sqlite", porDefecto: "resumen",
    pestanas: {
      resumen: { filtros: ["fechas"], pintar: pintarResumen },
      pares: { filtros: ["prueba", "fechas", "contrato"], pintar: pintarPares },
      "avellaneda-lee": { filtros: ["fechas", "contrato"], pintar: pintarAL },
      carry: { filtros: ["fechas", "contrato"], pintar: pintarCarry },
      comparativa: { filtros: ["fechas"], pintar: pintarComparativa },
      "por-que-falla": { filtros: [], pintar: pintarPorque },
      universo: { filtros: ["fechas", "contrato"], pintar: pintarUniverso },
      datos: { filtros: [], pintar: pintarDatos },
    },
    opcionesPrueba: () => pruebas().filter(p => p.family === "pairs").map(p => [p.id, nombreCorto(p)]),
    pruebaPorDefecto: "P2",
    opcionesContrato: () => P.filas("SELECT DISTINCT symbol FROM universe ORDER BY 1").map(r => r.symbol),
    rangos: [{ clave: "all" }, { clave: "estimated", desde: "2022-07-25", hasta: "2025-10-14" }, { clave: "real", desde: "2025-10-15", hasta: "" }],
  });
})();
