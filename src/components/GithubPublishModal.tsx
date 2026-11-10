import React, { useState } from 'react';
import { X, Github, Download, Check, Copy, Terminal, Smartphone, Sparkles, ArrowRight } from 'lucide-react';

interface GithubPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GithubPublishModal: React.FC<GithubPublishModalProps> = ({
  isOpen,
  onClose
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const cleanRepoUrl = repoUrl.trim() || 'https://github.com/<username>/Filter-stock-vnindex-.git';

  const commandStep1 = `git remote add origin ${cleanRepoUrl} 2>/dev/null || git remote set-url origin ${cleanRepoUrl}\ngit push -u origin main --force`;
  const commandStep2 = `git tag -fa v1.0.1 -m "Bản cập nhật v1.0.1 sửa lỗi build APK"\ngit push origin v1.0.1 --force`;
  const oneLineCommand = `./publish_to_github.sh ${cleanRepoUrl} v1.0.1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0e131d] border border-[#232f42] rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1b2332] bg-[#0b0f17] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Xuất bản GitHub & Tự động Build APK
              </h3>
              <p className="text-[11px] text-slate-400">
                Toàn bộ mã nguồn, cấu hình Android Capacitor và CI/CD GitHub Actions đã sẵn sàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2232]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Highlight feature card */}
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-purple-200">
                Quy trình tự động hóa đã được thiết lập sẵn:
              </p>
              <p className="text-[11px] text-purple-300/80 leading-relaxed">
                Mỗi khi bạn tạo một <strong>Version Release</strong> hoặc đẩy <strong>Tag phiên bản</strong> (ví dụ: <code className="font-mono bg-purple-950 px-1 py-0.2 rounded text-purple-200">v1.0.0</code>), hệ thống <strong>GitHub Actions</strong> trong tệp <code className="font-mono text-purple-200">.github/workflows/build-apk.yml</code> sẽ tự động biên dịch ứng dụng thành file <strong>.APK Android</strong> và đính kèm vào trang Release để bạn tải về cài đặt ngay trên điện thoại!
              </p>
            </div>
          </div>

          {/* Input Repo URL */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block">
              1. Nhập URL kho lưu trữ GitHub của bạn:
            </label>
            <input
              type="text"
              placeholder="https://github.com/your-username/vnstock-screener.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full bg-[#141b27] border border-[#232f42] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 font-mono text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Quick Push Steps */}
          <div className="space-y-3">
            <label className="font-semibold text-slate-200 block">
              2. Các bước xuất bản & kích hoạt Build APK tự động:
            </label>

            {/* Step A */}
            <div className="p-3 rounded-xl bg-[#121824] border border-[#1e2738] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">
                  Cách 1: Chạy 1 lệnh duy nhất bằng Script tự động
                </span>
                <button
                  onClick={() => copyText(oneLineCommand, 0)}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300"
                >
                  {copiedStep === 0 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedStep === 0 ? 'Đã copy' : 'Copy'}
                </button>
              </div>
              <pre className="p-2 rounded-lg bg-[#080b11] border border-slate-800 font-mono text-[11px] text-purple-300 overflow-x-auto">
                <code>{oneLineCommand}</code>
              </pre>
            </div>

            {/* Step B */}
            <div className="p-3 rounded-xl bg-[#121824] border border-[#1e2738] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">
                  Cách 2: Thực hiện thủ công qua Git Terminal
                </span>
                <button
                  onClick={() => copyText(`${commandStep1}\n${commandStep2}`, 1)}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300"
                >
                  {copiedStep === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedStep === 1 ? 'Đã copy' : 'Copy'}
                </button>
              </div>
              <pre className="p-2 rounded-lg bg-[#080b11] border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1">
                <code># Bước A: Đẩy mã nguồn lên nhánh main{'\n'}{commandStep1}{'\n\n'}# Bước B: Tạo Release Tag kích hoạt build APK{'\n'}{commandStep2}</code>
              </pre>
            </div>
          </div>

          {/* Workflow details */}
          <div className="p-3.5 rounded-xl bg-[#121824] border border-[#1e2738] space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              Tệp CI/CD đã cấu hình sẵn trong repository
            </h4>
            <div className="space-y-1 text-[11px] text-slate-400">
              <p>• <strong className="text-slate-200">.github/workflows/build-apk.yml</strong>: Tự động tải JDK 17, Android SDK, build web bundle, đồng bộ Capacitor và biên dịch <code className="text-purple-300">app-debug.apk</code> & <code className="text-purple-300">app-release.apk</code>.</p>
              <p>• <strong className="text-slate-200">capacitor.config.ts</strong>: Khởi tạo Android project cho gói ứng dụng <code className="text-purple-300">vn.fialda.quant.screener</code>.</p>
              <p>• <strong className="text-slate-200">Tải APK</strong>: Sau khi push tag, vào tab <strong>Releases</strong> hoặc <strong>Actions</strong> trên GitHub của bạn để tải file APK về cài đặt.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1b2332] bg-[#0b0f17] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-900/30 transition-colors"
          >
            Đã hiểu, đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
