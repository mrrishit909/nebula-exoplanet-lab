export type Kind = "rocky" | "ocean" | "gas-giant" | "lava" | "ice" | "super-earth";
export type Star = { id: string; name: string; spectralType: string; radiusSolar: number; massSolar: number; temperatureK: number; pos: [number, number, number]; distanceLy: number };
export type Planet = { id: string; starId: string; name: string; kind: Kind; radiusEarth: number; massEarth: number; periodDays: number; semiMajorAxisAu: number; equilibriumTempK: number; discoveryYear: number; inclinationDeg: number; atmosphere: Record<string, number> };
export type CatalogEntry = { year: number; radiusEarth: number; periodDays: number; pos: [number, number, number]; tempK: number };
export type System = Star & { planets: Planet[] };
