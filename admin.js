const STORAGE_KEY = "datoValdivia_lugares";
let originales = [];
let lugares = [];
const $ = id => document.getElementById(id);
const campos = ["nombre","tipo","categoria","direccion","latitud","longitud","detalle","junaeb","web","video"];
const form = $("form-local");

function normalizeRecord(r) {
  const tipo = r.tipo_categoria || (String(r.categoria).toLowerCase().includes("supermercado") ? "Supermercado" : "Comida");
  return {
    ...r,
    nombre: String(r.nombre || "").trim(),
    categoria: String(r.categoria || (tipo === "Supermercado" ? "Supermercado" : "Otro")),
    direccion: String(r.direccion || r.descripcion || "").trim(),
    latitud: Number(r.latitud),
    longitud: Number(r.longitud),
    detalle: String(r.detalle || ""),
    web: String(r.web || ""),
    video_url: String(r.video_url || ""),
    junaeb: String(r.junaeb || "No indicado en planilla"),
    menu_junaeb: Boolean(r.menu_junaeb),
    economico: Boolean(r.economico),
    tipo_categoria: tipo,
    tipo_negocio: tipo
  };
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lugares));
  render();
}
function render() {
  const q = $("search-admin").value.trim().toLocaleLowerCase("es");
  const filtered = lugares.filter(r => `${r.nombre} ${r.categoria} ${r.direccion}`.toLocaleLowerCase("es").includes(q));
  $("summary").textContent = `${lugares.length} registros · ${lugares.filter(x=>x.junaeb.startsWith("Sí")).length} marcados Junaeb en la planilla`;
  const tbody = $("tabla");
  tbody.replaceChildren();
  filtered.forEach(r => {
    const tr = document.createElement("tr");
    [r.nombre, r.categoria, `${r.direccion || "Sin dirección"}\n${r.latitud}, ${r.longitud}`].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    const actions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "edit"; edit.textContent = "Editar";
    edit.addEventListener("click", () => loadForm(r.id));
    const del = document.createElement("button");
    del.className = "delete"; del.textContent = "Eliminar";
    del.addEventListener("click", () => {
      if (confirm(`¿Eliminar "${r.nombre}" de esta copia local?`)) {
        lugares = lugares.filter(x => x.id !== r.id); persist();
      }
    });
    wrap.append(edit,del); actions.append(wrap); tr.append(actions); tbody.append(tr);
  });
}
function clearForm() {
  form.reset(); $("edit-id").value = "";
  $("form-title").textContent = "Agregar un local";
  $("form-eyebrow").textContent = "NUEVO REGISTRO";
  $("save-btn").textContent = "Guardar local";
  $("cancel-btn").hidden = true;
}
function loadForm(id) {
  const r = lugares.find(x => x.id === id);
  if (!r) return;
  $("edit-id").value = r.id;
  $("nombre").value = r.nombre;
  $("tipo").value = r.tipo_categoria;
  const cat = [...$("categoria").options].some(o => o.value.toLowerCase() === String(r.categoria).toLowerCase());
  $("categoria").value = cat ? [...$("categoria").options].find(o => o.value.toLowerCase() === String(r.categoria).toLowerCase()).value : "Otro";
  $("direccion").value = r.direccion;
  $("latitud").value = r.latitud;
  $("longitud").value = r.longitud;
  $("detalle").value = r.detalle;
  $("junaeb").value = r.junaeb;
  $("web").value = r.web;
  $("video").value = r.video_url;
  $("menu-junaeb").checked = r.menu_junaeb;
  $("economico").checked = r.economico;
  $("form-title").textContent = "Editar local";
  $("form-eyebrow").textContent = "MODIFICAR REGISTRO";
  $("save-btn").textContent = "Guardar cambios";
  $("cancel-btn").hidden = false;
  window.scrollTo({top:0,behavior:"smooth"});
}
form.addEventListener("submit", e => {
  e.preventDefault();
  const id = $("edit-id").value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const record = {
    id,
    nombre: $("nombre").value.trim(),
    categoria: $("categoria").value === "Otro" ? "Otro" : $("categoria").value,
    tipo_categoria: $("tipo").value,
    tipo_negocio: $("tipo").value,
    direccion: $("direccion").value.trim(),
    latitud: Number($("latitud").value),
    longitud: Number($("longitud").value),
    detalle: $("detalle").value.trim(),
    junaeb: $("junaeb").value,
    menu_junaeb: $("menu-junaeb").checked,
    economico: $("economico").checked,
    web: $("web").value.trim(),
    video_url: $("video").value.trim()
  };
  if (!record.nombre || !Number.isFinite(record.latitud) || !Number.isFinite(record.longitud) ||
      record.latitud < -90 || record.latitud > 90 || record.longitud < -180 || record.longitud > 180) {
    $("form-message").textContent = "Revisa el nombre y las coordenadas. Latitud: -90 a 90; longitud: -180 a 180.";
    return;
  }
  const index = lugares.findIndex(x => x.id === id);
  if (index >= 0) lugares[index] = {...lugares[index], ...record};
  else lugares.unshift(record);
  persist(); clearForm();
  $("form-message").textContent = "Guardado en este navegador. Para compartir los cambios, exporta el JSON y actualiza la base publicada.";
});
$("cancel-btn").addEventListener("click", clearForm);
$("search-admin").addEventListener("input", render);
$("exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(lugares.map(({id,...r})=>r),null,2)], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "lugares.json"; a.click();
  URL.revokeObjectURL(url);
});
$("importar").addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("El archivo debe contener una lista JSON.");
    lugares = parsed.map((r,i)=>({...normalizeRecord(r), id: r.id || `import-${Date.now()}-${i}`}));
    persist(); clearForm();
    $("form-message").textContent = "Archivo importado. Revisa los registros y exporta una copia de respaldo.";
  } catch(err) { alert("No se pudo importar: " + err.message); }
  e.target.value = "";
});
$("resetear").addEventListener("click", () => {
  if (!confirm("¿Restaurar los datos originales incluidos en lugares.json? Se perderán los cambios locales actuales.")) return;
  lugares = originales.map((r,i)=>({...normalizeRecord(r), id:r.id || `base-${i}`}));
  persist(); clearForm();
});
async function init() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const res = await fetch("./lugares.json");
    if (!res.ok) throw new Error("No se pudo leer lugares.json");
    originales = (await res.json()).map((r,i)=>({...normalizeRecord(r),id:r.id || `base-${i}`}));
    lugares = saved ? JSON.parse(saved).map((r,i)=>({...normalizeRecord(r),id:r.id || `saved-${i}`})) : originales.map(r=>({...r}));
    if (!saved) localStorage.setItem(STORAGE_KEY,JSON.stringify(lugares));
    render();
  } catch(err) {
    $("summary").textContent = "Error cargando los datos. Abre esta página con Live Server.";
    console.error(err);
  }
}
init();
