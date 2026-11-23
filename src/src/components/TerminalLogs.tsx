import React from 'react';
import { TERMINAL_MESSAGES } from '../config/messages';

interface TerminalLogsProps {
  messages?: string[];
  className?: string;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  messages = TERMINAL_MESSAGES,
  className = '',
}) => {
  return (
    <div
      className={`w-full max-w-4xl mx-auto rounded-lg bg-[#0A0A0A] border border-[#262626] p-4 text-xs font-mono text-[#D4D4D4] ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#262626]/80 text-[10px] text-[#737373] tracking-wider uppercase">
        <span>Terminal</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />
          <span>Active</span>
        </span>
      </div>

      <div className="space-y-1.5 leading-relaxed">
        {messages.map((msg, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-[#525252] select-none">&gt;</span>
            <span className="text-[#E5E5E5]">{msg}</span>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1 text-[#737373]">
          <span className="text-[#525252] select-none">&gt;</span>
          <span className="inline-block w-2 h-3.5 bg-[#E5E5E5] animate-blink" />
        </div>
      </div>
    </div>
  );
};
