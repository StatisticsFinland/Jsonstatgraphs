declare module '*.geojson' {
  import type { GeoJsonFeatureCollection } from '../src/types';
  const value: GeoJsonFeatureCollection;
  export default value;
}
