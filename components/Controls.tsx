
import React from 'react';
import { PowerIcon, VolumeUpIcon, VolumeDownIcon, DonateIcon, StopIcon, HourglassIcon, GpsFixedIcon, TrashIcon } from './Icons';

interface ControlsProps {
  isServiceActive: boolean;
  isArming: boolean;
  onToggleService: () => void;
  alarmVolume: number;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onDonate: () => void;
  isAlarmPlaying: boolean;
  onStopAlarm: () => void;
  onClearLogs: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isServiceActive,
  isArming,
  onToggleService,
  alarmVolume,
  onVolumeUp,
  onVolumeDown,
  onDonate,
  isAlarmPlaying,
  onStopAlarm,
  onClearLogs
}) => {
  const mainButtonText = isAlarmPlaying ? "PARAR ALARME" : isArming ? "ARMANDO..." : isServiceActive ? "DESATIVAR" : "ATIVAR SERVIÇO";
  const mainButtonIcon = isAlarmPlaying ? <StopIcon className="w-6 h-6 mr-2 shrink-0" /> : isArming ? <HourglassIcon className="w-6 h-6 mr-2 animate-spin shrink-0" /> : isServiceActive ? <PowerIcon className="w-6 h-6 mr-2 shrink-0" /> : <PowerIcon className="w-6 h-6 mr-2 shrink-0" />;
  const mainButtonColor = isAlarmPlaying ? "bg-red-600 hover:bg-red-700 focus:ring-red-500" : isArming ? "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-gray-800" : isServiceActive ? "bg-red-500 hover:bg-red-600 focus:ring-red-400" : "bg-green-500 hover:bg-green-600 focus:ring-green-400";


  return (
    <div className="space-y-4 mb-6">
      <button
        onClick={isAlarmPlaying ? onStopAlarm : onToggleService}
        disabled={isArming && !isAlarmPlaying}
        className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-4 rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${mainButtonColor} ${ (isArming && !isAlarmPlaying) ? 'opacity-70 cursor-not-allowed' : 'text-white'}`}
        aria-live="polite"
      >
        {mainButtonIcon}
        {mainButtonText}
      </button>
      {!isServiceActive && !isArming && !isAlarmPlaying && (
        <div className="flex items-center justify-center text-xs text-gray-400 mt-2 px-1 text-center">
          <GpsFixedIcon className="w-3.5 h-3.5 mr-1.5 shrink-0 text-indigo-400"/>
          <span>Ao ativar, o GPS será usado para registrar a localização em caso de detecção.</span>
        </div>
      )}

      <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
        <span className="text-sm text-gray-300">Volume do Alarme:</span>
        <div className="flex items-center space-x-2">
          <button
            onClick={onVolumeDown}
            className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            aria-label="Diminuir volume"
            disabled={alarmVolume <= 0}
          >
            <VolumeDownIcon className="w-5 h-5 shrink-0" />
          </button>
          <span className="text-sm font-medium w-10 text-center tabular-nums" aria-live="polite">{(alarmVolume * 100).toFixed(0)}%</span>
          <button
            onClick={onVolumeUp}
            className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            aria-label="Aumentar volume"
            disabled={alarmVolume >= 1}
          >
            <VolumeUpIcon className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onClearLogs}
          className="w-full flex items-center justify-center text-sm py-2.5 px-4 bg-gray-600 hover:bg-gray-500 text-gray-300 font-medium rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          <TrashIcon className="w-4 h-4 mr-2 shrink-0" />
          Limpar Logs
        </button>
        <button
          onClick={onDonate}
          className="w-full flex items-center justify-center text-sm py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          <DonateIcon className="w-5 h-5 mr-2 shrink-0" />
          Doar via PIX
        </button>
      </div>
    </div>
  );
};
