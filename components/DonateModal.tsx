
import React from 'react';
import { CloseIcon, DonateIcon } from './Icons';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixKey: string;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose, pixKey }) => {
  if (!isOpen) return null;

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(pixKey)
      .then(() => alert('Chave PIX copiada para a área de transferência!'))
      .catch(err => alert('Erro ao copiar a chave PIX: ' + err));
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md relative text-gray-200 transform transition-all duration-300 ease-in-out scale-100"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Fechar modal de doação"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
        
        <div className="flex items-center mb-4">
          <DonateIcon className="w-8 h-8 text-indigo-400 mr-3 shrink-0" />
          <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            Apoie o Desenvolvedor
          </h2>
        </div>

        <p className="text-gray-300 mb-3 text-sm">
          Se o "Te Peguei!" foi útil para você, considere fazer uma doação para apoiar o desenvolvimento e manutenção deste projeto.
        </p>
        <p className="text-gray-300 mb-1 text-sm">Você pode doar via PIX utilizando a chave abaixo:</p>
        
        <div className="bg-gray-700 p-3 rounded-md mb-4">
          <p className="text-center text-indigo-300 font-mono break-all text-sm md:text-base" id="pix-key-display">{pixKey}</p>
        </div>

        <button
          onClick={handleCopyPixKey}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 mb-3 text-sm"
        >
          Copiar Chave PIX
        </button>
        
        <p className="text-xs text-gray-500 text-center mt-1">
          Qualquer valor é bem-vindo. Obrigado pelo seu apoio!
        </p>
      </div>
    </div>
  );
};
