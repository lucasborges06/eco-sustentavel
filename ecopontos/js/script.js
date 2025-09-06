// EcoPontos — script principal

const DEFAULT_POINTS = [
  { id: 'p1', nome: 'Ecoponto Savassi', cidade: 'Belo Horizonte', lat: -19.937, lng: -43.934, materiais: ['Plástico','Papel','Vidro','Metal','Óleo'], obs:'Seg–Sex 9h–18h' },
  { id: 'p2', nome: 'Ponto Verde Paulista', cidade: 'São Paulo', lat: -23.561, lng: -46.655, materiais: ['Plástico','Papel','Vidro','Metal','Eletrônicos'], obs:'Sábados 9h–13h' },
  { id: 'p3', nome: 'Coleta Centro RJ', cidade: 'Rio de Janeiro', lat: -22.906, lng: -43.172, materiais: ['Plástico','Papel','Vidro','Metal','Orgânico'], obs:'24h' },
  { id: 'p4', nome: 'E-lixo Curitiba', cidade: 'Curitiba', lat: -25.429, lng: -49.271, materiais: ['Eletrônicos'], obs:'Recebe apenas e-waste' },
  { id: 'p5', nome: 'Óleo Legal POA', cidade: 'Porto Alegre', lat: -30.033, lng: -51.23, materiais: ['Óleo','Plástico'], obs:'Troca por sabão ecológico' }
];

const LS_KEY = 'ecopontos-data-v1';

function getData(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){ localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_POINTS)); return DEFAULT_POINTS; }
    const parsed = JSON.parse(raw);
    // Merge by id to ensure defaults remain, but let user-added live too
    const map = new Map([...DEFAULT_POINTS, ...parsed].map(p => [p.id || (p.nome+p.lat), p]));
    return Array.from(map.values());
  }catch(e){
    console.warn('Erro ao ler dados, resetando...', e);
    localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_POINTS));
    return DEFAULT_POINTS;
  }
}

function setData(arr){
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  updateHomeStats();
}

function updateHomeStats(){
  const data = getData();
  const cidades = new Set(data.map(p => (p.cidade || '').trim().toLowerCase()).filter(Boolean));
  const elPontos = document.getElementById('stat-pontos');
  const elCidades = document.getElementById('stat-cidades');
  if(elPontos) elPontos.textContent = data.length.toString();
  if(elCidades) elCidades.textContent = cidades.size.toString();
  const year = document.getElementById('year');
  if(year) year.textContent = new Date().getFullYear();
}
document.addEventListener('DOMContentLoaded', updateHomeStats);

// ---- Cadastro ----
function initCadastroPage(){
  const form = document.getElementById('form-ponto');
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const materiais = fd.getAll('materiais');
    const novo = {
      id: 'u'+Date.now(),
      nome: fd.get('nome')?.toString().trim(),
      cidade: fd.get('cidade')?.toString().trim(),
      lat: parseFloat(fd.get('lat')),
      lng: parseFloat(fd.get('lng')),
      materiais,
      obs: fd.get('obs')?.toString().trim() || ''
    };
    const data = getData();
    data.push(novo);
    setData(data);
    window.location.href = 'pontos.html#novo';
  });
}

// ---- Mapa ----
let map, markerLayer;

function initMapPage(){
  updateHomeStats();
  const matFilter = document.getElementById('material-filter');
  const citySearch = document.getElementById('search-city');
  const btnGeo = document.getElementById('btn-geolocate');

  // Initialize Leaflet map
  map = L.map('map').setView([-14.235, -51.925], 4); // Brasil
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  matFilter?.addEventListener('change', renderPoints);
  citySearch?.addEventListener('input', renderPoints);
  btnGeo?.addEventListener('click', geolocate);

  renderPoints();
}

function geolocate(){
  if(!navigator.geolocation) return alert('Geolocalização não suportada pelo navegador.');
  navigator.geolocation.getCurrentPosition((pos)=>{
    const { latitude, longitude } = pos.coords;
    map.setView([latitude, longitude], 13);
    L.marker([latitude, longitude]).addTo(map).bindPopup('Você está aqui');
  }, ()=> alert('Não foi possível obter sua localização.'));
}

function renderPoints(){
  const data = getData();
  const mat = (document.getElementById('material-filter')?.value || 'all');
  const q = (document.getElementById('search-city')?.value || '').trim().toLowerCase();
  const list = document.getElementById('points-list');
  if(!list) return;

  markerLayer.clearLayers();
  list.innerHTML = '';

  const filtered = data.filter(p => {
    const byMat = mat === 'all' || (p.materiais || []).includes(mat);
    const byCity = !q || (p.cidade || '').toLowerCase().includes(q);
    return byMat && byCity;
  });

  // Fit map to markers if any
  const bounds = [];
  filtered.forEach(p => {
    const m = L.marker([p.lat, p.lng]).addTo(markerLayer)
      .bindPopup(`<strong>${p.nome}</strong><br>${p.cidade}<br><small>${(p.materiais||[]).join(', ')}</small>`);
    bounds.push([p.lat, p.lng]);
  });
  if(bounds.length){
    const b = L.latLngBounds(bounds);
    map.fitBounds(b.pad(0.2));
  }

  filtered.forEach(p => {
    const el = document.createElement('div');
    el.className = 'point-card';
    el.innerHTML = `
      <div class="title">${p.nome}</div>
      <div class="muted">${p.cidade}</div>
      <div class="badges">${(p.materiais||[]).map(m=>`<span class="badge">${m}</span>`).join('')}</div>
      ${p.obs ? `<div class="muted" style="margin-top:6px">${p.obs}</div>` : ''}
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
        <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}">Traçar rota</a>
        <button class="btn" onclick="sharePoint('${p.id}')">Compartilhar</button>
      </div>
    `;
    list.appendChild(el);
  });
}

function sharePoint(id){
  const p = getData().find(x => x.id === id);
  if(!p) return;
  const text = `EcoPonto: ${p.nome} — ${p.cidade}\nMateriais: ${(p.materiais||[]).join(', ')}\nLocalização: https://maps.google.com/?q=${p.lat},${p.lng}`;
  if(navigator.share){
    navigator.share({ title: 'EcoPontos', text });
  }else{
    navigator.clipboard.writeText(text);
    alert('Informações copiadas para a área de transferência!');
  }
}
