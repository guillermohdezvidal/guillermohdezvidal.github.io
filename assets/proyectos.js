// Lista de proyectos que aparece en el inicio (el más reciente, arriba).
// Para añadir uno: copia proyectos/_plantilla a proyectos/<carpeta>, rellénalo y añade aquí su entrada.
// Las rutas de "enlaces" son relativas a la carpeta del proyecto; deja "" lo que no exista.
window.PROYECTOS = [
  {
    carpeta: "arbitraje-estadistico",
    fecha: "2026-10",
    titulo: {
      en: "Why can't retail traders do statistical arbitrage like quants?",
      es: "¿Por qué un minorista no puede hacer arbitraje estadístico como un quant?",
    },
    resumen: {
      en: "Sixteen pre-registered tests of pairs trading, Avellaneda–Lee residuals and funding carry on Kraken's crypto perpetuals (2022–2026). None passed; four quantitative arguments explain why an institution has it easier.",
      es: "Dieciséis pruebas registradas de antemano de pares, residuos de Avellaneda y Lee y carry de funding en los perpetuos cripto de Kraken (2022–2026). Ninguna pasó; cuatro argumentos cuantitativos explican por qué una institución lo tiene más fácil.",
    },
    estado: { en: "Completed · negative result", es: "Terminado · resultado negativo" },
    etiquetas: {
      en: ["statistical arbitrage", "cointegration", "funding carry", "deflated Sharpe ratio", "MiFID II"],
      es: ["arbitraje estadístico", "cointegración", "carry de funding", "Sharpe deflactado", "MiFID II"],
    },
    enlaces: { pdf: "articulo.pdf", datos: "explorador.html", codigo: "" },
  },
];
