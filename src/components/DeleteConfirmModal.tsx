import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { sound } from '../services/audio';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  captureNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  captureNumber,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
      <div className="w-full max-w-sm bg-white border border-[#E5E5E5] rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#171717]">
            Delete Photograph
          </h3>
          <button
            onClick={() => {
              sound.playKeyClick();
              onCancel();
            }}
            className="p-1 rounded-lg text-[#737373] hover:text-[#171717]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#525252] leading-relaxed">
          Are you sure you want to delete <strong className="text-[#171717]">Photo #{String(captureNumber).padStart(3, '0')}</strong>? Both the Color ASCII and original photograph will be removed.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => {
              sound.playKeyClick();
              onCancel();
            }}
            className="px-3.5 py-1.5 rounded-lg border border-[#E5E5E5] text-xs font-medium text-[#525252] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sound.playKeyClick();
              onConfirm();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
