
import React from 'react';
import { ShieldCheckIcon } from './Icons'; 

export const Header: React.FC = () => {
  return (
    <header className="mb-6 text-center">
      <div className="flex items-center justify-center mb-2">
        <ShieldCheckIcon className="w-12 h-12 text-indigo-400 mr-3 shrink-0" />
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
          Te Peguei!
        </h1>
      </div>
      <p className="text-gray-400 text-sm">
        Este aplicativo detecta movimentos no seu celular. Ao ser ativado, qualquer movimento dispara um alarme sonoro e registra a ocorrência com coordenadas GPS (se disponíveis).
      </p>
    </header>
  );
};
