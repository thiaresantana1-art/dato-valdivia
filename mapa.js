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
  iconSize: [31,31], iconAnchor: [15,29], popupAnchor: [0,-27]
});
const iconoSuper = L.divIcon({
  className: "custom-map-pin",
  html: '<div style="width:31px;height:31px;display:grid;place-items:center;background:#d8ccff;border:3px solid white;border-radius:50% 50% 50% 5px;transform:rotate(-45deg);box-shadow:0 3px 9px #172b4d44"><span style="transform:rotate(45deg);font-size:14px">🛒</span></div>',
  iconSize: [31,31], iconAnchor: [15,29], popupAnchor: [0,-27]
});

function safeExternalLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {}
  return "";
}
function normalizeAddress(address) {
  return address.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}
function placeStatus(lugar) {
  if (lugar.menu_junaeb) return "Menú Junaeb indicado en planilla";
  if (lugar.junaeb.startsWith("Sí")) return "Junaeb indicada en planilla";
  return "Junaeb no indicada en planilla";
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
    status.className = "popup-status" + (lugar.junaeb.startsWith("Sí") ? "" : " no");
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
      frame.style.cssText = "max-width:100%;border:0;border-radius:8px;margin-top:8px";
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
function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("es");
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return "https://www.youtube-nocookie.com/embed/" + parsed.pathname.slice(1);
    if (parsed.hostname.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return "https://www.youtube-nocookie.com/embed/" + id;
      if (parsed.pathname.startsWith("/shorts/")) return "https://www.youtube-nocookie.com/embed/" + parsed.pathname.split("/")[2];
      if (parsed.pathname.startsWith("/embed/")) return "https://www.youtube-nocookie.com/embed/" + parsed.pathname.split("/")[2];
    }
  } catch {}
  return "";
}

