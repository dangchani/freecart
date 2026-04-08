import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TermsFieldProps {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  helpText: string | null;
  termsTitle: string;
  termsContent: string;
  value: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export function TermsField({
  fieldKey,
  label,
  isRequired,
  helpText,
  termsTitle,
  termsContent,
  value,
  onChange,
  error,
}: TermsFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={fieldKey}
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={fieldKey} className="text-sm text-gray-700 leading-snug">
          {isRequired && <span className="text-red-500 mr-1">*</span>}
          {label || helpText}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="ml-1.5 text-blue-600 underline hover:text-blue-800 text-sm"
          >
            내용 보기
          </button>
        </label>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-base font-semibold">{termsTitle}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: termsContent }}
            />
            <div className="border-t px-5 py-3 flex justify-end">
              <Button size="sm" onClick={() => setModalOpen(false)}>닫기</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
