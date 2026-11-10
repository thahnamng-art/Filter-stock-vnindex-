import React, { useState } from 'react';
import { X, Bookmark, Save, Trash2, Download, Upload, Check } from 'lucide-react';
import { ScreenerPreset, AnyFilterRule } from '../types/screener';

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRules: AnyFilterRule[];
  presets: ScreenerPreset[];
  activePresetId: string | null;
  onApplyPreset: (preset: ScreenerPreset) => void;
  onSavePreset: (name: string, description: string) => void;
  onDeletePreset: (id: string) => void;
  onImportJson: (rules: AnyFilterRule[]) => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  isOpen,
  onClose,
  currentRules,
  presets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onImportJson
}) => {
  const [tab, setTab] = useState<'LOAD' | 'SAVE' | 'JSON'>('LOAD');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSavePreset(newPresetName.trim(), newPresetDesc.trim() || 'Bộ lọc tùy chỉnh');
    setNewPresetName('');
    setNewPresetDesc('');
    setTab('LOAD');
  };

  const handleExportJson = () => {
    const exported = JSON.stringify(currentRules, null, 2);
    setJsonText(exported);
    navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        onImportJson(parsed);
        onClose();
      } else {
        alert('JSON không hợp lệ: Phải là mảng danh sách các quy tắc lọc.');
      }
    } catch (err: any) {
      alert('Lỗi định dạng JSON: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#111723] border border-[#232d3f] rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2738]">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-100">Quản lý Bộ lọc (Presets)</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex border-b border-[#1e2738] bg-[#0c1018] px-4 pt-2">
          <button
            onClick={() => setTab('LOAD')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'LOAD' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Tải bộ lọc mẫu ({presets.length})
          </button>
          <button
            onClick={() => setTab('SAVE')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'SAVE' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Lưu bộ lọc hiện tại
          </button>
          <button
            onClick={() => {
              setTab('JSON');
              setJsonText(JSON.stringify(currentRules, null, 2));
            }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'JSON' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON Import/Export
          </button>
        </div>

        {/* Tab 1: LOAD PRESETS */}
        {tab === 'LOAD' && (
          <div className="p-4 overflow-y-auto space-y-2.5">
            {presets.map((p) => {
              const isActive = p.id === activePresetId;
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isActive
                      ? 'bg-purple-950/20 border-purple-500/70 shadow-sm'
                      : 'bg-[#151c29] border-[#222e40] hover:border-slate-600'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">{p.name}</h4>
                      {p.isCustom ? (
                        <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.2 rounded">
                          Tự tạo
                        </span>
                      ) : (
                        <span className="text-[10px] text-purple-300 bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.2 rounded">
                          Fialda Mẫu
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {p.description}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1.5 font-mono-numbers">
                      {p.rules.length} tiêu chí lọc
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPreset(p);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1d2638] text-purple-300 hover:bg-purple-600 hover:text-white'
                      }`}
                    >
                      {isActive ? 'Đang dùng' : 'Áp dụng'}
                    </button>
                    {p.isCustom && (
                      <button
                        type="button"
                        onClick={() => onDeletePreset(p.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-[#1f283d]"
                        title="Xóa bộ lọc tùy chỉnh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: SAVE CURRENT PRESET */}
        {tab === 'SAVE' && (
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">
                Tên bộ lọc
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Lọc Pocket Pivot & Banker tăng mạnh"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                required
                className="w-full bg-[#172030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-200 block mb-1">
                Mô tả chiến lược (tùy chọn)
              </label>
              <textarea
                placeholder="Ghi chú về mục đích, chiến lược trading của bộ lọc..."
                rows={3}
                value={newPresetDesc}
                onChange={(e) => setNewPresetDesc(e.target.value)}
                className="w-full bg-[#172030] border border-[#252f42] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#141b27] border border-[#1f2a3c]">
              <p className="text-[11px] text-slate-400">
                Bộ lọc này sẽ lưu trạng thái hiện tại gồm <strong>{currentRules.length} tiêu chí</strong> (bao gồm cả các thông số tùy biến chu kỳ, min/max, và trạng thái bật/tắt).
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
            >
              <Save className="w-4 h-4" />
              Lưu vào Bộ lọc của tôi
            </button>
          </form>
        )}

        {/* Tab 3: JSON RAW IMPORT / EXPORT */}
        {tab === 'JSON' && (
          <div className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cấu hình JSON bộ lọc:</span>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép!' : 'Copy JSON'}
              </button>
            </div>

            <textarea
              rows={8}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full bg-[#0a0e16] border border-[#222e40] rounded-lg p-2.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-purple-500"
            />

            <button
              type="button"
              onClick={handleImportJson}
              className="w-full py-2 rounded-xl bg-[#1e2738] hover:bg-purple-600 text-slate-200 hover:text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Tải cấu hình từ JSON trên
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
