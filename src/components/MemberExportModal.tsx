import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, X, CheckSquare, Square, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface MemberExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
}

export const EXPORT_FIELD_OPTIONS = [
  { key: 'name', label: '姓名或暱稱', defaultSelected: true },
  { key: 'amwayId', label: '安麗編號', defaultSelected: true },
  { key: 'phone', label: '手機號碼', defaultSelected: true },
  { key: 'residence', label: '居住地', defaultSelected: true },
  { key: 'center', label: '繁星中心', defaultSelected: true },
  { key: 'rank', label: '最高獎銜', defaultSelected: true },
  { key: 'joinReason', label: '初次如何認識安麗？', defaultSelected: true },
  { key: 'stayReason', label: '什麼原因留在安麗？', defaultSelected: true },
  { key: 'sponsor', label: '推薦人', defaultSelected: true },
  { key: 'platinumUpline', label: '上手白金', defaultSelected: true },
  { key: 'diamondUpline', label: '上手鑽石', defaultSelected: true },
  { key: 'birthday', label: '西元生日', defaultSelected: true },
  { key: 'zodiac', label: '星座', defaultSelected: true },
  { key: 'lifeNumber', label: '生命靈數命數', defaultSelected: true },
  { key: 'email', label: '電子信箱', defaultSelected: false },
  { key: 'playCount', label: '播放次數', defaultSelected: false }
] as const;

export const MemberExportModal: React.FC<MemberExportModalProps> = ({
  isOpen,
  onClose,
  users
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    EXPORT_FIELD_OPTIONS.filter(f => f.defaultSelected).map(f => f.key)
  );
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  if (!isOpen) return null;

  const handleToggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === EXPORT_FIELD_OPTIONS.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(EXPORT_FIELD_OPTIONS.map(f => f.key));
    }
  };

  // Export CSV (Excel compatible) or HTML/Print PDF
  const handlePerformExport = () => {
    if (selectedFields.length === 0) {
      alert('請至少勾選一個匯出欄位項目！');
      return;
    }

    const fieldLabels = selectedFields.map(
      key => EXPORT_FIELD_OPTIONS.find(f => f.key === key)?.label || key
    );

    if (exportFormat === 'excel') {
      // Create CSV with UTF-8 BOM for Microsoft Excel compatibility
      const headerRow = fieldLabels.join(',');
      const rows = users.map(u => {
        return selectedFields
          .map(k => {
            const val = (u as any)[k] ?? '';
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',');
      });

      const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `繁星回聲_學員名冊名單_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } else {
      // PDF Printable Window / Save as PDF
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        return;
      }

      const tableHeaders = fieldLabels.map(l => `<th style="border: 1px solid #ddd; padding: 6px 8px; background: #f8fafc; font-size: 11px; text-align: left;">${l}</th>`).join('');
      const tableRows = users.map((u, i) => {
        const cells = selectedFields.map(k => {
          const val = (u as any)[k] ?? '-';
          return `<td style="border: 1px solid #ddd; padding: 6px 8px; font-size: 11px;">${val}</td>`;
        }).join('');
        return `<tr style="background: ${i % 2 === 0 ? '#fff' : '#fcfcfc'};">${cells}</tr>`;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>繁星回聲 - 學員名冊清單</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif; padding: 20px; color: #1e293b; }
              h2 { margin: 0 0 4px; font-size: 20px; }
              p { margin: 0 0 16px; color: #64748b; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              @media print {
                @page { size: landscape; margin: 15mm; }
              }
            </style>
          </head>
          <body>
            <h2>繁星回聲 (ECHO) 團隊學員名冊總表</h2>
            <p>匯出日期：${new Date().toLocaleDateString('zh-TW')} • 成員總數：${users.length} 位</p>
            <table>
              <thead><tr>${tableHeaders}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="app-modal-overlay fixed inset-0 z-[70] flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[var(--theme-border-subtle,#f1e7ea)] dark:border-slate-800 flex flex-col max-h-[85vh] cursor-default text-xs"
      >
        {/* Header - Requirement 15: 統一底色與麥克風相同色 */}
        <div
          className="p-4 sm:p-5 flex items-center justify-between text-white"
          style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                匯出會員名單資料
              </h3>
              <p className="text-[11px] text-white/80">
                可自訂勾選要匯出的欄位項目，支援 Excel (CSV) 或 PDF 格式
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              選擇匯出檔案格式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('excel')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all font-semibold ${
                  exportFormat === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 shadow-2xs font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <p className="text-xs">Excel / CSV 檔</p>
                  <p className="text-[10px] text-slate-400">標準試算表，支援 UTF-8</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all font-semibold ${
                  exportFormat === 'pdf'
                    ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 shadow-2xs font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <div className="text-left">
                  <p className="text-xs">PDF 列印檔</p>
                  <p className="text-[10px] text-slate-400">精美排版，隨時列印或儲存</p>
                </div>
              </button>
            </div>
          </div>

          {/* Fields Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                指定匯出欄位項目 (已選 {selectedFields.length} 項)
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                {selectedFields.length === EXPORT_FIELD_OPTIONS.length ? '取消全選' : '勾選全部'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
              {EXPORT_FIELD_OPTIONS.map(field => {
                const isChecked = selectedFields.includes(field.key);
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => handleToggleField(field.key)}
                    className="flex items-center gap-1.5 text-left p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`text-xs ${isChecked ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                      {field.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            匯出共 {users.length} 位夥伴名冊
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
            >
              取消
            </button>
            <button
              onClick={handlePerformExport}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>確認匯出檔案</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
