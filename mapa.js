
const mapa = L.map("mapa", { scrollWheelZoom: false }).setView([-39.82, -73.23], 13);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(mapa);

mapa.on("click", () => mapa.scrollWheelZoom.enable());
mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());

const marcadores = L.markerClusterGroup({
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 35
});

mapa.addLayer(marcadores);

const lista = document.getElementById("lista");
const busqueda = document.getElementById("busqueda");
const estado = document.getElementById("estado");
const resultadoCount = document.getElementById("resultado-count");
const totalStat = document.getElementById("stat-total");
const junaebStat = document.getElementById("stat-junaeb");
const filterTotal = document.getElementById("filter-total");
const filtros = [...document.querySelectorAll(".filter-btn")];

let lugares = [];
let gruposDireccion = [];
let filtroActual = "todos";
let todosBounds = null;

const iconoLocal = L.divIcon({
  className: "custom-map-pin",
  html: '<div style="width:31px;height:31px;display:grid;place-items:center;background:#d7fa67;border:3px solid white;border-radius:50% 50% 50% 5px;transform:rotate(-45deg);box-shadow:0 3px 9px #172b4d44"><span style="transform:rotate(45deg);font-size:14px">⌂</span></div>',
  iconSize: [31, 31],
  iconAnchor: [15, 29],
  popupAnchor: [0, -27]
});

const iconoSuper = L.divIcon({
  className: "custom-map-pin",
  html: '<div style="width:31px;height:31px;display:grid;place-items:center;background:#d8ccff;border:3px solid white;border-radius:50% 50% 50% 5px;transform:rotate(-45deg);box-shadow:0 3px 9px #172b4d44"><span style="transform:rotate(45deg);font-size:14px">🛒</span></div>',
  iconSize: [31, 31],
  iconAnchor: [15, 29],
  popupAnchor: [0, -27]
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(address) {
  return normalizar(address)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeExternalLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch {}
  return "";
}

function placeStatus(lugar) {
  if (lugar.menu_junaeb) return "Menú Junaeb indicado en planilla";
  if (String(lugar.junaeb || "").startsWith("Sí")) {
    return "Junaeb indicada en planilla";
  }
  return "Junaeb no indicada en planilla";
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return "https://www.youtube-nocookie.com/embed/" +
        parsed.pathname.slice(1);
    }

    if (parsed.hostname.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return "https://www.youtube-nocookie.com/embed/" + id;

      if (parsed.pathname.startsWith("/shorts/")) {
        return "https://www.youtube-nocookie.com/embed/" +
          parsed.pathname.split("/")[2];
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return "https://www.youtube-nocookie.com/embed/" +
          parsed.pathname.split("/")[2];
      }
    }
  } catch {}

  return "";
}

function popupForGroup(grupo) {
  const wrap = document.createElement("div");
  const title = document.createElement("strong");

  title.textContent = grupo.lugares.length > 1
    ? `${grupo.lugares.length} locales en este punto`
    : grupo.lugares[0].nombre;

  wrap.append(title);

  const address = document.createElement("div");
  address.textContent = grupo.direccion || "Dirección por confirmar";
  wrap.append(address);

  grupo.lugares.forEach(lugar => {
    const item = document.createElement("div");
    item.className = "popup-item";

    const name = document.createElement("strong");
    name.textContent = lugar.nombre;

    const type = document.createElement("div");
    type.textContent = lugar.categoria;

    const status = document.createElement("span");
    status.className = "popup-status" +
      (String(lugar.junaeb || "").startsWith("Sí") ? "" : " no");
    status.textContent = placeStatus(lugar);

    item.append(name, type, status);

    if (lugar.detalle) {
      const note = document.createElement("div");
      note.textContent = lugar.detalle;
      item.append(note);
    }

    const link = safeExternalLink(lugar.web);

    if (link) {
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Ver sitio o redes ↗";
      item.append(document.createElement("br"), a);
    }

    const video = safeExternalLink(lugar.video_url || "");
    const embed = youtubeEmbed(video);

    if (embed) {
      const frame = document.createElement("iframe");
      frame.src = embed;
      frame.width = "280";
      frame.height = "158";
      frame.title = "Video de " + lugar.nombre;
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;
      frame.style.cssText =
        "max-width:100%;border:0;border-radius:8px;margin-top:8px";

      item.append(document.createElement("br"), frame);
    } else if (video) {
      const a = document.createElement("a");
      a.href = video;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Ver video del local ↗";
      item.append(document.createElement("br"), a);
    }

    wrap.append(item);
  });

  return wrap;
}

