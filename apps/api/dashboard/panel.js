'use strict';
const statuses = {
  pending_review: 'Pendiente de revisión', in_review: 'En revisión', approved: 'Aprobado',
  in_progress: 'En atención', resolved: 'Resuelto', rejected: 'Descartado',
};
const priorities = { critical: 'Crítico', medium: 'Medio', low: 'Bajo' };
const risks = { yes: 'Sí', no: 'No', unsure: 'No sabe' };
const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
const byId = (id) => document.getElementById(id);
const filters = byId('filters');
const categoryLabels = {};
let currentPage = 1;
let activeFilters = new URLSearchParams();
let selectedReference;
let listVersion = 0;
let detailVersion = 0;
let saving = false;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function option(value, label) {
  const item = element('option', label);
  item.value = value;
  return item;
}

function feedback(message = '', error = false) {
  byId('feedback').textContent = message;
  byId('feedback').classList.toggle('error', error);
}

async function request(path, init) {
  const response = await fetch(path, init);
  const data = await response.json();
  if (!response.ok) {
    const fieldError = Object.values(data.fields ?? {}).flat()[0];
    throw new Error(fieldError || data.message || 'No se pudo completar la operación.');
  }
  return data;
}

function formatDate(value) {
  return date.format(new Date(value));
}

function renderMetrics(counts) {
  const tally = Object.fromEntries(counts.map(({ status, count }) => [status, count]));
  const metrics = [
    ['Total de reportes', counts.reduce((sum, row) => sum + row.count, 0)],
    ['Pendientes de revisión', tally.pending_review ?? 0],
    ['En revisión o atención', (tally.in_review ?? 0) + (tally.approved ?? 0) + (tally.in_progress ?? 0)],
    ['Resueltos', tally.resolved ?? 0],
  ];
  byId('metrics').replaceChildren(...metrics.map(([label, value]) => {
    const card = element('div', undefined, 'metric');
    card.append(element('strong', String(value)), element('span', label));
    return card;
  }));
}

async function loadQueue({ quiet = false } = {}) {
  const version = ++listVersion;
  const params = new URLSearchParams(activeFilters);
  params.set('page', String(currentPage));
  if (!quiet) feedback('Cargando reportes…');
  try {
    const { rows, pages, counts } = await request('/tickets?' + params);
    if (version !== listVersion) return;
    if (currentPage > pages) {
      currentPage = pages;
      return loadQueue({ quiet });
    }
    renderMetrics(counts);
    byId('page').textContent = currentPage + ' de ' + pages;
    byId('previous').disabled = currentPage <= 1;
    byId('next').disabled = currentPage >= pages;
    byId('tickets').replaceChildren(...rows.map((ticket) => {
      const button = element('button', undefined, 'ticket');
      button.type = 'button';
      button.dataset.reference = ticket.reference;
      button.setAttribute('aria-pressed', String(ticket.reference === selectedReference));
      const heading = element('span', undefined, 'row');
      heading.append(element('strong', ticket.reference), element('span', statuses[ticket.status], 'pill ' + ticket.status));
      button.append(heading, element('span', (categoryLabels[ticket.category] || ticket.category) + ' · ' + (ticket.parkName || 'Parque sin identificar')),
        element('small', formatDate(ticket.createdAt) + (ticket.hasPhoto ? ' · Foto adjunta' : '') +
          (ticket.priority ? ' · Prioridad ' + priorities[ticket.priority] : '')));
      button.addEventListener('click', () => void selectTicket(ticket.reference));
      return button;
    }));
    if (!rows.length) byId('tickets').append(element('p', 'No hay reportes con estos filtros.', 'empty'));
    if (!quiet) feedback();
  } catch (error) {
    if (version === listVersion) feedback(error.message, true);
  }
}

function updateSelection() {
  for (const button of document.querySelectorAll('.ticket')) {
    button.setAttribute('aria-pressed', String(button.dataset.reference === selectedReference));
  }
}

async function selectTicket(reference) {
  if (saving) return;
  const version = ++detailVersion;
  selectedReference = reference;
  updateSelection();
  byId('detail').replaceChildren(element('p', 'Cargando detalle…'));
  try {
    const ticket = await request('/tickets/' + reference);
    if (version === detailVersion) renderDetail(ticket);
  } catch (error) {
    if (version === detailVersion) byId('detail').replaceChildren(element('p', error.message));
  }
}

