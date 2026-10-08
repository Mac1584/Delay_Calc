import { DEFAULTS } from './defaults.js';

const EARTH_RADIUS_KM = 6371.0088;
const MAX_LATENCY_MS = 10_000_000;
const MAX_DISTANCE_KM = 1_000_000;
const CODEC_NAMES = { hevc: 'HEVC', avc: 'AVC', jpegxs: 'JPEG XS' };

const TRANSPORT_LABELS = {
  geo: 'GEO satellite',
  leo: 'LEO satellite',
  internet: 'Internet',
  internetLocal: 'Internet — local',
  internetRegional: 'Internet — regional',
  internetLong: 'Internet — long distance',
  fiber: 'Fiber',
  microwave: 'Microwave',
  custom: 'Custom transport',
};

export function createPath(defaults = DEFAULTS) {
  return {
    encoder: 'hevc',
    encoderName: '',
    encodeMs: defaults.encoders.hevc.encodeMs,
    encodeSource: 'Default',
    decoder: 'matching',
    decoderName: '',
    decodeMs: defaults.encoders.hevc.decodeMs,
    decodeSource: 'Default',
    transport: 'geo',
    internetProfile: 'local',
    transportName: '',
    transportMs: defaults.transports.geo,
    transportSource: 'Default',
    transportOverride: null,
    displayMs: defaults.assumptions.displayMs,
    displaySource: 'Default',
    routeFactor: defaults.assumptions.fiberRouteFactor,
    routeFactorSource: 'Default',
    endpoint: {
      method: 'distance',
      distance: 1000,
      unit: 'mi',
      sourceLabel: 'Source',
      destinationLabel: 'Destination',
      sourceAddress: '',
      destinationAddress: '',
      sourceLat: '',
      sourceLon: '',
      destinationLat: '',
      destinationLon: '',
      sourceResolved: null,
      destinationResolved: null,
    },
  };
}

function number(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && value.trim() === '') return NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

