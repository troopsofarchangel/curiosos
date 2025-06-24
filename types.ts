
export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}