// FILTROS POR CATEGORÍA
function matchesFilter(lugar) {
  const categoria = normalizar(lugar.categoria);
  const tipo = normalizar(lugar.tipo_categoria);
  const nombre = normalizar(lugar.nombre);
  const detalle = normalizar(lugar.detalle);
  const textoLocal = `${categoria} ${nombre} ${detalle}`;

  const esSupermercado = tipo === "supermercado";
  const esComida = !esSupermercado;

  const contiene = (...palabras) =>
    palabras.some(palabra => textoLocal.includes(palabra));

  if (filtroActual === "junaeb") {
    return String(lugar.junaeb || "").startsWith("Sí");
  }

  if (filtroActual === "supermercados") {
    return esSupermercado;
  }

  if (filtroActual === "economicos") {
    return Boolean(lugar.economico);
  }

  if (filtroActual === "sushi") {
    return esComida && contiene("sushi");
  }

  if (filtroActual === "completos") {
    return esComida && contiene("completo", "hot dog", "hotdog");
  }

  if (filtroActual === "hamburguesas") {
    return esComida && contiene("hamburguesa", "hamburguesas", "burger");
  }

  if (filtroActual === "comida-china") {
    return esComida && contiene("comida china", "china", "chinese", "chifa");
  }

  if (filtroActual === "shawarma") {
    return esComida && contiene("shawarma", "kebab");
  }

  if (filtroActual === "tacos") {
    return esComida && contiene("taco", "mexicana", "mexicano", "taqueria");
  }

  if (filtroActual === "cafeterias") {
    return esComida && contiene("cafeteria", "cafe", "coffee");
  }

  if (filtroActual === "papas-fritas") {
    return esComida && contiene("papas fritas", "fritas", "fries");
  }

  if (filtroActual === "pizza") {
    return esComida && contiene("pizza", "pizzeria");
  }

  if (filtroActual === "comida-casera") {
    return esComida && contiene("comida casera", "casera", "menu del dia");
  }

  if (filtroActual === "otros") {
    const conocidas = [
      "sushi", "completo", "hot dog", "hotdog",
      "hamburguesa", "burger", "comida china", "china",
      "chinese", "chifa", "shawarma", "kebab", "taco",
      "mexicana", "mexicano", "taqueria", "cafeteria",
      "cafe", "coffee", "papas fritas", "fritas", "fries",
      "pizza", "pizzeria", "comida casera", "casera",
      "menu del dia"
    ];

    return esComida &&
      !conocidas.some(palabra => textoLocal.includes(palabra));
  }

  return true;
}

function getFilteredPlaces() {
  const texto = normalizar(busqueda.value);

  return lugares.filter(lugar => {
    const searchable = normalizar(
      `${lugar.nombre} ${lugar.categoria} ${lugar.direccion} ${lugar.detalle}`
    );

    return searchable.includes(texto) && matchesFilter(lugar);
  });
}

