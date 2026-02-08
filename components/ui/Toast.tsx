import React, { useEffect } from 'react';
import { LogEntry } from '../../types';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface ToastProps {
  logs: LogEntry[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ logs, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {logs.map(log => (
        <ToastItem key={log.id} log={log} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ log: LogEntry; onRemove: (id: string) => void }> = ({ log, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(log.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [log.id, onRemove]);

  const bgColors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const icons = {
    info: <Info className="w-5 h-5 text-white" />,
    success: <CheckCircle className="w-5 h-5 text-white" />,
    warning: <AlertTriangle className="w-5 h-5 text-white" />,
    error: <AlertOctagon className="w-5 h-5 text-white" />
  };

  return (
    <div className={`${bgColors[log.type]} shadow-lg rounded-lg p-4 flex items-center gap-3 w-80 pointer-events-auto transform transition-all duration-300 hover:scale-105 animate-in slide-in-from-right`}>
      {icons[log.type]}
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{log.message}</p>
        <p className="text-xs text-white/80">{log.time}</p>
      </div>
      <button onClick={() => onRemove(log.id)} className="text-white/70 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};