function renderDetail(ticket) {
  const top = element('div', undefined, 'detail-top');
  top.append(element('h2', ticket.reference), element('span', statuses[ticket.status], 'pill ' + ticket.status));
  const fields = element('dl');
  const values = [
    ['Categoría', categoryLabels[ticket.category] || ticket.category], ['Prioridad', priorities[ticket.priority] || 'Sin asignar'],
    ['Parque', ticket.parkName || 'Parque sin identificar'], ['Localidad', ticket.locality || 'Sin identificar'],
    ['Referencia del sitio', ticket.detail], ['Riesgo informado', risks[ticket.risk]],
    ['Ubicación', ticket.method === 'gps' ? 'GPS del dispositivo' : 'Seleccionada en el mapa'],
    ['Contacto', ticket.email || 'Sin correo'],
  ];
  for (const [label, value] of values) {
    const group = element('div');
    group.append(element('dt', label), element('dd', value));
    fields.append(group);
  }
  const map = element('a', 'Ver punto en el mapa');
  const [latitude, longitude] = [ticket.latitude, ticket.longitude];
  map.href = 'https://www.openstreetmap.org/?mlat=' + latitude + '&mlon=' + longitude + '#map=18/' + latitude + '/' + longitude;
  map.target = '_blank';
  map.rel = 'noreferrer';
  const children = [top, fields, map, element('h3', 'Descripción'), element('p', ticket.description), element('h3', 'Evidencia fotográfica')];
  if (ticket.hasPhoto) {
    const photo = element('img', undefined, 'evidence');
    photo.src = '/tickets/' + ticket.reference + '/photo';
    photo.alt = 'Fotografía adjunta al reporte ' + ticket.reference;
    photo.addEventListener('error', () => photo.replaceWith(element('p', 'La foto no se pudo cargar. Actualiza el detalle.')));
    children.push(photo);
  } else {
    children.push(element('p', 'La persona no adjuntó una fotografía.'));
  }
  if (ticket.nextStatuses.length) children.push(renderActions(ticket));
  children.push(element('h3', 'Historial del ticket'));
  const history = element('ol', undefined, 'history');
  for (const event of [...ticket.history].reverse()) {
    const item = element('li');
    item.append(element('strong', statuses[event.status] + (event.priority ? ' · ' + priorities[event.priority] : '')),
      element('time', formatDate(event.at)));
    if (event.publicNote) item.append(element('p', event.publicNote));
    history.append(item);
  }
  children.push(history);
  byId('detail').replaceChildren(...children);
}

function renderActions(ticket) {
  const form = element('form', undefined, 'ticket-form');
  const stateLabel = element('label', 'Cambiar estado');
  const state = element('select');
  state.required = true;
  state.append(option('', 'Selecciona una acción'), ...ticket.nextStatuses.map((value) => option(value, statuses[value])));
  stateLabel.append(state);
  const priorityLabel = element('label', 'Prioridad');
  const priority = element('select');
  priority.append(option('', 'Sin asignar'), ...Object.entries(priorities).map(([id, label]) => option(id, label)));
  priority.value = ticket.priority || '';
  priorityLabel.append(priority);
  const noteLabel = element('label', 'Mensaje para la persona');
  const note = element('textarea');
  note.rows = 2;
  note.maxLength = 240;
  note.placeholder = 'Opcional. Obligatorio al descartar.';
  noteLabel.append(note);
  const statusMessage = element('p', '', 'feedback');
  statusMessage.setAttribute('role', 'status');
  const save = element('button', 'Guardar cambio', 'primary');
  save.type = 'submit';
  state.addEventListener('change', () => {
    priority.required = ['approved', 'in_progress', 'resolved'].includes(state.value);
    note.required = state.value === 'rejected';
  });
  form.append(stateLabel, priorityLabel, noteLabel, save, statusMessage);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    save.disabled = true;
    statusMessage.textContent = 'Guardando cambio…';
    try {
      const updated = await request('/tickets/' + ticket.reference, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-SIGNU-Panel': '1' },
        body: JSON.stringify({ version: ticket.version, status: state.value, priority: priority.value || null, publicNote: note.value }),
      });
      renderDetail(updated);
      await loadQueue({ quiet: true });
      feedback('Cambio guardado. Ya está disponible en la consulta ciudadana.');
    } catch (error) {
      statusMessage.textContent = error.message;
      statusMessage.classList.add('error');
    } finally {
      saving = false;
      save.disabled = false;
    }
  });
  return form;
}

filters.addEventListener('submit', (event) => {
  event.preventDefault();
  activeFilters = new URLSearchParams(new FormData(filters));
  for (const name of ['status', 'priority']) if (!activeFilters.get(name)) activeFilters.delete(name);
  currentPage = 1;
  void loadQueue();
});
byId('refresh').addEventListener('click', () => {
  if (saving) return;
  void loadQueue();
  if (selectedReference) void selectTicket(selectedReference);
});
byId('previous').addEventListener('click', () => { currentPage -= 1; void loadQueue(); });
byId('next').addEventListener('click', () => { currentPage += 1; void loadQueue(); });

async function start() {
  try {
    const options = await request('/tickets/options');
    Object.assign(categoryLabels, Object.fromEntries(options.categories.map(({ id, label }) => [id, label])));
    for (const [name, labels] of [['status', statuses], ['priority', priorities]]) {
      filters.elements.namedItem(name).append(...Object.entries(labels).map(([id, label]) => option(id, label)));
    }
    await loadQueue();
    setInterval(() => { if (!document.hidden && !saving) void loadQueue({ quiet: true }); }, 12000);
  } catch (error) {
    feedback(error.message, true);
  }
}
void start();