function mostrarLugares() {
  const filtrados = getFilteredPlaces();
  lista.replaceChildren();

  estado.textContent = filtrados.length
    ? "Selecciona un local para verlo en el mapa."
    : "No encontramos lugares con esos filtros.";

  resultadoCount.textContent =
    `${filtrados.length} resultado${filtrados.length === 1 ? "" : "s"}`;

  filtrados.forEach(lugar => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "place-card";

    const icono = document.createElement("span");
    icono.className = "place-icon" +
      (normalizar(lugar.tipo_categoria) === "comida" ? " food" : "");

    icono.textContent =
      normalizar(lugar.tipo_categoria) === "supermercado" ? "🛒" : "🍴";

    const copy = document.createElement("span");
    copy.className = "place-copy";

    const nombre = document.createElement("strong");
    nombre.textContent = lugar.nombre;

    const detalle = document.createElement("small");
    detalle.textContent =
      `${lugar.categoria} · ${lugar.direccion || "Dirección por confirmar"}`;

    copy.append(nombre, detalle);

    const badges = document.createElement("span");
    badges.className = "place-badges";

    if (lugar.menu_junaeb ||
        String(lugar.junaeb || "").startsWith("Sí")) {
      const badge = document.createElement("span");
      badge.className = "mini-badge junaeb";
      badge.textContent = lugar.menu_junaeb ? "Menú Junaeb*" : "Junaeb*";
      badges.append(badge);
    }

    if (lugar.economico) {
      const badge = document.createElement("span");
      badge.className = "mini-badge economico";
      badge.textContent = "Dato de precio";
      badges.append(badge);
    }

    if (badges.childNodes.length) copy.append(badges);

    const flecha = document.createElement("span");
    flecha.className = "place-arrow";
    flecha.textContent = "↗";

    boton.append(icono, copy, flecha);

    boton.addEventListener("click", () => {
      const grupo = lugar.grupo;
      if (!grupo || !grupo.marcador) return;

      mapa.setView([grupo.latitud, grupo.longitud], 17, { animate: true });

      if (!marcadores.hasLayer(grupo.marcador)) {
        marcadores.addLayer(grupo.marcador);
      }

      marcadores.zoomToShowLayer(grupo.marcador, () => {
        grupo.marcador.openPopup();
      });

      if (window.innerWidth < 720) {
        document.getElementById("mapa").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });

    lista.append(boton);
  });

  // Mostrar en el mapa solo los grupos que coinciden con el filtro.
  marcadores.clearLayers();

  const visibleGroups = new Set(filtrados.map(lugar => lugar.grupo));

  visibleGroups.forEach(grupo => {
    marcadores.addLayer(grupo.marcador);
  });
}

// ACTIVAR BOTONES
filtros.forEach(boton => {
  boton.addEventListener("click", () => {
    filtroActual = boton.dataset.filter;

    filtros.forEach(item => {
      item.classList.toggle("active", item === boton);
    });

    mostrarLugares();
  });
});

busqueda.addEventListener("input", mostrarLugares);

document.getElementById("limpiar").addEventListener("click", () => {
  busqueda.value = "";
  busqueda.focus();
  mostrarLugares();
});

document.getElementById("ver-todos").addEventListener("click", () => {
  const filtrados = getFilteredPlaces();

  if (filtrados.length) {
    const bounds = L.latLngBounds(
      filtrados.map(lugar => [lugar.latitud, lugar.longitud])
    );

    if (bounds.isValid()) {
      mapa.fitBounds(bounds, { padding: [25, 25], maxZoom: 15 });
    }
  } else if (todosBounds && todosBounds.isValid()) {
    mapa.fitBounds(todosBounds, { padding: [25, 25] });
  }
});

