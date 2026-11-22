import { useRef, useState } from 'react';
import { Download, FileJson, Upload, X } from 'lucide-react';
import type { ScheduleApiResponse, StorageMode } from '../types/schedule';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleState: ScheduleApiResponse;
  onImportData: (rawJson: unknown) => Promise<void>;
}

function storageModeLabel(mode: StorageMode): { title: string; detail: string } {
  if (mode === 'vercel-json') {
    return {
      title: 'File JSON đi kèm bản deploy Vercel (data/schedule.json)',
      detail:
        'Dữ liệu khởi tạo từ file data/schedule.json đóng gói cùng Vercel, ghi cập nhật trực tiếp tại phiên Serverless và đồng bộ dự phòng qua localStorage.',
    };
  }
  return {
    title: 'File JSON nội bộ (data/schedule.json)',
    detail:
      'Mọi thay đổi trạng thái và nhật ký được ghi trực tiếp vào file data/schedule.json trong dự án để sẵn sàng commit/deploy cùng Vercel.',
  };
}

export function StorageModal({
  isOpen,
  onClose,
  scheduleState,
  onImportData,
}: StorageModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const modeInfo = storageModeLabel(scheduleState.storageMode);

  const handleDownloadJson = () => {
    const payload = {
      version: scheduleState.version,
      updatedAt: scheduleState.updatedAt,
      slots: scheduleState.slots,
      logs: scheduleState.logs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schedule.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onImportData(parsed);
      setImportFeedback('Đã nạp dữ liệu từ file JSON thành công.');
    } catch (err) {
      setImportFeedback(
        err instanceof Error
          ? `Không thể đọc file: ${err.message}`
          : 'File JSON không đúng định dạng.',
      );
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 id="storage-modal-title" className="text-base font-bold text-slate-900">
              Lưu trữ file JSON &amp; Sao lưu
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-500">Chế độ lưu trữ</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{modeInfo.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{modeInfo.detail}</p>
          </div>

          <div className="text-xs leading-relaxed text-slate-600 space-y-1.5">
            <p>
              File gốc được đặt tại <code className="font-mono-tabular text-slate-800">data/schedule.json</code> và đóng gói cùng các Serverless Function khi deploy lên Vercel (không kết nối bên thứ 3).
            </p>
            <p>
              Bạn có thể tải file <code className="font-mono-tabular text-slate-800">schedule.json</code> hiện tại về máy để lưu trữ hoặc nạp lại bất cứ lúc nào.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tải schedule.json</span>
            </button>

            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isImporting ? 'Đang nạp...' : 'Nạp file .json'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {importFeedback && (
            <p className="text-xs font-medium text-blue-700">{importFeedback}</p>
          )}
        </div>
      </div>
    </div>
  );
}
