// External API endpoints and configuration

export const API = {
  NOMINATIM: {
    base: 'https://nominatim.openstreetmap.org/search',
    params: { format: 'json', countrycodes: 'id', limit: 5 },
  },
  OSRM: {
    base: 'https://router.project-osrm.org/route/v1/driving',
    params: { overview: 'full', geometries: 'geojson', steps: true },
  },
  ELEVATION: {
    base: 'https://api.open-elevation.com/api/v1/lookup',
    batchSize: 40,
    maxPoints: 120,
  },
  OVERPASS: {
    base: 'https://overpass-api.de/api/interpreter',
    timeout: 25,
  },
};

export const ROUTING = {
  sampleInterval: 150, // meters between elevation samples
  poiBoundaryBuffer: 0.02, // degrees (~2km)
  poiMaxDistance: 1000, // meters from route
  gradientOutlierThreshold: 30, // % - clamp unrealistic values
};

export const EARTH_RADIUS = 6371000; // meters
