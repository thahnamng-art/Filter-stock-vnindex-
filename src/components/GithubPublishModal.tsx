import React, { useState, useEffect } from 'react';
import {
  X,
  Github,
  Download,
  Check,
  Copy,
  Smartphone,
  ExternalLink,
  FolderGit2,
  Globe,
  ShieldCheck,
  Package,
  RefreshCw,
  FileArchive
} from 'lucide-react';

interface GithubPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PUBLIC_REPO_OWNER = 'thahnamng-art';
const PUBLIC_REPO_NAME = 'Filter-stock-vnindex-';
const PUBLIC_REPO_URL = `https://github.com/${PUBLIC_REPO_OWNER}/${PUBLIC_REPO_NAME}`;
const PUBLIC_RELEASES_URL = `${PUBLIC_REPO_URL}/releases`;
const PUBLIC_LATEST_APK_URL = `${PUBLIC_REPO_URL}/releases/latest/download/fialda-quant-screener-debug.apk`;
const PUBLIC_SOURCE_ZIP_URL = `${PUBLIC_REPO_URL}/archive/refs/heads/main.zip`;
const PUBLIC_PAGES_URL = `https://${PUBLIC_REPO_OWNER}.github.io/${PUBLIC_REPO_NAME}/`;

interface LatestReleaseInfo {
  tagName: string;
  title: string;
  publishedAt: string;
  apkDownloadUrl: string;
  apkFileName: string;
  apkSizeMb: string;
  releaseHtmlUrl: string;
}

