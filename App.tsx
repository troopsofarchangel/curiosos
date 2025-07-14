import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { LogDisplay } from './components/LogDisplay';
import { DonateModal } from './components/DonateModal';
import type { LogEntry } from './types';
import { AlertTriangleIcon, StatusIndicator } from './components/Icons'; // Added StatusIndicator

const MOTION_THRESHOLD = 0.6; // For DeviceMotionEvent
const GYROSCOPE_THRESHOLD = 0.7; // Radians per second
const LIGHT_CHANGE_THRESHOLD_LUX = 50; // Lux difference
const PROXIMITY_FALLBACK_THRESHOLD_CM = 5;
const MAGNETOMETER_CHANGE_THRESHOLD_UT = 20; // Microteslas - for significant magnetic field change
const BAROMETER_CHANGE_THRESHOLD_PA = 20; // Pascals - for significant pressure change (approx 2m altitude change)


const ARMING_DELAY_MS = 3000;
const ALARM_SOUND_INTERVAL_MS = 1000;
const YOUR_PIX_KEY = "XXX@XXXX.com";

// Declare interfaces for sensor APIs if not globally available in TS
declare global {
  interface Window {
    Gyroscope?: any;
    AmbientLightSensor?: any;
    ProximitySensor?: any;
    Magnetometer?: any;
    Barometer?: any;
    DeviceProximityEvent?: any; 
  }
  class Gyroscope {
    constructor(options?: { frequency?: number });
    onreading: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onactivate: (() => void) | null;
    start: () => void;
    stop: () => void;
    x?: number | null;
    y?: number | null;
    z?: number | null;
  }
  class AmbientLightSensor {
    constructor(options?: { frequency?: number });
    onreading: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onactivate: (() => void) | null;
    start: () => void;
    stop: () => void;
    illuminance?: number | null;
  }
   class ProximitySensor {
    constructor(options?: { frequency?: number });
    onreading: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onactivate: (() => void) | null;
    start: () => void;
    stop: () => void;
    near?: boolean | null;
    distance?: number | null;
  }
  class Magnetometer {
    constructor(options?: { frequency?: number });
    onreading: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onactivate: (() => void) | null;
    start: () => void;
    stop: () => void;
    x?: number | null;
    y?: number | null;
    z?: number | null;
  }
  class Barometer {
    constructor(options?: { frequency?: number });
    onreading: (() => void) | null;
    onerror: ((event: any) => void) | null;
    onactivate: (() => void) | null;
    start: () => void;
    stop: () => void;
    pressure?: number | null;
  }
  interface DeviceProximityEvent extends Event {
    value: number; 
    min: number;   
    max: number;   
  }
}


