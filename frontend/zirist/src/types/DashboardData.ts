export interface ZoneData {
  total: number;
  anomalies: number;
  temp: number;    // Température en °C
  press: number;   // Pression en bars
  vib: number;     // Vibration en mm/s
  fumee: number;   // Fumée en ppm
}

export interface DashboardData {
  total_sensors: number;
  anomalies: number;
  zones: Record<string, ZoneData>; // Remplacez par un type strict avec ZoneData
  last_update?: string;
}