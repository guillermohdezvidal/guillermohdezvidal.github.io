// Gráficas Plotly con el tema de la página (oscuro/claro) y ajustes para el móvil.
(function () {
  "use strict";
  const tactil = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  // Paleta Okabe–Ito, con variantes más claras para el fondo oscuro.
  const PALETA = {
    dark: { azul: "#56B4E9", naranja: "#E69F00", verde: "#2fc497", rojo: "#F07C4A", morado: "#CC79A7", amarillo: "#F0E442",
            gris: "#7d8494", cian: "#8fd3f5", texto: "#eef0f4", suave: "#a1a8b8", rejilla: "rgba(160,170,190,0.16)", fondo: "#161b24" },
    light: { azul: "#0072B2", naranja: "#E69F00", verde: "#009E73", rojo: "#D55E00", morado: "#CC79A7", amarillo: "#c9b800",
             gris: "#8a8a8a", cian: "#56B4E9", texto: "#1d1d1f", suave: "#5d5d63", rejilla: "rgba(128,128,128,0.18)", fondo: "#ffffff" },
  };
  function c() { return PALETA[window.SITIO ? window.SITIO.tema() : "dark"]; }
  // Colores para categorías (motivos, familias...), en orden.
  function categorias() { const p = c(); return [p.azul, p.naranja, p.verde, p.rojo, p.morado, p.cian, p.amarillo, p.gris, "#9b8cff", "#c08457", "#5bc0be"]; }

  function partir(texto, ancho) {
    if (!texto || texto.indexOf("<br>") >= 0 || texto.length <= ancho) return texto;
    const lineas = [];
    let actual = "";
    texto.split(" ").forEach(p => {
      if (actual && (actual + " " + p).length > ancho) { lineas.push(actual); actual = p; }
      else actual = actual ? actual + " " + p : p;
    });
    if (actual) lineas.push(actual);
    return lineas.join("<br>");
  }

  function eje(e) {
    const p = c();
    return Object.assign({ gridcolor: p.rejilla, zerolinecolor: p.rejilla, linecolor: p.rejilla, automargin: true }, e || {});
  }

  // Dibuja con el tema actual. layout puede traer xaxis/yaxis (y xaxis2...) parciales.
  function dibujar(div, datos, layout) {
    if (typeof div === "string") div = document.getElementById(div);
    if (!div || !window.Plotly) return;
    div.querySelectorAll(":scope > .cargando").forEach(e => e.remove());   // quita el aviso de «cargando» o «sin datos»
    const p = c(), estrecho = window.innerWidth < 700;
    const l = Object.assign({
      margin: { l: 56, r: 16, t: 12, b: 40 }, hovermode: "closest", showlegend: true,
      legend: { orientation: "h", y: -0.18, yanchor: "top", font: { size: 12 } },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "system-ui, -apple-system, Segoe UI, sans-serif", size: 12, color: p.texto },
      hoverlabel: { bgcolor: p.fondo, bordercolor: p.rejilla, font: { color: p.texto } },
      separators: window.SITIO && window.SITIO.idioma === "es" ? ",." : ".,",   // coma decimal en español
    }, layout);
    Object.keys(l).filter(k => /^[xy]axis\d*$/.test(k)).forEach(k => { l[k] = eje(l[k]); });
    if (!l.xaxis) l.xaxis = eje();
    if (!l.yaxis) l.yaxis = eje();
    const tituloX = l.xaxis.title && l.xaxis.title.text;
    if (l.legend && !(layout.legend && layout.legend.y !== undefined)) l.legend = Object.assign({}, l.legend, { y: tituloX ? -0.3 : -0.14 });
    if (l.title && l.title.text) l.margin = Object.assign({}, l.margin, { t: Math.max(l.margin.t, 40) });
    const conf = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] };
    if (estrecho) {
      conf.displayModeBar = false;
      l.margin = Object.assign({}, l.margin, { l: Math.min(l.margin.l, 46), r: Math.min(l.margin.r, 40) });
      if (l.legend) l.legend = Object.assign({}, l.legend, { font: { size: 10.5 } });
      datos.forEach(d => {
        if (d.name) d.name = partir(d.name, 40);
        if (d.orientation === "h" && Array.isArray(d.y)) d.y = d.y.map(s => partir(String(s), 18));
      });
    }
    // En pantallas táctiles, arrastrar sobre la gráfica no debe impedir desplazar la página.
    if (tactil) { l.dragmode = false; conf.scrollZoom = false; }
    Plotly.react(div, datos, l, conf);
  }

  function vaciar(div, texto) {
    if (typeof div === "string") div = document.getElementById(div);
    if (!div) return;
    if (window.Plotly) Plotly.purge(div);
    div.innerHTML = `<div class="cargando" style="height:100%">${texto}</div>`;
  }

  window.GRAFICAS_COMUN = { dibujar, vaciar, partir, colores: c, categorias, tactil };
})();
