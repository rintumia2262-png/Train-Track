import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BellRing, CheckCircle2, Send, ShieldAlert, X } from 'lucide-react';
import { STATIONS, TRAINS, TrainDefinition } from '../data/railwayNetwork';
import { PushNotificationState, PushSubscribeOptions } from '../pwa/usePushNotifications';
import { toBnDigits } from '../utils/trackMath';

interface PushAlertModalProps {
  open: boolean;
  onClose: () => void;
  selectedTrain: TrainDefinition;
  defaultStationId: string;
  lang: 'bn' | 'en';
  pushState: PushNotificationState;
  initialPref?: {
    trainId: string;
    stationId: string;
    enabled: boolean;
    alertOnArrival: boolean;
    alertOnDelay: boolean;
  } | null;
  onEnablePush: (opts: PushSubscribeOptions) => Promise<void>;
  onDisablePush: (trainId: string, stationId: string) => Promise<void>;
  onSendTestPush: (opts: { trainId: string; stationId: string; lang: 'bn' | 'en' }) => Promise<void>;
}

export const PushAlertModal: React.FC<PushAlertModalProps> = ({
  open,
  onClose,
  selectedTrain,
  defaultStationId,
  lang,
  pushState,
  initialPref,
  onEnablePush,
  onDisablePush,
  onSendTestPush,
}) => {
  const [trainId, setTrainId] = useState(initialPref?.trainId || selectedTrain.id);
  const [stationId, setStationId] = useState(initialPref?.stationId || defaultStationId);
  const [alertOnArrival, setAlertOnArrival] = useState(initialPref?.alertOnArrival ?? true);
  const [alertOnDelay, setAlertOnDelay] = useState(initialPref?.alertOnDelay ?? true);

  useEffect(() => {
    if (!open) return;
    if (initialPref) {
      setTrainId(initialPref.trainId);
      setStationId(initialPref.stationId);
      setAlertOnArrival(initialPref.alertOnArrival);
      setAlertOnDelay(initialPref.alertOnDelay);
    } else {
      setTrainId(selectedTrain.id);
      setStationId(defaultStationId);
    }
  }, [open, initialPref, selectedTrain.id, defaultStationId]);

  const activeTrain = useMemo(
    () => TRAINS.find((t) => t.id === trainId) ?? selectedTrain,
    [trainId, selectedTrain]
  );

  useEffect(() => {
    if (!activeTrain.stops.some((s) => s.stationId === stationId)) {
      const nextStop = activeTrain.stops[Math.min(1, activeTrain.stops.length - 1)];
      if (nextStop) setStationId(nextStop.stationId);
    }
  }, [activeTrain, stationId]);

  if (!open) return null;

  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                pushState.isSubscribed
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {pushState.isSubscribed ? (
                <BellRing className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">
                {lang === 'bn' ? 'স্টেশন পুশ নোটিফিকেশন' : 'Station Push Alerts'}
              </h3>
              <p className="text-xs text-slate-500">
                {pushState.isSubscribed
                  ? lang === 'bn'
                    ? 'সার্ভিস চালু আছে — রিয়েল-টাইম অ্যালার্ট সক্রিয়'
                    : 'Active — real-time Web Push alerts enabled'
                  : lang === 'bn'
                    ? 'ট্রেন স্টেশনের কাছাকাছি এলে অ্যালার্ট পান'
                    : 'Get alerted when your train approaches or is delayed'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              {lang === 'bn' ? 'ট্রেন নির্বাচন করুন' : 'Select Train'}
            </label>
            <select
              value={activeTrain.id}
              onChange={(e) => setTrainId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              {TRAINS.map((t) => (
                <option key={t.id} value={t.id}>
                  {lang === 'bn' ? t.nameBn : t.nameEn} ({fmtNum(t.number)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              {lang === 'bn' ? 'লক্ষ্য স্টেশন (অ্যালার্টের জন্য)' : 'Target Station'}
            </label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              {activeTrain.stops.map((s) => {
                const st = STATIONS[s.stationId];
                return (
                  <option key={s.stationId} value={s.stationId}>
                    {lang === 'bn' ? st?.nameBn : st?.nameEn} ({s.arrival !== '--' ? s.arrival : s.departure})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <span>
                {lang === 'bn'
                  ? 'স্টেশনের ২ কি.মি. আগে ও পৌঁছানোর সাথে সাথে অ্যালার্ট'
                  : 'Alert 2 km before & upon station arrival'}
              </span>
              <input
                type="checkbox"
                checked={alertOnArrival}
                onChange={(e) => setAlertOnArrival(e.target.checked)}
                className="h-4 w-4 accent-emerald-700"
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <span>
                {lang === 'bn'
                  ? '২০+ মিনিট বিলম্ব হলে সতর্কবার্তা'
                  : 'Alert when delay exceeds 20 minutes'}
              </span>
              <input
                type="checkbox"
                checked={alertOnDelay}
                onChange={(e) => setAlertOnDelay(e.target.checked)}
                className="h-4 w-4 accent-emerald-700"
              />
            </label>
          </div>

          {pushState.statusMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>{pushState.statusMessage}</span>
            </div>
          )}

          {pushState.errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
              <span>{pushState.errorMessage}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={pushState.busy}
              onClick={() =>
                void onEnablePush({
                  trainId: activeTrain.id,
                  stationId,
                  alertOnArrival,
                  alertOnDelay,
                  lang,
                })
              }
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0f3d2e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <BellRing className="h-4 w-4" />
              <span>
                {pushState.isSubscribed
                  ? lang === 'bn'
                    ? 'অ্যালার্ট আপডেট ও সেভ করুন'
                    : 'Update & Save Alert'
                  : lang === 'bn'
                    ? 'পুশ নোটিফিকেশন চালু করুন'
                    : 'Enable Push Notifications'}
              </span>
            </button>

            {pushState.isSubscribed && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pushState.busy}
                  onClick={() =>
                    void onSendTestPush({
                      trainId: activeTrain.id,
                      stationId,
                      lang,
                    })
                  }
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{lang === 'bn' ? 'টেস্ট পুশ পাঠান' : 'Send Test Push'}</span>
                </button>

                <button
                  type="button"
                  disabled={pushState.busy}
                  onClick={() => void onDisablePush(activeTrain.id, stationId)}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <BellOff className="h-3.5 w-3.5" />
                  <span>{lang === 'bn' ? 'বন্ধ করুন' : 'Disable'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