export const GithubPublishModal: React.FC<GithubPublishModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState<boolean>(false);
  const [releaseInfo, setReleaseInfo] = useState<LatestReleaseInfo>({
    tagName: 'v1.0.12',
    title: 'Fialda Quant Screener APK (Hỗ trợ Update trực tiếp)',
    publishedAt: 'Mới nhất trên GitHub Releases',
    apkDownloadUrl: PUBLIC_LATEST_APK_URL,
    apkFileName: 'fialda-quant-screener-debug.apk',
    apkSizeMb: '4.65 MB',
    releaseHtmlUrl: PUBLIC_RELEASES_URL
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingRelease(true);

    fetch(`https://api.github.com/repos/${PUBLIC_REPO_OWNER}/${PUBLIC_REPO_NAME}/releases/latest`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const apkAsset = Array.isArray(data.assets)
          ? data.assets.find((a: any) => String(a.name || '').endsWith('.apk')) || data.assets[0]
          : null;

        const sizeBytes = Number(apkAsset?.size || 0);
        const sizeMb =
          sizeBytes > 0 ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '4.65 MB';

        let publishedFormatted = 'Mới nhất trên GitHub Releases';
        if (data.published_at) {
          try {
            publishedFormatted = new Date(data.published_at).toLocaleString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          } catch {
            publishedFormatted = data.published_at;
          }
        }

        setReleaseInfo({
          tagName: data.tag_name || 'Mới nhất',
          title: data.name || `Fialda Quant Screener APK ${data.tag_name || ''}`,
          publishedAt: publishedFormatted,
          apkDownloadUrl: apkAsset?.browser_download_url || PUBLIC_LATEST_APK_URL,
          apkFileName: apkAsset?.name || 'fialda-quant-screener-debug.apk',
          apkSizeMb: sizeMb,
          releaseHtmlUrl: data.html_url || PUBLIC_RELEASES_URL
        });
      })
      .catch(() => {
        // Fallback to static latest URL if rate-limited
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRelease(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
                Kho Lưu Trữ GitHub Công Khai &amp; Tải Ứng Dụng Android (.APK)
              </h3>
              <p className="text-[11px] text-slate-400">
                Truy cập trực tiếp mã nguồn mở hoặc tải file cài đặt APK bản mới nhất cho điện thoại Android
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
          {/* 1. Primary Card: Direct Android APK Download */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/45 via-[#101929] to-purple-950/35 border border-emerald-500/40 space-y-3.5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">
                      Tải File Cài Đặt Android (.APK)
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[10px]">
                      {releaseInfo.tagName}
                    </span>
                    {isLoadingRelease && (
                      <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {releaseInfo.apkFileName} · Dung lượng:{' '}
                    <strong className="text-emerald-300">{releaseInfo.apkSizeMb}</strong> · Cập nhật:{' '}
                    <span className="text-slate-200">{releaseInfo.publishedAt}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={releaseInfo.apkDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[210px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Tải Ngay APK Bản Mới Nhất ({releaseInfo.tagName})</span>
              </a>

              <a
                href={releaseInfo.releaseHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-[#162032] hover:bg-[#1e2b42] border border-[#2a3954] text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-purple-400" />
                <span>Xem trang Releases</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <button
                type="button"
                onClick={() => copyText(releaseInfo.apkDownloadUrl, 'apk')}
                className="px-3 py-2.5 rounded-xl bg-[#141c2b] hover:bg-[#1b2538] border border-[#263349] text-slate-300 hover:text-white font-medium text-[11px] flex items-center gap-1.5 transition-colors"
                title="Copy đường dẫn tải trực tiếp file APK"
              >
                {copiedKey === 'apk' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Đã copy link APK</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy link APK</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Bản APK được ký bằng <strong>Keystore cố định</strong> — điện thoại Android cho phép{' '}
                <strong>cài đè / cập nhật trực tiếp</strong> lên bản cũ mà không cần gỡ cài đặt.
              </span>
            </div>
          </div>

          {/* 2. Public GitHub Repository Card */}
          <div className="p-4 rounded-2xl bg-[#121824] border border-[#222d42] space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">
                      Repository Công Khai: {PUBLIC_REPO_OWNER}/{PUBLIC_REPO_NAME}
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-semibold">
                      Public Repo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono break-all">
                    {PUBLIC_REPO_URL}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct clickable links to Repo, Source ZIP, and Web Pages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <a
                href={PUBLIC_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>Mở GitHub Repo</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>

              <a
                href={PUBLIC_SOURCE_ZIP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-[#182132] hover:bg-[#202c42] border border-[#2b3954] text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>Tải Mã Nguồn (.ZIP)</span>
              </a>

              <a
                href={PUBLIC_PAGES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-[#182132] hover:bg-[#202c42] border border-[#2b3954] text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bản Web GitHub Pages</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>

            {/* Copy Repo URL & Git Clone */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Lệnh sao chép nhanh kho mã nguồn (Git Clone):</span>
                <button
                  type="button"
                  onClick={() => copyText(`git clone ${PUBLIC_REPO_URL}.git`, 'clone')}
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium"
                >
                  {copiedKey === 'clone' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Đã copy lệnh</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy lệnh</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 rounded-xl bg-[#090d14] border border-[#1d2638] font-mono text-[11px] text-purple-300 overflow-x-auto select-all">
                <code>git clone {PUBLIC_REPO_URL}.git</code>
              </pre>
            </div>
          </div>

          {/* 3. Quick Summary of Included Modules */}
          <div className="p-3.5 rounded-xl bg-[#101622] border border-[#1c2536] space-y-1.5 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-200">
              Thông tin các thành phần có sẵn trong Repository:
            </div>
            <p>
              • <strong className="text-slate-200">Bộ lọc &amp; Biểu đồ 7 tầng Fialda:</strong> Quét 1.626 mã cổ phiếu (HOSE, HNX, UPCoM), lưu cache IndexedDB, tự động mở rộng lịch sử nhiều năm và hiển thị tín hiệu Mua/Bán MCDX độc lập.
            </p>
            <p>
              • <strong className="text-slate-200">GitHub Releases (Tải APK):</strong> Mỗi bản cập nhật đẩy lên nhánh <code className="text-purple-300">main</code> đều được GitHub Actions tự động đóng gói thành file <code className="text-emerald-300">fialda-quant-screener-debug.apk</code> tại mục Releases.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1b2332] bg-[#0b0f17] flex items-center justify-between gap-3">
          <a
            href={PUBLIC_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5"
          >
            <Github className="w-3.5 h-3.5" />
            <span>github.com/{PUBLIC_REPO_OWNER}/{PUBLIC_REPO_NAME}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-900/30 transition-colors"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