// CARGA DE DATOS
async function iniciar() {
  try {
    let datos;

    try {
      const response = await fetch(
        `${window.DATO_SUPABASE_URL}/rest/v1/lugares?select=*&order=id.asc`,
        {
          headers: {
            apikey: window.DATO_SUPABASE_KEY,
            Authorization: `Bearer ${window.DATO_SUPABASE_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Supabase respondió ${response.status}`);
      }

      datos = await response.json();

      if (!Array.isArray(datos)) {
        throw new Error("La respuesta de Supabase no es una lista");
      }

      console.info(
        `Dato Valdivia: ${datos.length} locales cargados desde Supabase.`
      );
    } catch (error) {
      console.error(
        "No se pudo leer Supabase; se intentará cargar el JSON local.",
        error
      );

      const respuesta = await fetch("./lugares.json");

      if (!respuesta.ok) {
        throw new Error("No se pudo cargar Supabase ni lugares.json");
      }

      datos = await respuesta.json();

      estado.textContent =
        "Mostrando una copia local de respaldo; la base compartida no respondió.";
    }

    if (!Array.isArray(datos)) {
      throw new Error("La base de datos no devolvió una lista");
    }

    datos.forEach(lugar => {
      // Convertir coordenadas antes de validarlas.
      lugar.latitud = Number(lugar.latitud);
      lugar.longitud = Number(lugar.longitud);

      if (
        typeof lugar.nombre !== "string" ||
        !Number.isFinite(lugar.latitud) ||
        !Number.isFinite(lugar.longitud) ||
        lugar.latitud < -90 ||
        lugar.latitud > 90 ||
        lugar.longitud < -180 ||
        lugar.longitud > 180
      ) {
        console.warn("Lugar omitido por coordenadas inválidas:", lugar);
        return;
      }

      lugar.categoria = lugar.categoria || "Local";
      lugar.direccion = lugar.direccion || "";
      lugar.detalle = lugar.detalle || "";
      lugar.web = lugar.web || "";
      lugar.video_url = lugar.video_url || "";
      lugar.junaeb = lugar.junaeb || "No indicado en planilla";
      lugar.menu_junaeb = Boolean(lugar.menu_junaeb);
      lugar.economico = Boolean(lugar.economico);

      lugar.tipo_categoria = lugar.tipo_categoria ||
        (normalizar(lugar.categoria).includes("supermercado")
          ? "Supermercado"
          : "Comida");

      lugares.push(lugar);
    });

    // Agrupar locales que comparten dirección.
    const groupsByAddress = new Map();

    lugares.forEach((lugar, index) => {
      const normalized = normalizeAddress(lugar.direccion);
      const key = normalized ? `address:${normalized}` : `unique:${index}`;

      if (!groupsByAddress.has(key)) {
        groupsByAddress.set(key, []);
      }

      groupsByAddress.get(key).push(lugar);
    });

    gruposDireccion = [...groupsByAddress.values()].map(items => {
      const group = {
        lugares: items,
        direccion: items.find(item => item.direccion)?.direccion || "",
        latitud: items.reduce((sum, item) => sum + item.latitud, 0) / items.length,
        longitud: items.reduce((sum, item) => sum + item.longitud, 0) / items.length
      };

      group.marcador = L.marker(
        [group.latitud, group.longitud],
        {
          icon: items.every(
            item => normalizar(item.tipo_categoria) === "supermercado"
          ) ? iconoSuper : iconoLocal
        }
      ).bindPopup(popupForGroup(group));

      items.forEach(lugar => {
        lugar.grupo = group;
      });

      return group;
    });

    totalStat.textContent = `${lugares.length} lugares`;
    filterTotal.textContent = lugares.length;

    junaebStat.textContent = lugares.filter(
      lugar => String(lugar.junaeb || "").startsWith("Sí")
    ).length;

    todosBounds = L.latLngBounds(
      lugares.map(lugar => [lugar.latitud, lugar.longitud])
    );

    if (todosBounds.isValid()) {
      mapa.fitBounds(todosBounds, {
        padding: [28, 28],
        maxZoom: 14
      });
    }

    mostrarLugares();

    setTimeout(() => mapa.invalidateSize(), 250);
  } catch (error) {
    console.error(error);
    estado.textContent =
      "No se pudieron cargar los datos. Comprueba la conexión con Supabase o el archivo lugares.json.";
  }
}

iniciar();
