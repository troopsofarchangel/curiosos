
import React from 'react';
import type { LogEntry } from '../types';
import { LocationMarkerIcon, AlertTriangleIcon } from './Icons';

interface LogDisplayProps {
  logs: LogEntry[];
}

export const LogDisplay: React.FC<LogDisplayProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-6 px-4 bg-gray-700 rounded-lg">
        <p className="text-gray-400">Nenhuma atividade registrada ainda.</p>
        <p className="text-xs text-gray-500 mt-1">Ative o serviço para começar o monitoramento.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 p-1 rounded-lg max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-gray-700 p-3 pt-4 -mt-1 z-10 border-b border-gray-600 text-gray-200">Registro de Atividades:</h3>
      <ul className="space-y-3 p-3 pt-0">
        {logs.map((log) => (
          <li key={log.id} className="p-3 bg-gray-600 rounded-md shadow text-sm">
            <div className="flex items-center text-red-400 mb-1">
              <AlertTriangleIcon className="w-4 h-4 mr-2 shrink-0"/>
              <strong className="font-medium">{log.message}</strong>
            </div>
            <p className="text-xs text-gray-400 mb-1">{log.timestamp}</p>
            {log.coordinates && (
              <div className="text-xs text-gray-300 flex items-center">
                <LocationMarkerIcon className="w-3 h-3 mr-1.5 text-indigo-400 shrink-0"/>
                Lat: {log.coordinates.latitude.toFixed(5)}, Lon: {log.coordinates.longitude.toFixed(5)} (Acc: {log.coordinates.accuracy.toFixed(0)}m)
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