const App: React.FC = () => {
  const [isServiceActive, setIsServiceActive] = useState<boolean>(false);
  const [isArming, setIsArming] = useState<boolean>(false);
  const [alarmVolume, setAlarmVolume] = useState<number>(0.9);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState<boolean>(false);
  const [supportedSensors, setSupportedSensors] = useState<string[]>([]);

  const lastAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const armingTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  
  const gyroscopeRef = useRef<Gyroscope | null>(null);
  const proximitySensorRef = useRef<ProximitySensor | null>(null);
  const lightSensorRef = useRef<AmbientLightSensor | null>(null);
  const lastIlluminanceRef = useRef<number | null>(null);
  const magnetometerRef = useRef<Magnetometer | null>(null);
  const lastMagnetometerReadingRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const barometerRef = useRef<Barometer | null>(null);
  const lastPressureRef = useRef<number | null>(null);


  const isAlarmPlayingRef = useRef(isAlarmPlaying);
  useEffect(() => {
    isAlarmPlayingRef.current = isAlarmPlaying;
  }, [isAlarmPlaying]);

  const isServiceActiveRef = useRef(isServiceActive);
  useEffect(() => {
    isServiceActiveRef.current = isServiceActive;
  }, [isServiceActive]);

  const isArmingRef = useRef(isArming);
  useEffect(() => {
    isArmingRef.current = isArming;
  }, [isArming]);

  const supportedSensorsRef = useRef(supportedSensors);
  useEffect(() => {
    supportedSensorsRef.current = supportedSensors;
  }, [supportedSensors]);

  const getCurrentStatus = (): { text: string; color: 'red' | 'yellow' | 'green' | 'gray'; icon: string } => {
    if (isAlarmPlaying) return { text: "ALARME!", color: "red", icon: "🔴" };
    if (isArming) return { text: "ARMANDO", color: "yellow", icon: "🟡" };
    if (isServiceActive) return { text: "ATIVO", color: "green", icon: "🟢" };
    return { text: "INATIVO", color: "gray", icon: "🔴" };
  };
  
  useEffect(() => {
    const status = getCurrentStatus();
    document.title = `${status.icon} ${status.text.toUpperCase()} - Te Peguei!`;
  }, [isServiceActive, isArming, isAlarmPlaying]);

  const appendErrorMessage = useCallback((newMessage: string) => {
    setErrorMessage(prev => {
      if (!prev) return newMessage;
      const existingMessages = prev.split('\n');
      // Avoid adding the exact same message multiple times in a row if it's the only message
      if (existingMessages.length === 1 && existingMessages[0] === newMessage) return prev;
      // Avoid adding if a very similar message (ignoring details like numbers) already exists
      const newMessageBase = newMessage.split(' (')[0].split(':')[0];
      if (existingMessages.some(msg => msg.includes(newMessageBase))) {
         // If a similar message exists, replace it if the new one is more specific, or just keep the old one
         // This is a simple check; more sophisticated logic might be needed for perfect deduplication
         if (newMessage.length > (existingMessages.find(msg => msg.includes(newMessageBase))?.length || 0)) {
            return existingMessages.filter(msg => !msg.includes(newMessageBase)).concat(newMessage).join('\n');
         }
         return prev;
      }
      return `${prev}\n${newMessage}`;
    });
  }, []);

  const addLogEntry = useCallback((message: string, coordinates?: GeolocationCoordinates) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString('pt-BR'),
      message: message,
      coordinates: coordinates ? {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy,
      } : undefined,
    };
    setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 49)]);
  }, []);
  
  const clearLogs = useCallback(() => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const id = Date.now().toString();
    setLogs([{
      id: id,
      timestamp: timestamp,
      message: "Logs limpos pelo usuário.",
      // coordinates will be undefined, which is the default
    }]);
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
      } catch (e) {
        console.error("Web Audio API is not supported.", e);
        appendErrorMessage("Seu navegador não suporta áudio, o alarme sonoro pode não funcionar.");
        return null;
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(err => {
        console.error("Error resuming AudioContext:", err);
        // appendErrorMessage("Não foi possível iniciar o áudio. Interaja com a página e tente novamente.");
      });
    }
    return audioContextRef.current;
  }, [appendErrorMessage]);

  const playSirenBurst = useCallback(() => {
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state !== 'running') {
      if(audioCtx && audioCtx.state === 'suspended'){
        // appendErrorMessage("Contexto de áudio suspenso. Clique para ativar.");
      }
      return;
    }

    if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
    }
    if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(alarmVolume, audioCtx.currentTime);

    const now = audioCtx.currentTime;
    oscillator.frequency.setValueAtTime(600, now); 
    oscillator.frequency.linearRampToValueAtTime(1200, now + 0.4); 
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.8);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.8); 
    
    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;

    oscillator.onended = () => {
        if (oscillatorRef.current === oscillator) { 
            oscillator.disconnect();
            gainNode.disconnect();
            oscillatorRef.current = null;
            gainNodeRef.current = null;
        }
    };
  }, [alarmVolume, getAudioContext]);

  const startAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'running') {
        playSirenBurst(); 
        alarmIntervalRef.current = setInterval(playSirenBurst, ALARM_SOUND_INTERVAL_MS) as unknown as number;
    } else if (audioCtx && audioCtx.state === 'suspended') {
        appendErrorMessage("Áudio suspenso. O alarme pode não tocar. Clique na tela e reative o serviço.");
    } else {
        appendErrorMessage("Não é possível reproduzir o alarme. Verifique as permissões de áudio.");
    }
  }, [playSirenBurst, getAudioContext, appendErrorMessage]);

  const stopAlarmSound = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // console.warn("Error stopping oscillator:", e);
      }
      if (oscillatorRef.current.context.state !== 'closed') { 
           oscillatorRef.current.disconnect();
      }
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      if (gainNodeRef.current.context.state !== 'closed') {
          gainNodeRef.current.disconnect();
      }
      gainNodeRef.current = null;
    }
  }, []);
  
  const triggerAlarm = useCallback((detectionSource: string) => {
    if (!isAlarmPlayingRef.current) { 
      setIsAlarmPlaying(true);
      startAlarmSound();
      setErrorMessage(`ALERTA! ${detectionSource}`); 

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            addLogEntry(detectionSource, position.coords);
          },
          (error) => {
            console.error("Error getting location: ", error);
            addLogEntry(`${detectionSource} (Localização indisponível)`);
            appendErrorMessage(`Localização: ${error.message}`);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        addLogEntry(`${detectionSource} (Geolocalização não suportada)`);
        appendErrorMessage(`Geolocalização não suportada`);
      }
    }
  }, [addLogEntry, startAlarmSound, setIsAlarmPlaying, setErrorMessage, appendErrorMessage]);
  
  const stopAlarm = useCallback(() => {
    setIsAlarmPlaying(false);
    stopAlarmSound();
    setErrorMessage("Alarme parado. Serviço DESATIVADO.");
    setIsServiceActive(false); 
    setIsArming(false);
    lastAccelRef.current = null;
    lastIlluminanceRef.current = null;
    lastMagnetometerReadingRef.current = null;
    lastPressureRef.current = null;
    if (armingTimeoutRef.current) clearTimeout(armingTimeoutRef.current);
  }, [stopAlarmSound, setIsAlarmPlaying, setIsServiceActive, setIsArming, setErrorMessage]);

  const handleSensorPermissionError = useCallback((sensorName: string, error: any) => {
    console.error(`${sensorName} error:`, error); // Log detailed error for developers
    let userMessage = `Erro no ${sensorName}: ${error.message || error.name || 'Erro desconhecido'}`;

    if (error.name === 'NotAllowedError') {
      userMessage = `Permissão para ${sensorName} negada. Verifique as configurações do seu navegador ou dispositivo. Pode ser necessário recarregar a página ou reativar o serviço após conceder permissão.`;
    } else if (error.name === 'NotReadableError') {
      userMessage = `${sensorName} não pôde ser lido. O sensor pode estar em uso por outro aplicativo, temporariamente indisponível ou apresentar defeito.`;
    } else if (error.name === 'SecurityError' || (error.message && error.message.toLowerCase().includes('secure context'))) {
      userMessage = `${sensorName} requer uma conexão segura (HTTPS). Verifique se o site está carregado via HTTPS.`;
    } else if (error.message && error.message.toLowerCase().includes('connect to a sensor')) {
      userMessage = `Não foi possível conectar ao ${sensorName}. O sensor pode não estar fisicamente presente, estar desabilitado nas configurações do sistema, ou não ser suportado neste dispositivo/navegador.`;
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        userMessage += ' Sensores como este geralmente também requerem uma conexão HTTPS para funcionar.';
      }
    } else if (!error.message && error.name) {
        userMessage = `Erro no ${sensorName}: ${error.name}. Verifique o console para mais detalhes.`;
    }
    
    appendErrorMessage(userMessage);
  }, [appendErrorMessage]);

  const toggleService = useCallback(() => {
    setErrorMessage(null); 
    setSupportedSensors([]); // Clear supported sensors on toggle, will repopulate on activation
    
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            // console.log("AudioContext resumed successfully by toggleService.");
        }).catch(err => console.error("Error resuming AudioContext in toggleService:", err));
    }

    if (isServiceActiveRef.current || isArmingRef.current) { 
      if (armingTimeoutRef.current) clearTimeout(armingTimeoutRef.current);
      setIsServiceActive(false);
      setIsArming(false);
      lastAccelRef.current = null;
      lastIlluminanceRef.current = null;
      lastMagnetometerReadingRef.current = null;
      lastPressureRef.current = null;
      if (isAlarmPlayingRef.current) { 
        stopAlarm();
      } else {
        setErrorMessage("Serviço DESATIVADO.");
      }
      addLogEntry("Serviço DESATIVADO pelo usuário.");
    } else { 
      setIsArming(true);
      setIsServiceActive(true); // Set active true, sensors will only start after arming
      setErrorMessage(`Serviço armando em ${ARMING_DELAY_MS / 1000}s... Sensores e GPS serão ativados.`);
      addLogEntry(`Serviço armando em ${ARMING_DELAY_MS / 1000} segundos...`);
      
      armingTimeoutRef.current = setTimeout(() => {
        if (!isServiceActiveRef.current || !isArmingRef.current) {
            return; // Service was deactivated during arming
        }
        setIsArming(false); 
        lastAccelRef.current = null; 
        lastIlluminanceRef.current = null;
        lastMagnetometerReadingRef.current = null;
        lastPressureRef.current = null;
        // The UI message below is generic. The detailed sensor list will be logged by the new useEffect.
        setErrorMessage(`Serviço ATIVO. Monitorando sensores. GPS pronto.`);
        // The specific "Serviço ATIVO. Monitoramento iniciado com sensores: ..." log entry is handled by the dedicated useEffect.
      }, ARMING_DELAY_MS) as unknown as number;
    }
  }, [stopAlarm, getAudioContext, setErrorMessage, setIsArming, setIsServiceActive, addLogEntry]);


  const addSupportedSensor = useCallback((name: string) => {
    setSupportedSensors(prev => {
        if (!prev.includes(name)) return [...prev, name];
        return prev;
    });
  }, []);

  const prevIsArmingRef = useRef<boolean | undefined>();
  const hasLoggedActivationRef = useRef(false);

  // Effect to log service activation status after arming completes
  useEffect(() => {
    const wasArming = prevIsArmingRef.current;
    prevIsArmingRef.current = isArming;

    if (isServiceActive) {
      if (wasArming === true && !isArming) { // Arming just completed
        if (!hasLoggedActivationRef.current) {
          // Schedule log after current event loop to allow other state updates (like supportedSensors) to settle
          const timerId = setTimeout(() => {
            const currentActiveSensorsList = supportedSensorsRef.current.length > 0
              ? supportedSensorsRef.current.join(', ')
              : 'sensores padrão (como Acelerômetro, se permitido e disponível)';
            const logMessage = `Serviço ATIVO. Monitoramento iniciado com sensores: ${currentActiveSensorsList}.`;
            addLogEntry(logMessage);
            hasLoggedActivationRef.current = true;
          }, 0); // Small delay to push to the end of the event queue

          return () => clearTimeout(timerId); // Cleanup timeout if dependencies change before it fires
        }
      }
    } else {
      // Service is not active, reset the flag for the next activation
      hasLoggedActivationRef.current = false;
    }
  }, [isServiceActive, isArming, addLogEntry]); // supportedSensors removed, using ref instead


  // Effect to manage 'devicemotion' event listener (Accelerometer)
  useEffect(() => {
    const motionHandlerInternal = (event: DeviceMotionEvent) => {
      if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current) return;
      const { accelerationIncludingGravity } = event;
      if (accelerationIncludingGravity && accelerationIncludingGravity.x !== null && accelerationIncludingGravity.y !== null && accelerationIncludingGravity.z !== null) {
        const { x, y, z } = accelerationIncludingGravity;
        if (lastAccelRef.current === null) {
          lastAccelRef.current = { x, y, z };
          return;
        }
        const deltaX = Math.abs(x - lastAccelRef.current.x);
        const deltaY = Math.abs(y - lastAccelRef.current.y);
        const deltaZ = Math.abs(z - lastAccelRef.current.z);
        const totalDelta = Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ);
        if (totalDelta > MOTION_THRESHOLD) triggerAlarm("Movimento (Acelerômetro) detectado!");
        lastAccelRef.current = {x, y, z};
      }
    };

    if (isServiceActive && !isArming) {
      if (typeof DeviceMotionEvent !== "undefined" && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission(undefined) // MODIFIED LINE
          .then((permissionState: string) => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', motionHandlerInternal);
              addLogEntry("Acelerômetro (iOS) ativado.");
              addSupportedSensor("Acelerômetro");
            } else {
              handleSensorPermissionError('Acelerômetro (iOS)', {name: 'NotAllowedError', message: 'Permissão para Acelerômetro (iOS) negada pelo usuário.'});
            }
          })
          .catch((error: any) => {
            handleSensorPermissionError('Acelerômetro (iOS)', error);
          });
      } else if (typeof DeviceMotionEvent !== "undefined") {
        window.addEventListener('devicemotion', motionHandlerInternal);
        addLogEntry("Acelerômetro ativado.");
        addSupportedSensor("Acelerômetro");
      } else {
        console.info("Acelerômetro (DeviceMotionEvent) não suportado.");
      }
    }
    return () => window.removeEventListener('devicemotion', motionHandlerInternal);
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);

  // Gyroscope
  useEffect(() => {
    if (isServiceActive && !isArming) {
      if ('Gyroscope' in window) {
        try {
          const sensor = new Gyroscope({ frequency: 10 });
          sensor.onreading = () => {
            if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current || !sensor.x || !sensor.y || !sensor.z) return;
            if (Math.abs(sensor.x) > GYROSCOPE_THRESHOLD || Math.abs(sensor.y) > GYROSCOPE_THRESHOLD || Math.abs(sensor.z) > GYROSCOPE_THRESHOLD) {
              triggerAlarm("Rotação (Giroscópio) detectada!");
            }
          };
          sensor.onerror = (event: any) => handleSensorPermissionError('Giroscópio', event.error);
          sensor.start();
          gyroscopeRef.current = sensor;
          addLogEntry("Giroscópio ativado.");
          addSupportedSensor("Giroscópio");
        } catch (error: any) {
           handleSensorPermissionError('Giroscópio', error);
        }
      } else console.info("Giroscópio (Generic Sensor API) não suportado.");
    }
    return () => { if (gyroscopeRef.current) gyroscopeRef.current.stop(); gyroscopeRef.current = null; };
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);

  // Proximity Sensor
  useEffect(() => {
    let proximityEventHandler: ((event: DeviceProximityEvent) => void) | null = null;
    if (isServiceActive && !isArming) {
      if ('ProximitySensor' in window) {
        try {
          const sensor = new ProximitySensor({ frequency: 2 });
          sensor.onreading = () => {
            if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current) return;
            if (sensor.near) triggerAlarm("Proximidade detectada!");
          };
          sensor.onerror = (event: any) => handleSensorPermissionError('Sensor de Proximidade', event.error);
          sensor.start();
          proximitySensorRef.current = sensor;
          addLogEntry("Sensor de Proximidade ativado.");
          addSupportedSensor("Proximidade");
        } catch (error: any) {
          handleSensorPermissionError('Sensor de Proximidade', error);
        }
      } else if ('ondeviceproximity' in window) {
        proximityEventHandler = (event: DeviceProximityEvent) => {
            if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current) return;
            if (event.value < PROXIMITY_FALLBACK_THRESHOLD_CM && event.value < event.max) triggerAlarm("Proximidade detectada (legado)!");
        };
        window.addEventListener('deviceproximity', proximityEventHandler);
        addLogEntry("Sensor de Proximidade (legado) ativado.");
        addSupportedSensor("Proximidade (legado)");
      } else console.info("Sensor de Proximidade não suportado.");
    }
    return () => {
      if (proximitySensorRef.current) proximitySensorRef.current.stop(); proximitySensorRef.current = null;
      if (proximityEventHandler) window.removeEventListener('deviceproximity', proximityEventHandler);
    };
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);

  // Ambient Light Sensor
  useEffect(() => {
    if (isServiceActive && !isArming) {
      if ('AmbientLightSensor' in window) {
        try {
          const sensor = new AmbientLightSensor({ frequency: 1 });
          sensor.onactivate = () => { if(sensor.illuminance !== null && sensor.illuminance !== undefined) lastIlluminanceRef.current = sensor.illuminance; };
          sensor.onreading = () => {
            if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current || sensor.illuminance === null || sensor.illuminance === undefined) return;
            const currentIlluminance = sensor.illuminance;
            if (lastIlluminanceRef.current !== null) {
              if (Math.abs(currentIlluminance - lastIlluminanceRef.current) > LIGHT_CHANGE_THRESHOLD_LUX) {
                triggerAlarm(`Mudança de Luz (${lastIlluminanceRef.current.toFixed(0)}lx -> ${currentIlluminance.toFixed(0)}lx)!`);
              }
            }
            lastIlluminanceRef.current = currentIlluminance;
          };
          sensor.onerror = (event: any) => { handleSensorPermissionError('Sensor de Luz', event.error); lastIlluminanceRef.current = null; };
          sensor.start();
          lightSensorRef.current = sensor;
          addLogEntry("Sensor de Luminosidade ativado.");
          addSupportedSensor("Luminosidade");
        } catch (error: any) {
          handleSensorPermissionError('Sensor de Luz', error);
          lastIlluminanceRef.current = null;
        }
      } else console.info("Sensor de Luminosidade não suportado.");
    }
    return () => { if (lightSensorRef.current) lightSensorRef.current.stop(); lightSensorRef.current = null; lastIlluminanceRef.current = null; };
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);

  // Magnetometer
  useEffect(() => {
    if (isServiceActive && !isArming) {
        if ('Magnetometer' in window) {
            try {
                const sensor = new Magnetometer({ frequency: 2 });
                sensor.onreading = () => {
                    if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current || sensor.x === null || sensor.y === null || sensor.z === null || sensor.x === undefined || sensor.y === undefined || sensor.z === undefined) return;
                    
                    const { x, y, z } = sensor;
                    if (lastMagnetometerReadingRef.current === null) {
                        lastMagnetometerReadingRef.current = { x, y, z };
                        return;
                    }
                    const deltaX = Math.abs(x - lastMagnetometerReadingRef.current.x);
                    const deltaY = Math.abs(y - lastMagnetometerReadingRef.current.y);
                    const deltaZ = Math.abs(z - lastMagnetometerReadingRef.current.z);

                    if (deltaX > MAGNETOMETER_CHANGE_THRESHOLD_UT || deltaY > MAGNETOMETER_CHANGE_THRESHOLD_UT || deltaZ > MAGNETOMETER_CHANGE_THRESHOLD_UT) {
                        triggerAlarm("Alteração no campo magnético detectada!");
                    }
                    lastMagnetometerReadingRef.current = { x, y, z };
                };
                sensor.onerror = (event: any) => handleSensorPermissionError('Magnetômetro', event.error);
                sensor.start();
                magnetometerRef.current = sensor;
                addLogEntry("Magnetômetro ativado.");
                addSupportedSensor("Magnetômetro");
            } catch (error: any) {
                handleSensorPermissionError('Magnetômetro', error);
            }
        } else console.info("Magnetômetro (Generic Sensor API) não suportado.");
    }
    return () => { if (magnetometerRef.current) magnetometerRef.current.stop(); magnetometerRef.current = null; lastMagnetometerReadingRef.current = null; };
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);

  // Barometer
  useEffect(() => {
    if (isServiceActive && !isArming) {
        if ('Barometer' in window) {
            try {
                const sensor = new Barometer({ frequency: 1 });
                sensor.onactivate = () => { if(sensor.pressure !== null && sensor.pressure !== undefined) lastPressureRef.current = sensor.pressure; };
                sensor.onreading = () => {
                    if (isArmingRef.current || isAlarmPlayingRef.current || !isServiceActiveRef.current || sensor.pressure === null || sensor.pressure === undefined) return;
                    
                    const currentPressure = sensor.pressure;
                    if (lastPressureRef.current !== null) {
                        if (Math.abs(currentPressure - lastPressureRef.current) > BAROMETER_CHANGE_THRESHOLD_PA) {
                            triggerAlarm(`Mudança de pressão atmosférica detectada (${lastPressureRef.current.toFixed(1)}Pa -> ${currentPressure.toFixed(1)}Pa)!`);
                        }
                    }
                    lastPressureRef.current = currentPressure;
                };
                sensor.onerror = (event: any) => { handleSensorPermissionError('Barômetro', event.error); lastPressureRef.current = null;};
                sensor.start();
                barometerRef.current = sensor;
                addLogEntry("Barômetro ativado.");
                addSupportedSensor("Barômetro");
            } catch (error: any) {
                handleSensorPermissionError('Barômetro', error);
                lastPressureRef.current = null;
            }
        } else console.info("Barômetro (Generic Sensor API) não suportado.");
    }
    return () => { if (barometerRef.current) barometerRef.current.stop(); barometerRef.current = null; lastPressureRef.current = null; };
  }, [isServiceActive, isArming, triggerAlarm, addLogEntry, handleSensorPermissionError, addSupportedSensor]);


  // Effect for component unmount cleanup
  useEffect(() => {
    return () => {
      if (armingTimeoutRef.current) clearTimeout(armingTimeoutRef.current);
      stopAlarmSound();
      if (gyroscopeRef.current) gyroscopeRef.current.stop();
      if (proximitySensorRef.current) proximitySensorRef.current.stop();
      if (lightSensorRef.current) lightSensorRef.current.stop();
      if (magnetometerRef.current) magnetometerRef.current.stop();
      if (barometerRef.current) barometerRef.current.stop();
    };
  }, [stopAlarmSound]);

  const adjustVolume = (delta: number) => {
    setAlarmVolume(prev => {
      const newVolume = Math.max(0, Math.min(1, prev + delta));
      if (gainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
        gainNodeRef.current.gain.setValueAtTime(newVolume, audioContextRef.current.currentTime);
      }
      return newVolume;
    });
  };

  const handleDonate = () => setIsDonateModalOpen(true);
  const currentStatus = getCurrentStatus();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 selection:bg-indigo-500 selection:text-white" onClick={() => getAudioContext()}>
      <div className="w-full max-w-md bg-gray-800 shadow-2xl rounded-lg p-6">
        <Header />

        <div className={`p-3 mb-4 rounded-md text-sm text-center font-semibold shadow-lg flex items-center justify-center
          ${currentStatus.color === 'red' ? 'bg-red-600 text-white' : 
            currentStatus.color === 'yellow' ? 'bg-yellow-500 text-yellow-900' :
            currentStatus.color === 'green' ? 'bg-green-500 text-white' :
            'bg-gray-700 text-gray-300'}`}
        >
          <StatusIndicator status={currentStatus.color} className="w-5 h-5 mr-2" />
          STATUS: {currentStatus.text.toUpperCase()}
        </div>

        {errorMessage && (
          <div className={`p-3 mb-4 rounded-md text-sm shadow-lg whitespace-pre-line ${isAlarmPlaying ? 'bg-red-600 text-white animate-pulse' : isArming ? 'bg-yellow-500 text-yellow-900' : 'bg-blue-600 text-blue-100'}`}>
            <div className="flex items-start">
              <AlertTriangleIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
        <Controls
          isServiceActive={isServiceActive}
          isArming={isArming}
          onToggleService={toggleService}
          alarmVolume={alarmVolume}
          onVolumeUp={() => adjustVolume(0.1)}
          onVolumeDown={() => adjustVolume(-0.1)}
          onDonate={handleDonate}
          isAlarmPlaying={isAlarmPlaying}
          onStopAlarm={stopAlarm}
          onClearLogs={clearLogs}
        />
        <LogDisplay logs={logs} />
      </div>
      <footer className="text-center mt-8 text-gray-500 text-xs px-4 max-w-md mx-auto">
        <p>&copy; {new Date().getFullYear()} Te Peguei! App. Movimente com cuidado.</p>
        <p className="mt-1">Nota: A precisão dos sensores e GPS pode variar. Para melhor funcionamento, conceda as permissões solicitadas e use em um local com boa recepção de sinal e conexão HTTPS.</p>
        <p className="mt-1">Use os sensores com responsabilidade. Biométricos não são usados para alarme.</p>
      </footer>
      <DonateModal
        isOpen={isDonateModalOpen}
        onClose={() => setIsDonateModalOpen(false)}
        pixKey={YOUR_PIX_KEY}
      />
    </div>
  );
};

export default App;
