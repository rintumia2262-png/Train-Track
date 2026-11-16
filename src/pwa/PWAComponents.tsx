import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from './usePWAInstall';

interface PWAProps {
  lang: 'bn' | 'en';
}

export const PWAInstallButton: React.FC<PWAProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{lang === 'bn' ? 'অ্যাপ ইন্সটল' : 'Install App'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/80 transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{lang === 'bn' ? 'PWA ইন্সটল' : 'Install PWA'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {lang === 'bn' ? 'ফোনে BD Train Track ইন্সটল করুন' : 'Install BD Train Track'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {isIOS
                ? lang === 'bn'
                  ? '১. Safari টুলবারে Share বাটনে ট্যাপ করুন।\n২. নিচে স্ক্রল করে "Add to Home Screen" বেছে নিন।'
                  : '1. Tap the Share button in Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".'
                : lang === 'bn'
                  ? 'ব্রাউজারের মেনু (⋮) থেকে "Install App" বা "Add to Home Screen" চাপলে অফলাইন শিডিউল সহ অ্যাপ হিসেবে ইন্সটল হবে।'
                  : 'Open your browser menu (⋮) and select "Install App" or "Add to Home screen" for standalone offline access.'}
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 cursor-pointer"
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<PWAProps> = ({ lang }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-950/95 px-3.5 py-1.5 text-xs font-medium text-amber-100 shadow-lg whitespace-nowrap">
      <WifiOff className="h-3.5 w-3.5 text-amber-300" />
      <span>
        {lang === 'bn'
          ? 'অফলাইন মোড — সংরক্ষিত শিডিউল ও রুট ম্যাপ চালু আছে'
          : 'Offline Mode — Cached schedules & track map active'}
      </span>
    </div>
  );
};