function boundedNumber(value, min, max, label, errors) {
  const result = number(value);
  if (!Number.isFinite(result) || result < min || result > max) {
    errors.push(`${label} must be a number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`);
  }
  return result;
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function provenance(value, fallback = 'Default') {
  if (value === 'Override') return 'User entered';
  return ['Default', 'Calculated', 'User entered'].includes(value) ? value : fallback;
}

function normalizedQuery(value) {
  return text(value).replace(/\s+/gu, ' ').toLowerCase();
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

// Wrap longitude differences and clamp round-off at antipodal points.
export function haversineKm(latitude1, longitude1, latitude2, longitude2) {
  const phi1 = radians(latitude1);
  const phi2 = radians(latitude2);
  const deltaPhi = phi2 - phi1;
  const deltaLongitude = ((longitude2 - longitude1 + 540) % 360) - 180;
  const deltaLambda = radians(deltaLongitude);
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
}

function coordinates(endpoint, errors) {
  if (endpoint.method === 'address') {
    for (const side of ['source', 'destination']) {
      const label = side === 'source' ? 'Source' : 'Destination';
      if (!text(endpoint[`${side}Address`])) errors.push(`${label} address is required.`);
      const resolved = endpoint[`${side}Resolved`];
      if (!resolved) errors.push(`Resolve the ${side} address before calculating.`);
      if (resolved?.query !== undefined && normalizedQuery(resolved.query) !== normalizedQuery(endpoint[`${side}Address`])) {
        errors.push(`Resolve the updated ${side} address before calculating.`);
      }
    }
    const source = endpoint.sourceResolved || {};
    const destination = endpoint.destinationResolved || {};
    return {
      sourceLat: boundedNumber(source.latitude, -90, 90, 'Source latitude', errors),
      sourceLon: boundedNumber(source.longitude, -180, 180, 'Source longitude', errors),
      destinationLat: boundedNumber(destination.latitude, -90, 90, 'Destination latitude', errors),
      destinationLon: boundedNumber(destination.longitude, -180, 180, 'Destination longitude', errors),
    };
  }
  return {
    sourceLat: boundedNumber(endpoint.sourceLat, -90, 90, 'Source latitude', errors),
    sourceLon: boundedNumber(endpoint.sourceLon, -180, 180, 'Source longitude', errors),
    destinationLat: boundedNumber(endpoint.destinationLat, -90, 90, 'Destination latitude', errors),
    destinationLon: boundedNumber(endpoint.destinationLon, -180, 180, 'Destination longitude', errors),
  };
}

export function calculatePath(path, defaults = DEFAULTS) {
  const errors = [];
  if (!path || typeof path !== 'object') return { valid: false, errors: ['A path is required.'] };
  const endpoint = path.endpoint || {};
  const encoder = defaults.encoders[path.encoder];
  const decoderKey = path.decoder === 'matching' ? path.encoder : path.decoder;
  const decoder = defaults.encoders[decoderKey];
  if (!encoder) errors.push('Select a valid encoder.');
  if (!decoder) errors.push('Select a valid decoder.');
  if (!Object.hasOwn(TRANSPORT_LABELS, path.transport)) errors.push('Select a valid transport.');
  if (path.transport === 'internet' && !['local', 'regional', 'long'].includes(path.internetProfile)) {
    errors.push('Select a valid internet profile.');
  }

  const encodeMs = boundedNumber(path.encodeMs, 0, MAX_LATENCY_MS, 'Encoder latency (ms)', errors);
  const decodeMs = boundedNumber(path.decodeMs, 0, MAX_LATENCY_MS, 'Decoder latency (ms)', errors);
  const displayMs = boundedNumber(path.displayMs, 0, MAX_LATENCY_MS, 'Display latency (ms)', errors);

  let distanceKm;
  if (endpoint.method === 'distance') {
    if (!['mi', 'km'].includes(endpoint.unit)) errors.push('Distance unit must be miles or kilometers.');
    const inputDistance = number(endpoint.distance);
    distanceKm = inputDistance * (endpoint.unit === 'mi' ? defaults.units.kmPerMile : 1);
    boundedNumber(distanceKm, 0, MAX_DISTANCE_KM, 'Distance (km)', errors);
  } else if (['latlon', 'coordinates', 'address'].includes(endpoint.method)) {
    const position = coordinates(endpoint, errors);
    distanceKm = haversineKm(position.sourceLat, position.sourceLon, position.destinationLat, position.destinationLon);
  } else {
    errors.push('Choose distance, coordinates, or address as the endpoint input method.');
  }

  let routeKm = distanceKm;
  let transportMs;
  let transportSource = provenance(path.transportSource);
  if (path.transport === 'fiber') {
    const routeFactor = boundedNumber(path.routeFactor, 1, 10, 'Fiber route factor', errors);
    routeKm = distanceKm * routeFactor;
    transportMs = routeKm / (defaults.assumptions.lightSpeedKmS * defaults.assumptions.fiberSpeedFraction) * 1000;
    transportSource = 'Calculated';
  } else if (path.transport === 'microwave') {
    transportMs = distanceKm / (defaults.assumptions.lightSpeedKmS * defaults.assumptions.microwaveSpeedFraction) * 1000;
    transportSource = 'Calculated';
  } else {
    transportMs = boundedNumber(path.transportMs, 0, MAX_LATENCY_MS, 'Transport latency (ms)', errors);
  }
  if (['fiber', 'microwave'].includes(path.transport) && path.transportOverride !== null && path.transportOverride !== undefined) {
    transportMs = boundedNumber(path.transportOverride, 0, MAX_LATENCY_MS, 'Transport override (ms)', errors);
    transportSource = 'User entered';
  }

  if (errors.length) return { valid: false, errors };
  const totalMs = encodeMs + transportMs + decodeMs + displayMs;
  const internetLabels = { local: 'Internet — local', regional: 'Internet — regional', long: 'Internet — long distance' };
  return {
    valid: true,
    errors: [],
    distanceKm,
    routeKm,
    encodeMs,
    transportMs,
    decodeMs,
    displayMs,
    totalMs,
    seconds: totalMs / 1000,
    frames: totalMs / 1000 * defaults.assumptions.frameRate,
    transportSource,
    transportLabel: path.transport === 'custom'
      ? text(path.transportName, TRANSPORT_LABELS.custom)
      : path.transport === 'internet' ? internetLabels[path.internetProfile] : TRANSPORT_LABELS[path.transport],
    codecLabel: encoder.label.replace(/^Generic\s+/u, ''),
    encoderLabel: path.encoder === 'custom' ? text(path.encoderName, 'Custom encoder') : `Generic ${CODEC_NAMES[path.encoder]} Encoder`,
    decoderLabel: decoderKey === 'custom' ? text(path.decoderName, 'Custom decoder') : `Generic ${CODEC_NAMES[decoderKey]} Decoder`,
    sourceLabel: text(endpoint.sourceLabel, 'Source'),
    destinationLabel: text(endpoint.destinationLabel, 'Destination'),
  };
}

const CSV_HEADERS = [
  'Path', 'Input method', 'Source label', 'Destination label',
  'Source address input', 'Destination address input', 'Source resolved address', 'Destination resolved address',
  'Geocoding provider', 'Geocoding provider URL', 'OpenStreetMap license URL',
  'Source data source name', 'Source data attribution', 'Source data license', 'Source data URL',
  'Destination data source name', 'Destination data attribution', 'Destination data license', 'Destination data URL',
  'Source latitude', 'Source longitude', 'Destination latitude', 'Destination longitude',
  'Distance input', 'Distance input unit', 'Straight-line distance km', 'Straight-line distance mi',
  'Route distance km', 'Route distance mi', 'Fiber route factor', 'Fiber route factor source',
  'Codec', 'Encoder selection', 'Encoder name', 'Encoder latency ms', 'Encoder latency source',
  'Decoder selection', 'Decoder name', 'Decoder latency ms', 'Decoder latency source',
  'Transport selection', 'Internet profile', 'Transport name', 'Transport latency ms', 'Transport latency source',
  'Transport override ms', 'Display latency ms', 'Display latency source',
  'Total latency ms', 'Total latency seconds', 'Total latency frames', 'Frame rate fps',
  'Absolute difference ms', 'Absolute difference seconds', 'Absolute difference frames',
  'Light speed km/s', 'Fiber speed fraction', 'Microwave speed fraction', 'Defaults version',
];

// Numeric cells are generated from validated numbers. Every text cell is guarded
// before RFC 4180 escaping so spreadsheet software cannot execute user input.
function csvCell(value) {
  if (typeof value === 'number') return String(value);
  let result = value === null || value === undefined ? '' : String(value);
  if (/^[\s]*[=+\-@\t\r]/u.test(result) || /^[\t\r]/u.test(result)) result = `'${result}`;
  return /[",\r\n]/u.test(result) ? `"${result.replaceAll('"', '""')}"` : result;
}

function validatedOptionalNumber(value) {
  const result = number(value);
  return Number.isFinite(result) ? result : '';
}

function csvRow(name, path, result, differenceMs, defaults) {
  const endpoint = path.endpoint;
  const isAddress = endpoint.method === 'address';
  const isCoordinates = ['latlon', 'coordinates'].includes(endpoint.method);
  const isFiber = path.transport === 'fiber';
  const hasPropagation = isFiber || path.transport === 'microwave';
  const source = endpoint.sourceResolved || {};
  const destination = endpoint.destinationResolved || {};
  const sourceAttribution = source.attribution || {};
  const destinationAttribution = destination.attribution || {};
  return [
    name, endpoint.method, result.sourceLabel, result.destinationLabel,
    isAddress ? endpoint.sourceAddress : '', isAddress ? endpoint.destinationAddress : '',
    isAddress ? source.address : '', isAddress ? destination.address : '',
    isAddress ? 'Geoapify' : '', isAddress ? 'https://www.geoapify.com/' : '',
    isAddress ? 'https://www.openstreetmap.org/copyright' : '',
    isAddress ? sourceAttribution.sourcename : '', isAddress ? sourceAttribution.attribution : '',
    isAddress ? sourceAttribution.license : '', isAddress ? sourceAttribution.url : '',
    isAddress ? destinationAttribution.sourcename : '', isAddress ? destinationAttribution.attribution : '',
    isAddress ? destinationAttribution.license : '', isAddress ? destinationAttribution.url : '',
    isAddress ? number(source.latitude) : isCoordinates ? number(endpoint.sourceLat) : '',
    isAddress ? number(source.longitude) : isCoordinates ? number(endpoint.sourceLon) : '',
    isAddress ? number(destination.latitude) : isCoordinates ? number(endpoint.destinationLat) : '',
    isAddress ? number(destination.longitude) : isCoordinates ? number(endpoint.destinationLon) : '',
    endpoint.method === 'distance' ? number(endpoint.distance) : '', endpoint.method === 'distance' ? endpoint.unit : '',
    result.distanceKm, result.distanceKm / defaults.units.kmPerMile,
    hasPropagation ? result.routeKm : '', hasPropagation ? result.routeKm / defaults.units.kmPerMile : '',
    isFiber ? number(path.routeFactor) : '', isFiber ? provenance(path.routeFactorSource) : '',
    result.codecLabel, path.encoder, result.encoderLabel, result.encodeMs, provenance(path.encodeSource),
    path.decoder, result.decoderLabel, result.decodeMs, provenance(path.decodeSource),
    path.transport, path.transport === 'internet' ? path.internetProfile : '', result.transportLabel,
    result.transportMs, result.transportSource,
    hasPropagation && path.transportOverride !== null && path.transportOverride !== undefined ? validatedOptionalNumber(path.transportOverride) : '',
    result.displayMs, provenance(path.displaySource),
    result.totalMs, result.seconds, result.frames, defaults.assumptions.frameRate,
    differenceMs, differenceMs / 1000, differenceMs / 1000 * defaults.assumptions.frameRate,
    defaults.assumptions.lightSpeedKmS, defaults.assumptions.fiberSpeedFraction,
    defaults.assumptions.microwaveSpeedFraction, defaults.version,
  ];
}

export function exportComparisonCsv(paths, defaults = DEFAULTS) {
  const values = Array.isArray(paths) ? paths : [paths?.A ?? paths?.pathA, paths?.B ?? paths?.pathB];
  if (values.length !== 2) throw new Error('CSV export requires Path A and Path B.');
  const results = values.map(path => calculatePath(path, defaults));
  const invalid = results.flatMap((result, index) => result.errors.map(error => `Path ${index === 0 ? 'A' : 'B'}: ${error}`));
  if (invalid.length) throw new Error(invalid.join('\n'));
  const differenceMs = Math.abs(results[0].totalMs - results[1].totalMs);
  const rows = [CSV_HEADERS, ...values.map((path, index) => csvRow(index === 0 ? 'Path A' : 'Path B', path, results[index], differenceMs, defaults))];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