function matchesFilter(lugar) {
  const categoria = normalizar(lugar.categoria);
  if (filtroActual === "junaeb") return lugar.junaeb.startsWith("Sí");
  if (filtroActual === "supermercados") return lugar.tipo_categoria === "Supermercado";
  if (filtroActual === "sushi") return categoria.includes("sushi");
  if (filtroActual === "completos") return categoria.includes("completo") || categoria.includes("hot dog");
  if (filtroActual === "hamburguesas") return categoria.includes("hamburguesa") || categoria.includes("burger");
  if (filtroActual === "otros") return lugar.tipo_categoria === "Comida" &&
    !categoria.includes("sushi") && !categoria.includes("completo") &&
    !categoria.includes("hot dog") && !categoria.includes("hamburguesa") &&
    !categoria.includes("burger");
  if (filtroActual === "economicos") return lugar.economico;
  return true;
}
function getFilteredPlaces() {
  const texto = busqueda.value.trim().toLocaleLowerCase("es");
  return lugares.filter(lugar => {
    const searchable = `${lugar.nombre} ${lugar.categoria} ${lugar.direccion} ${lugar.detalle}`.toLocaleLowerCase("es");
    return searchable.includes(texto) && matchesFilter(lugar);
  });
}
function mostrarLugares() {
  const filtrados = getFilteredPlaces();
  lista.replaceChildren();

  estado.textContent = filtrados.length
    ? "Selecciona un local para verlo en el mapa."
    : "No encontramos lugares con esos filtros.";
  resultadoCount.textContent = `${filtrados.length} resultado${filtrados.length === 1 ? "" : "s"}`;

  filtrados.forEach(lugar => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "place-card";
    const icono = document.createElement("span");
    icono.className = "place-icon" + (lugar.tipo_categoria === "Comida" ? " food" : "");
    icono.textContent = lugar.tipo_categoria === "Supermercado" ? "🛒" : "🍴";

    const copy = document.createElement("span");
    copy.className = "place-copy";
    const nombre = document.createElement("strong");
    nombre.textContent = lugar.nombre;
    const detalle = document.createElement("small");
    detalle.textContent = `${lugar.categoria} · ${lugar.direccion || "Dirección por confirmar"}`;
    copy.append(nombre, detalle);

    const badges = document.createElement("span");
    badges.className = "place-badges";
    if (lugar.menu_junaeb) {
      const badge = document.createElement("span");
      badge.className = "mini-badge junaeb";
      badge.textContent = "Menú Junaeb*";
      badges.append(badge);
    } else if (lugar.junaeb.startsWith("Sí")) {
      const badge = document.createElement("span");
      badge.className = "mini-badge junaeb";
      badge.textContent = "Junaeb*";
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
      mapa.setView([lugar.grupo.latitud, lugar.grupo.longitud], 17, { animate: true });
      marcadores.zoomToShowLayer(lugar.grupo.marcador, () => lugar.grupo.marcador.openPopup());
      if (window.innerWidth < 720) {
        document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    lista.append(boton);
  });

  // Synchronize map markers with the selected search/filter results.
  marcadores.clearLayers();
  const visibleGroups = new Set(filtrados.map(l => l.grupo));
  visibleGroups.forEach(grupo => marcadores.addLayer(grupo.marcador));
}
filtros.forEach(boton => {
  boton.addEventListener("click", () => {
    filtroActual = boton.dataset.filter;
    filtros.forEach(item => item.classList.toggle("active", item === boton));
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
    const bounds = L.latLngBounds(filtrados.map(l => [l.latitud, l.longitud]));
    if (bounds.isValid()) mapa.fitBounds(bounds, { padding: [25,25], maxZoom: 15 });
  } else if (todosBounds && todosBounds.isValid()) {
    mapa.fitBounds(todosBounds, { padding: [25,25] });
  }
});

async function iniciar() {
  try {
    // Prototipo: usa los datos guardados en este navegador si existen.
    // Si no existen, carga la base inicial desde lugares.json.
    let datos;
    try {
      const guardados = localStorage.getItem("datoValdivia_lugares");
      datos = guardados ? JSON.parse(guardados) : null;
    } catch (e) {
      console.warn("No se pudieron leer datos locales; se usará lugares.json.", e);
    }
    if (!Array.isArray(datos)) {
      const respuesta = await fetch("./lugares.json");
      if (!respuesta.ok) throw new Error("No se pudo cargar lugares.json");
      datos = await respuesta.json();
    }
    if (!Array.isArray(datos)) throw new Error("El archivo debe ser una lista");

    datos.forEach(lugar => {
      if (typeof lugar.nombre !== "string" ||
          !Number.isFinite(lugar.latitud) || !Number.isFinite(lugar.longitud) ||
          lugar.latitud < -90 || lugar.latitud > 90 ||
          lugar.longitud < -180 || lugar.longitud > 180) {
        console.warn("Lugar omitido por coordenadas inválidas:", lugar);
        return;
      }
      lugar.categoria = lugar.categoria || "Local";
      lugar.direccion = lugar.direccion || "";
      lugar.detalle = lugar.detalle || "";
      lugar.web = lugar.web || "";
      lugar.junaeb = lugar.junaeb || "No indicado en planilla";
      lugares.push(lugar);
    });

    // Share one marker for entries that have the same written address.
    // This is useful for food-court locations, such as several chains in Mall Plaza.
    const groupsByAddress = new Map();
    lugares.forEach((lugar, index) => {
      const normalized = normalizeAddress(lugar.direccion);
      const key = normalized ? `address:${normalized}` : `unique:${index}`;
      if (!groupsByAddress.has(key)) groupsByAddress.set(key, []);
      groupsByAddress.get(key).push(lugar);
    });

    gruposDireccion = [...groupsByAddress.values()].map(items => {
      const group = {
        lugares: items,
        direccion: items.find(x => x.direccion)?.direccion || "",
        latitud: items.reduce((sum, x) => sum + x.latitud, 0) / items.length,
        longitud: items.reduce((sum, x) => sum + x.longitud, 0) / items.length
      };
      group.marcador = L.marker([group.latitud, group.longitud], {
        icon: items.every(x => x.tipo_categoria === "Supermercado") ? iconoSuper : iconoLocal
      }).bindPopup(popupForGroup(group));
      items.forEach(lugar => lugar.grupo = group);
      return group;
    });

    totalStat.textContent = `${lugares.length} lugares`;
    filterTotal.textContent = lugares.length;
    junaebStat.textContent = lugares.filter(x => x.junaeb.startsWith("Sí")).length;
    todosBounds = L.latLngBounds(lugares.map(x => [x.latitud, x.longitud]));
    if (todosBounds.isValid()) mapa.fitBounds(todosBounds, { padding: [28,28], maxZoom: 14 });
    mostrarLugares();
    setTimeout(() => mapa.invalidateSize(), 250);
  } catch (error) {
    console.error(error);
    estado.textContent = "No se pudieron cargar los datos. Comprueba que lugares.json esté en la misma carpeta y abre index.html con Live Server.";
  }
}
iniciar();
