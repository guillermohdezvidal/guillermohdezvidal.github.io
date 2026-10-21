// Lista de proyectos que aparece en el inicio (el más reciente, arriba).
// Para añadir uno: copia proyectos/_plantilla a proyectos/<carpeta>, rellénalo y añade aquí su entrada.
// Las rutas de "enlaces" son relativas a la carpeta del proyecto; deja "" lo que no exista.
window.PROYECTOS = [
  {
    carpeta: "arbitraje-estadistico",
    fecha: "2026-10",
    titulo: {
      en: "Same models, different conditions",
      es: "Mismos modelos, distintas condiciones",
    },
    resumen: {
      en: "Why a quant fund's methods need not give a retail trader its results. Sixteen tests of pairs trading, Avellaneda–Lee residuals and funding carry on Kraken's crypto perpetuals (2022–2026): none passed. Costs, effective breadth, data and premium versus risk explain why, and only part of it is about capital.",
      es: "Por qué los métodos de un fondo cuantitativo no garantizan sus resultados a un minorista. Dieciséis pruebas de pares, residuos de Avellaneda y Lee y carry de funding en los perpetuos cripto de Kraken (2022–2026): ninguna pasó. Los costes, la amplitud efectiva, los datos y la prima frente al riesgo explican por qué, y solo una parte depende del capital.",
    },
    estado: { en: "Completed · negative result", es: "Terminado · resultado negativo" },
    etiquetas: {
      en: ["statistical arbitrage", "cointegration", "funding carry", "deflated Sharpe ratio", "MiFID II"],
      es: ["arbitraje estadístico", "cointegración", "carry de funding", "Sharpe deflactado", "MiFID II"],
    },
    enlaces: { pdf: "articulo.pdf", datos: "explorador.html", codigo: "" },
  },
];
