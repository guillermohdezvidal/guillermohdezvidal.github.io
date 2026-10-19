// Motor común de todas las páginas: cabecera, pie, tema (oscuro por defecto / claro), idioma (EN/ES)
// y formato de números. Cada página define <html data-raiz="..."> (ruta hasta la raíz del sitio) y, si
// tiene textos propios, window.TEXTOS_PAGINA = {en: {...}, es: {...}}. Los elementos con data-t="clave"
// muestran el texto de esa clave; data-t-title, data-t-aria y data-t-placeholder, el de esos atributos.
(function () {
  "use strict";
  const raiz = document.documentElement.dataset.raiz || "";
  const comun = window.TEXTOS || { en: {}, es: {} };
  const pagina = window.TEXTOS_PAGINA || { en: {}, es: {} };
  const T = { en: Object.assign({}, comun.en, pagina.en), es: Object.assign({}, comun.es, pagina.es) };
  const CONFIG = window.CONFIG || {};
  const oyentesIdioma = [], oyentesTema = [];
  let idioma = "en";

  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } }

  function idiomaInicial() {
    const enUrl = new URLSearchParams(location.search).get("lang");
    if (enUrl === "en" || enUrl === "es") return enUrl;
    const guardado = leer("idioma");
    if (guardado === "en" || guardado === "es") return guardado;
    return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
  }

  function t(clave) {
    const v = T[idioma][clave];
    return v !== undefined ? v : (T.en[clave] !== undefined ? T.en[clave] : clave);
  }
  function num(x, dec) {
    if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
    const s = Number(x).toLocaleString(idioma === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return s;
  }
  function pct(x, dec, signo) {
    if (x === null || x === undefined) return "—";
    return (signo && x > 0 ? "+" : "") + num(100 * x, dec) + " %";
  }
  function fecha(iso, conHora) {
    const d = new Date(String(iso).length === 10 ? iso + "T12:00:00Z" : iso);
    const op = { day: "numeric", month: "short", year: "numeric" };
    if (conHora) Object.assign(op, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
    return d.toLocaleString(idioma === "es" ? "es-ES" : "en-GB", op);
  }

  // --- Tema --------------------------------------------------------------------------------------------
  function tema() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
  function ponerTema(nuevo) {
    if (nuevo === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    guardar("tema", nuevo);
    pintarBotonTema();
    oyentesTema.forEach(fn => { try { fn(nuevo); } catch (e) { console.error(e); } });
  }
  function pintarBotonTema() {
    const b = document.getElementById("boton-tema");
    if (!b) return;
    const claro = tema() === "light";
    b.textContent = claro ? "☾" : "☀";
    b.title = t(claro ? "theme.dark" : "theme.light");
    b.setAttribute("aria-label", b.title);
  }

  // --- Cabecera y pie ------------------------------------------------------------------------------------
  function cabecera() {
    const c = document.getElementById("cabecera");
    if (!c) return;
    c.className = "barra";
    c.innerHTML =
      `<a class="marca" href="${raiz}index.html">Guillermo Hernández Vidal</a>` +
      `<nav><a href="${raiz}index.html#proyectos" data-t="nav.projects"></a><a href="${raiz}index.html#sobre-mi" data-t="nav.about"></a></nav>` +
      `<button type="button" class="boton-tema" id="boton-tema"></button>` +
      `<div class="idiomas" role="group" aria-label="Language / Idioma">` +
      `<button type="button" data-idioma="en" aria-pressed="false">EN</button>` +
      `<button type="button" data-idioma="es" aria-pressed="false">ES</button></div>`;
    c.querySelectorAll("button[data-idioma]").forEach(b => b.addEventListener("click", () => aplicar(b.dataset.idioma)));
    document.getElementById("boton-tema").addEventListener("click", () => ponerTema(tema() === "light" ? "dark" : "light"));
  }
  function pie() {
    const p = document.getElementById("pie");
    if (!p) return;
    p.innerHTML = `<p>© 2026 Guillermo Hernández Vidal · <span data-t="footer.licence"></span></p><p data-t="footer.disclaimer"></p>`;
  }

  function aplicar(l) {
    idioma = l === "es" ? "es" : "en";
    document.documentElement.lang = idioma;
    const clave = document.documentElement.dataset.titulo;
    if (clave) document.title = t(clave);
    document.querySelectorAll("[data-t]").forEach(el => { el.innerHTML = t(el.getAttribute("data-t")); });
    document.querySelectorAll("[data-t-title]").forEach(el => { el.title = t(el.getAttribute("data-t-title")); });
    document.querySelectorAll("[data-t-aria]").forEach(el => el.setAttribute("aria-label", t(el.getAttribute("data-t-aria"))));
    document.querySelectorAll("[data-t-placeholder]").forEach(el => { el.placeholder = t(el.getAttribute("data-t-placeholder")); });
    document.querySelectorAll(".idiomas button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.idioma === idioma)));
    pintarBotonTema();
    guardar("idioma", idioma);
    oyentesIdioma.forEach(fn => { try { fn(idioma); } catch (e) { console.error(e); } });
  }

  window.SITIO = {
    raiz, config: CONFIG, t, num, pct, fecha, tema,
    get idioma() { return idioma; },
    alCambiarIdioma(fn) { oyentesIdioma.push(fn); },
    alCambiarTema(fn) { oyentesTema.push(fn); },
    iniciar() { cabecera(); pie(); aplicar(idiomaInicial()); },
  };
})();
