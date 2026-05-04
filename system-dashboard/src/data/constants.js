// Plant zones
export const PLANT_ZONES = [
  { id: 'zone_1', name: 'Zone 1', color: '#3B82F6' },
  { id: 'zone_2', name: 'Zone 2', color: '#8B5CF6' },
  { id: 'zone_3', name: 'Zone 3', color: '#F59E0B' },
  { id: 'zone_4', name: 'Zone 4', color: '#10B981' },
  { id: 'zone_5', name: 'Zone 5', color: '#EF4444' },
  { id: 'zone_6', name: 'Zone 6', color: '#06B6D4' },
  { id: 'zone_7', name: 'Zone 7', color: '#EC4899' },
  { id: 'zone_8', name: 'Zone 8', color: '#84CC16' },
  { id: 'zone_9', name: 'Zone 9', color: '#F97316' },
  { id: 'zone_10', name: 'Zone 10', color: '#14B8A6' },
];

export const SENSOR_THRESHOLDS = {
  vibration: { unit: 'mm/s', normalMax: 4, warningMax: 7, label: 'Vibration' },
  temperature: { unit: '°C', normalMax: 70, warningMax: 85, label: 'Temperature' },
  pressure: { unit: 'bar', normalMin: 2, normalMax: 8, warningMax: 10, warningMin: 1, label: 'Pressure' },
  current: { unit: 'A', normalMax: 80, warningMax: 100, label: 'Current' },
  acoustic: { unit: 'dB', normalMax: 70, warningMax: 85, label: 'Acoustic Noise' },
  flowRate: { unit: 'L/min', normalMax: 75, warningMax: 95, label: 'Flow Rate' },
  humidity: { unit: '%', normalMax: 65, warningMax: 80, label: 'Humidity' },
};

export const FACTOR_THRESHOLDS = {
  latency: { unit: 'ms', normalMax: 5, warningMax: 15, label: 'Delay' },
  energy: { unit: '', normalMax: 0.3, warningMax: 0.6, label: 'Energy Consumption' },
  congestion: { unit: '%', normalMax: 35, warningMax: 70, label: 'Network Condition' },
  cpu: { unit: '%', normalMax: 40, warningMax: 75, label: 'Node Computing Capacity' },
  memory: { unit: '%', normalMax: 35, warningMax: 70, label: 'Bandwidth Cost' },
  priority: { unit: 'KB', normalMax: 256, warningMax: 512, label: 'Task Size', max: 600 },
  hopCount: { unit: 'hops', normalMax: 2, warningMax: 4, label: 'Hop Count' },
};

export const STATUS_COLORS = {
  normal: { bg: 'bg-emerald-500', text: 'text-emerald-500', hex: '#10B981' },
  warning: { bg: 'bg-amber-500', text: 'text-amber-500', hex: '#F59E0B' },
  critical: { bg: 'bg-red-500', text: 'text-red-500', hex: '#EF4444' },
  edge: { bg: 'bg-blue-500', text: 'text-blue-500', hex: '#3B82F6' },
  fog: { bg: 'bg-purple-500', text: 'text-purple-500', hex: '#8B5CF6' },
  cloud: { bg: 'bg-gray-500', text: 'text-gray-500', hex: '#6B7280' },
};
