import { DEFAULTS } from './shared/defaults.js';
import { createPath, calculatePath, exportComparisonCsv } from './shared/model.js';
import { CONFIG } from './config.js';

const paths = { A: createPath(), B: createPath() };
let linked = true;
const lookupState = new Map();
const controllers = new Map();
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone = (value) => structuredClone(value);
const decimal = (value, digits = 1) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const transportNames = { geo:'GEO Satellite', leo:'LEO Satellite / Starlink', fiber:'Fiber', microwave:'Microwave / Line-of-Sight', internet:'Internet', custom:'Custom' };
const encoderNames = { hevc:'Generic HEVC Encoder', avc:'Generic AVC Encoder', jpegxs:'Generic JPEG XS Encoder', custom:'Custom Encoder' };
const codecNames = { hevc:'HEVC / H.265', avc:'AVC / H.264', jpegxs:'JPEG XS', custom:'Custom' };
const attribution = '<p class="attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>';

function dataAttribution(value) {
  if(!value?.attribution)return '';
  return `<p class="attribution">${escapeHtml(value.attribution)}${value.license?` · ${escapeHtml(value.license)}`:''}</p>`;
}

function options(items, selected) {
  return Object.entries(items).map(([value,label]) => `<option value="${value}" ${value===selected?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function field(id, key, label, value, { type='number', source, min='0', max='10000000', placeholder='', extra='' } = {}) {
  const inputId = `${id}-${key.replaceAll('.','-')}`;
  const hintId = `${inputId}-source`;
  return `<div ${extra}><label class="field-label" for="${inputId}">${label}</label><input id="${inputId}" data-path="${id}" data-key="${key}" type="${type}" value="${escapeHtml(value)}" ${type==='number'?`min="${min}" max="${max}" step="any" inputmode="decimal"`:'maxlength="300"'} placeholder="${escapeHtml(placeholder)}" ${source?`aria-describedby="${hintId}"`:''}>${source?`<span id="${hintId}" class="provenance" data-source="${key}">${source}</span>`:''}</div>`;
}
function select(id, key, label, items, value) {
  const inputId = `${id}-${key.replaceAll('.','-')}`;
  return `<div><label class="field-label" for="${inputId}">${label}</label><select id="${inputId}" data-path="${id}" data-key="${key}">${options(items,value)}</select></div>`;
}
function resolvedMarkup(id, end) {
  const ep = paths[id].endpoint;
  const resolved = ep[`${end}Resolved`];
  const status = lookupState.get(`${id}-${end}`);
  if (status?.loading) return '<p>Looking up address…</p>';
  if (status?.error) return `<p class="errors">${escapeHtml(status.error)}</p>`;
  if (status?.candidates) return `<p>Select the location you intended:</p><ul>${status.candidates.map((candidate,index) => `<li><button type="button" class="candidate" data-action="choose-address" data-path="${id}" data-end="${end}" data-index="${index}">${escapeHtml(candidate.label)}<small>${escapeHtml(candidate.resultType || 'Location')} · ${decimal(candidate.lat,5)}, ${decimal(candidate.lon,5)}</small></button>${dataAttribution(candidate.attribution)}</li>`).join('')}</ul>${attribution}`;
  if (resolved) return `<p class="resolved">Selected: ${escapeHtml(resolved.address)}<br>${decimal(resolved.latitude,5)}, ${decimal(resolved.longitude,5)}</p>${dataAttribution(resolved.attribution)}${attribution}`;
  return '';
}
function endpointMarkup(id) {
  const ep = paths[id].endpoint;
  if (id==='B' && linked) return `<div class="linked-note"><strong>Endpoints linked to Path A</strong><p>${escapeHtml(ep.sourceLabel || 'Source')} to ${escapeHtml(ep.destinationLabel || 'Destination')}</p><p>Change locations in Path A, or uncheck “Use the same endpoints” above.</p></div>`;
  let html = `<div class="form-grid">${select(id,'endpoint.method','Input method',{distance:'Distance',address:'Address',latlon:'Latitude / Longitude'},ep.method)}${select(id,'endpoint.unit','Distance unit',{mi:'Miles',km:'Kilometers'},ep.unit)}</div>`;
  html += `<div class="form-grid location-labels">${field(id,'endpoint.sourceLabel','Source label',ep.sourceLabel,{type:'text'})}${field(id,'endpoint.destinationLabel','Destination label',ep.destinationLabel,{type:'text'})}</div>`;
  if (ep.method==='distance') {
    html += `<div class="distance-input">${field(id,'endpoint.distance',`Geographic distance (${ep.unit})`,ep.distance,{max:'1000000',source:'User distance · default 1,000 mi'})}</div><p class="hint">Use geographic separation. Fiber applies the route factor below. Microwave uses this distance directly.</p>`;
  } else if (ep.method==='latlon') {
    html += `<div class="form-grid location-labels">${field(id,'endpoint.sourceLat','Source latitude',ep.sourceLat,{min:'-90',max:'90',placeholder:'−90 to 90'})}${field(id,'endpoint.sourceLon','Source longitude',ep.sourceLon,{min:'-180',max:'180',placeholder:'−180 to 180'})}${field(id,'endpoint.destinationLat','Destination latitude',ep.destinationLat,{min:'-90',max:'90',placeholder:'−90 to 90'})}${field(id,'endpoint.destinationLon','Destination longitude',ep.destinationLon,{min:'-180',max:'180',placeholder:'−180 to 180'})}</div><p class="hint">Decimal degrees. North and east are positive; south and west are negative.</p>`;
  } else {
    for (const end of ['source','destination']) {
      const title = end==='source'?'Source':'Destination';
      html += `<div class="address-block"><div class="field-row">${field(id,`endpoint.${end}Address`,`${title} address`,ep[`${end}Address`],{type:'text',placeholder:'Street address, city, country'})}<button type="button" data-action="lookup" data-path="${id}" data-end="${end}" ${lookupState.get(`${id}-${end}`)?.loading?'disabled':''}>Look up</button></div><div id="${id}-${end}-lookup" class="geocode-result" role="status">${resolvedMarkup(id,end)}</div></div>`;
    }
    html += `<button class="text-button" type="button" data-action="coordinates" data-path="${id}">Use latitude / longitude instead</button><p class="hint">Look up sends the entered address to the Worker and Geoapify. Select and check each returned location before calculating.</p>`;
  }
  return `${html}<div id="${id}-distance-note" class="distance-note"></div>`;
}
function renderControls(id) {
  const p = paths[id];
  const container = $(`#controls-${id}`);
  const advancedOpen = container.querySelector('.advanced')?.open;
  const decoderOpen = container.querySelector('.decoder-summary details')?.open;
  const numericTransport = ['fiber','microwave'].includes(p.transport);
  const result = calculatePath(p);
  const delay = numericTransport && p.transportOverride===null ? (result.valid?Number(result.transportMs.toFixed(6)):'') : numericTransport?p.transportOverride:p.transportMs;
  container.innerHTML = `<div class="control-title"><h2>Path ${id} settings</h2><button class="secondary" type="button" data-action="reset" data-path="${id}">Reset Path ${id}</button></div>
    <div class="control-section"><h3 class="section-label"><span>01</span> Transport</h3><div class="form-grid">
      ${select(id,'transport','Transport type',transportNames,p.transport)}
      ${field(id,'transportDelay','Transport delay (ms)',delay,{source:numericTransport?(p.transportOverride===null?'Calculated':'User entered'):p.transportSource})}
      ${p.transport==='internet'?select(id,'internetProfile','Internet path',{local:'Local / Metro',regional:'Regional',long:'Long Distance'},p.internetProfile):''}
      ${p.transport==='custom'?field(id,'transportName','Transport name',p.transportName,{type:'text',placeholder:'Custom transport',extra:'class="span-2"'}):''}
    </div>${numericTransport?`<button class="text-button" data-action="calculated" data-path="${id}" type="button" ${p.transportOverride===null?'hidden':''}>Use calculated delay</button>`:''}<p class="hint">${numericTransport?'Calculated propagation only. You can enter a measured transport delay to override it.':'Editable one-way planning estimate. Include applicable network and buffer delay.'}</p></div>
    <div class="control-section"><h3 class="section-label"><span>02</span> Encoder &amp; decoder</h3><div class="form-grid">
      ${select(id,'encoder','Encoder',encoderNames,p.encoder)}
      ${field(id,'encodeMs','Encode delay (ms)',p.encodeMs,{source:p.encodeSource})}
      ${p.encoder==='custom'?field(id,'encoderName','Encoder / codec name',p.encoderName,{type:'text',placeholder:'Custom encoder',extra:'class="span-2"'}):''}
    </div><div class="decoder-summary"><p><strong id="${id}-decoder-name">${escapeHtml(result.valid?result.decoderLabel:p.decoder==='custom'?'Custom Decoder':`${codecNames[p.encoder]} Decoder`)}</strong> · ${escapeHtml(p.decodeMs)} ms</p><details ${decoderOpen?'open':''}><summary>Change decoder</summary><div class="form-grid">${select(id,'decoder','Decoder',{matching:'Matching generic decoder',custom:'Custom decoder'},p.decoder)}${p.decoder==='custom'?field(id,'decoderName','Decoder name',p.decoderName,{type:'text',placeholder:'Custom decoder'}):''}</div></details></div><div class="decode-input">${field(id,'decodeMs','Decode delay (ms)',p.decodeMs,{source:p.decodeSource})}</div></div>
    <div class="control-section"><h3 class="section-label"><span>03</span> Endpoints &amp; distance</h3>${endpointMarkup(id)}</div>
    <details class="advanced" ${advancedOpen?'open':''}><summary>Advanced assumptions</summary><div class="form-grid">${field(id,'displayMs','Display delay (ms)',p.displayMs,{source:p.displaySource})}${field(id,'routeFactor','Fiber route factor (×)',p.routeFactor,{min:'1',max:'10',source:p.routeFactorSource})}</div><p class="hint">Fiber uses 65% of light speed. Microwave uses 99%. The route factor applies only to fiber. Frame equivalents use 60 fps.</p></details>
    <div id="${id}-errors" class="errors" role="status" aria-live="polite"></div>`;
}

function transportDrawing(kind) {
  const satellite = (x,y) => `<g transform="translate(${x} ${y})" stroke="currentColor" stroke-width="2" fill="#edf4f8"><rect x="-10" y="-9" width="20" height="18" rx="2"/><path d="M-13-7h-24v14h24M13-7h24v14H13M-29-7V7M29-7V7M0 9v10m-6-1 6 4 6-4"/></g>`;
  if(kind==='geo') return `<path class="route" d="M170 115 320 24 470 115"/>${satellite(320,24)}<path class="route" d="M170 124q150 10 300 0" opacity=".15"/>`;
  if(kind==='leo') return `<path class="route" d="M170 115 290 63 350 63 470 115"/>${satellite(320,61)}<path class="route" d="M180 43q140-25 280 0" stroke-dasharray="4 6" opacity=".3"/>`;
  if(kind==='fiber') return '<path class="route" d="M170 112c35-40 55 45 93 0s53 42 90 0 73 30 117 0"/><path class="route" d="M170 126c35-40 55 45 93 0s53 42 90 0 73 30 117 0" opacity=".25"/>';
  if(kind==='microwave') return '<path class="route" d="M170 113H470" stroke-dasharray="5 7"/><path class="route" d="m170 92 15 43m-15 0 15-43m270 0 15 43m-15 0 15-43"/><path class="route" d="M200 98q12 15 0 30m240-30q-12 15 0 30" opacity=".5"/>';
  if(kind==='internet') return '<path class="route" d="M170 113h82m136 0h82"/><path class="route" d="M273 130c-36-2-35-40-10-46-4-38 40-48 58-24 25-18 51-1 51 20 33 0 36 49 5 50Z"/><path class="route" d="m287 99 32-12 31 20-27 14Z" opacity=".4"/><circle cx="287" cy="99" r="4" fill="currentColor"/><circle cx="319" cy="87" r="4" fill="currentColor"/><circle cx="350" cy="107" r="4" fill="currentColor"/><circle cx="323" cy="121" r="4" fill="currentColor"/>';
  return '<path class="route" d="M170 113h300"/><circle cx="280" cy="113" r="8" fill="#fff" stroke="currentColor" stroke-width="2"/><circle cx="360" cy="113" r="8" fill="#fff" stroke="currentColor" stroke-width="2"/>';
}
function renderSummary(id, r) {
  const p=paths[id];
  const source = r.valid?r.sourceLabel:p.endpoint.sourceLabel || 'Source';
  const destination = r.valid?r.destinationLabel:p.endpoint.destinationLabel || 'Destination';
  const routeDistance = r.valid && ['fiber','microwave'].includes(p.transport)?`${decimal(p.endpoint.unit==='mi'?r.routeKm/DEFAULTS.units.kmPerMile:r.routeKm)} ${p.endpoint.unit} · `:'';
  const title = p.transport==='custom'?p.transportName || 'Custom transport':transportNames[p.transport];
  $(`#summary-${id}`).innerHTML = `<div class="path-top"><div class="path-title"><span class="path-letter">${id}</span><h2>Path ${id}</h2></div><span class="transport-tag">${escapeHtml(title)}</span></div>
    <div class="diagram" role="img" aria-label="${escapeHtml(`Path ${id}: ${source} to ${destination} via ${title}. ${r.valid?`Encode ${decimal(r.encodeMs)}, transport ${decimal(r.transportMs)}, decode ${decimal(r.decodeMs)}, display ${decimal(r.displayMs)} milliseconds. Total ${decimal(r.totalMs)} milliseconds.`:'Awaiting valid inputs.'}`)}">
    <div class="endpoint-labels"><span>${source==='Source'?'Source':`Source · ${escapeHtml(source)}`}</span><span>${destination==='Destination'?'Destination':`Destination · ${escapeHtml(destination)}`}</span></div>
    <svg viewBox="0 0 640 155" aria-hidden="true"><path class="route" d="M42 113h64m428 0h64"/><rect class="stage" x="106" y="93" width="64" height="40" rx="6"/><path d="m128 103 18 10-18 10Z" fill="currentColor"/><rect class="stage" x="470" y="93" width="64" height="40" rx="6"/><path d="m511 103-18 10 18 10Z" fill="currentColor"/>${transportDrawing(p.transport)}<g fill="#fff" stroke="currentColor" stroke-width="2"><rect x="8" y="97" width="32" height="29" rx="4"/><path d="m19 103 12 9-12 9Z" fill="currentColor"/><rect x="599" y="96" width="33" height="26" rx="2"/><path d="M615 122v9m-10 0h20"/></g></svg>
    <div class="stage-labels"><div><span>${escapeHtml(codecNames[p.encoder])} Encode</span><strong>${r.valid?decimal(r.encodeMs):'—'} ms</strong></div><div><span>${escapeHtml(title)}</span><strong>${routeDistance}${r.valid?decimal(r.transportMs):'—'} ms</strong></div><div><span>Decode + Display</span><strong>${r.valid?`${decimal(r.decodeMs)} + ${decimal(r.displayMs)}`:'—'} ms</strong></div></div>
    <p class="diagram-caption">Source → Encode → Transport → Decode → Display → Destination</p></div>
    <div class="path-result"><div><span class="total-label">Total one-way delay</span><div class="total">${r.valid?`${decimal(r.totalMs)}<small>ms</small>`:'—'}</div></div><div class="secondary-result">${r.valid?`<strong>${decimal(r.seconds,3)} sec</strong>${decimal(r.frames)} frames @ 60 fps`:'Enter valid settings<br>to calculate this path'}</div></div>`;
}
function updateResults() {
  const results={A:calculatePath(paths.A),B:calculatePath(paths.B)};
  for(const id of ['A','B']) {
    const r=results[id]; const p=paths[id];
    renderSummary(id,r);
    const errors=$(`#${id}-errors`);
    if(errors) errors.innerHTML=r.valid?'':`<strong>Check this path:</strong><ul>${r.errors.map(error=>`<li>${escapeHtml(error)}</li>`).join('')}</ul>`;
    const note=$(`#${id}-distance-note`);
    if(note) note.textContent=r.valid?`Geographic: ${decimal(p.endpoint.unit==='mi'?r.distanceKm/DEFAULTS.units.kmPerMile:r.distanceKm)} ${p.endpoint.unit}${p.transport==='fiber'?` · Estimated fiber route: ${decimal(p.endpoint.unit==='mi'?r.routeKm/DEFAULTS.units.kmPerMile:r.routeKm)} ${p.endpoint.unit} (${p.routeFactor}×)`:''}`:'Distance will appear when the location inputs are valid.';
    const numeric=['fiber','microwave'].includes(p.transport);
    const delay=$(`#${id}-transportDelay`);
    if(delay && numeric && p.transportOverride===null) delay.value=r.valid?Number(r.transportMs.toFixed(6)):'';
    const source=$(`#${id}-transportDelay-source`);
    if(source) source.textContent=numeric?(p.transportOverride===null?'Calculated':'User entered'):p.transportSource;
    for(const key of ['encodeMs','decodeMs','displayMs','routeFactor']) {
      const el=$(`#${id}-${key}-source`);
      if(el) el.textContent=p[{encodeMs:'encodeSource',decodeMs:'decodeSource',displayMs:'displaySource',routeFactor:'routeFactorSource'}[key]];
    }
    const restore=$(`[data-action="calculated"][data-path="${id}"]`);
    if(restore) restore.hidden=p.transportOverride===null;
    const decoderSummary=$(`#controls-${id} .decoder-summary>p`);
    if(decoderSummary) decoderSummary.innerHTML=`<strong>${escapeHtml(r.valid?r.decoderLabel:p.decoder==='custom'?p.decoderName || 'Custom Decoder':`${codecNames[p.encoder]} Decoder`)}</strong> · ${escapeHtml(p.decodeMs)} ms`;
  }
  const valid=results.A.valid && results.B.valid;
  $('#export').disabled=!valid;
  $('#difference').innerHTML=valid?`${decimal(Math.abs(results.A.totalMs-results.B.totalMs))} ms<span>${decimal(Math.abs(results.A.seconds-results.B.seconds),3)} sec · ${decimal(Math.abs(results.A.frames-results.B.frames))} frames @ 60 fps</span>`:'—<span>Complete both paths to compare</span>';
}
function announce(text) { $('#action-status').textContent=text; }
function cancelLookups(id) {
  for(const end of ['source','destination']) {
    const key=`${id}-${end}`;
    controllers.get(key)?.abort();controllers.delete(key);lookupState.delete(key);
  }
}
function syncEndpoints() {
  if(linked) { cancelLookups('B'); paths.B.endpoint=clone(paths.A.endpoint);renderControls('B'); }
}
function assignInput(input) {
  const id=input.dataset.path; const key=input.dataset.key;const p=paths[id];const value=input.value;
  if(key.startsWith('endpoint.')) {
    const name=key.slice(9);const ep=p.endpoint;
    if(name==='unit' && ep.method==='distance' && ep.distance!=='' && Number.isFinite(Number(ep.distance))) ep.distance=Number(ep.distance)*(value==='km'?DEFAULTS.units.kmPerMile:1/DEFAULTS.units.kmPerMile);
    ep[name]=value;
    if(name.endsWith('Address')) {
      const end=name.startsWith('source')?'source':'destination';
      ep[`${end}Resolved`]=null;
      const lookupKey=`${id}-${end}`;controllers.get(lookupKey)?.abort();controllers.delete(lookupKey);lookupState.delete(lookupKey);
      const resultEl=$(`#${id}-${end}-lookup`);if(resultEl) resultEl.textContent='';
      const button=$(`[data-action="lookup"][data-path="${id}"][data-end="${end}"]`);if(button) button.disabled=false;
    }
    if(name==='method')cancelLookups(id);
    syncEndpoints();
  } else if(key==='encoder') {
    p.encoder=value;p.encodeMs=DEFAULTS.encoders[value].encodeMs;p.encodeSource=value==='custom'?'User entered':'Default';
    p.decoder=value==='custom'?'custom':'matching';p.decodeMs=DEFAULTS.encoders[value].decodeMs;p.decodeSource=value==='custom'?'User entered':'Default';
  } else if(key==='decoder') {
    p.decoder=value;
    if(value==='matching'){p.decodeMs=DEFAULTS.encoders[p.encoder].decodeMs;p.decodeSource='Default';}
    else p.decodeSource='User entered';
  } else if(key==='transport') {
    p.transport=value;p.transportOverride=null;
    const preset=value==='internet'?`internet${{local:'Local',regional:'Regional',long:'Long'}[p.internetProfile]}`:value;
    p.transportMs=DEFAULTS.transports[preset] ?? 0;p.transportSource=value==='custom'?'User entered':'Default';
  } else if(key==='internetProfile') {
    p.internetProfile=value;p.transportMs=DEFAULTS.transports[`internet${{local:'Local',regional:'Regional',long:'Long'}[value]}`];p.transportSource='Default';
  } else if(key==='transportDelay') {
    if(['fiber','microwave'].includes(p.transport))p.transportOverride=value;
    else {p.transportMs=value;p.transportSource='User entered';}
  } else {
    p[key]=value;
    const sourceKey={encodeMs:'encodeSource',decodeMs:'decodeSource',displayMs:'displaySource',routeFactor:'routeFactorSource'}[key];
    if(sourceKey)p[sourceKey]='User entered';
  }
  if(input.tagName==='SELECT') {
    const focusId=input.id;renderControls(id);document.getElementById(focusId)?.focus();
  }
  updateResults();
}
document.addEventListener('input',event=>{if(event.target.matches('input[data-key]'))assignInput(event.target);});
document.addEventListener('change',event=>{if(event.target.matches('select[data-key]'))assignInput(event.target);});

async function fetchJson(url, controller) {
  const timeout=setTimeout(()=>controller.abort(),CONFIG.requestTimeoutMs);
  try {
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    const data=await response.json();
    if(!response.ok || data.ok===false)throw new Error(data.error?.message || `Request failed (${response.status}).`);
    return data;
  } finally {clearTimeout(timeout);}
}
async function lookupAddress(id,end) {
  const ep=paths[id].endpoint;const query=ep[`${end}Address`].trim();const key=`${id}-${end}`;
  if(query.length<3){lookupState.set(key,{error:'Enter at least 3 characters for the address.'});renderControls(id);return;}
  if(!CONFIG.workerUrl){lookupState.set(key,{error:'Address lookup is not configured. Use coordinates or distance.'});renderControls(id);return;}
  controllers.get(key)?.abort();
  const controller=new AbortController();controllers.set(key,controller);lookupState.set(key,{loading:true});renderControls(id);
  try {
    const data=await fetchJson(`${CONFIG.workerUrl.replace(/\/$/,'')}/geocode?address=${encodeURIComponent(query)}`,controller);
    if(paths[id].endpoint!==ep || ep.method!=='address' || ep[`${end}Address`].trim()!==query || controllers.get(key)!==controller)return;
    const candidates=(Array.isArray(data.candidates)?data.candidates:[]).filter(c=>typeof c.label==='string' && typeof c.lat==='number' && Number.isFinite(c.lat) && Math.abs(c.lat)<=90 && typeof c.lon==='number' && Number.isFinite(c.lon) && Math.abs(c.lon)<=180).slice(0,5);
    lookupState.set(key,candidates.length?{candidates}:{error:'No matching locations. Add the city and country, or use coordinates.'});
  } catch(error) {
    if(controllers.get(key)!==controller || paths[id].endpoint!==ep || ep[`${end}Address`].trim()!==query)return;
    lookupState.set(key,{error:error.name==='AbortError'?'Address lookup timed out. Try again or use coordinates.':`${error.message} Use coordinates or distance if lookup remains unavailable.`});
  } finally {
    if(controllers.get(key)===controller){controllers.delete(key);renderControls(id);updateResults();}
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');if(!button)return;
  const {action,path:id,end}=button.dataset;
  if(action==='reset') {
    cancelLookups(id);const endpoint=clone(paths.A.endpoint);paths[id]=createPath();
    if(id==='B' && linked)paths.B.endpoint=endpoint;
    if(id==='A')syncEndpoints();renderControls(id);updateResults();announce(`Path ${id} reset.`);
  } else if(action==='calculated') {paths[id].transportOverride=null;renderControls(id);updateResults();}
  else if(action==='coordinates') {cancelLookups(id);paths[id].endpoint.method='latlon';syncEndpoints();renderControls(id);updateResults();}
  else if(action==='lookup')void lookupAddress(id,end);
  else if(action==='choose-address') {
    const candidate=lookupState.get(`${id}-${end}`)?.candidates?.[Number(button.dataset.index)];if(!candidate)return;
    const ep=paths[id].endpoint;
    ep[`${end}Resolved`]={address:candidate.label,latitude:candidate.lat,longitude:candidate.lon,query:ep[`${end}Address`].trim(),attribution:clone(candidate.attribution || {})};
    ep[`${end}Lat`]=candidate.lat;ep[`${end}Lon`]=candidate.lon;
    lookupState.delete(`${id}-${end}`);syncEndpoints();renderControls(id);updateResults();announce(`${end==='source'?'Source':'Destination'} address selected for Path ${id}.`);
  }
});
$('#linked').addEventListener('change',event=>{
  linked=event.target.checked;if(linked)syncEndpoints();else renderControls('B');updateResults();announce(linked?'Path B endpoints linked to Path A.':'Path B endpoints can now be edited independently.');
});
$('#copy').addEventListener('click',()=>{cancelLookups('B');paths.B=clone(paths.A);renderControls('B');updateResults();announce('All Path A settings copied to Path B.');});
$('#reset-all').addEventListener('click',()=>{cancelLookups('A');cancelLookups('B');paths.A=createPath();paths.B=createPath();linked=true;$('#linked').checked=true;renderControls('A');renderControls('B');updateResults();announce('Both paths reset to the V1 defaults; endpoints linked.');});
$('#export').addEventListener('click',()=>{
  try {
    const csv=exportComparisonCsv([paths.A,paths.B]);const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download=`video-latency-comparison-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Comparison CSV downloaded with one row for each path.');
  } catch(error) {announce(error.message);}
});
async function checkApi() {
  if(!CONFIG.workerUrl){$('#api-status').textContent='Address lookup is not configured.';return;}
  try {
    const base=CONFIG.workerUrl.replace(/\/$/,'');
    const [health,data]=await Promise.all([fetchJson(`${base}/health`,new AbortController()),fetchJson(`${base}/defaults`,new AbortController())]);
    if(!health.ok || !data.defaults)throw new Error('Unexpected API response');
    if(data.defaults.version!==DEFAULTS.version || JSON.stringify(data.defaults)!==JSON.stringify(DEFAULTS)) {
      $('#api-status').textContent='API defaults differ from this V1 package. Packaged defaults retained.';return;
    }
    $('#api-status').textContent='Address API connected · V1 defaults verified.';
  } catch {$('#api-status').textContent='Address API unavailable. Deploy the Worker to enable lookup; distance and coordinates work now.';}
}
renderControls('A');renderControls('B');updateResults();void checkApi();
