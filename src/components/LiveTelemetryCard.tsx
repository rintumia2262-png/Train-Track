import React, { useEffect, useState } from 'react';
import {
  Clock,
  Info,
  MessageSquare,
  Send,
  TrainFront,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  LiveTrainState,
  STATIONS,
  TrainDefinition,
} from '../data/railwayNetwork';
import { ComputedTelemetry, toBnDigits } from '../utils/trackMath';

interface LiveTelemetryCardProps {
  train: TrainDefinition;
  liveState: LiveTrainState;
  telemetry: ComputedTelemetry;
  lang: 'bn' | 'en';
  messages: ChatMessage[];
  onSendMessage: (author: string, coach: string, text: string) => Promise<void>;
}

export const LiveTelemetryCard: React.FC<LiveTelemetryCardProps> = ({
  train,
  liveState,
  telemetry,
  lang,
  messages,
  onSendMessage,
}) => {
  const [drawer, setDrawer] = useState<'none' | 'details' | 'chat'>('none');
  const [chatText, setChatText] = useState('');
  const [chatAuthor, setChatAuthor] = useState('যাত্রী');
  const [chatCoach, setChatCoach] = useState('ক বগি');
  const [sending, setSending] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const secAgo = Math.max(1, Math.floor((nowMs - liveState.lastUpdatedAt) / 1000));
  const timeAgoLabel =
    lang === 'bn'
      ? secAgo < 60
        ? `${toBnDigits(secAgo)} সে আগে`
        : `${toBnDigits(Math.floor(secAgo / 60))} মি আগে`
      : secAgo < 60
        ? `${secAgo}s ago`
        : `${Math.floor(secAgo / 60)}m ago`;

  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(chatAuthor, chatCoach, chatText.trim());
      setChatText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="rounded-t-3xl lg:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-slate-900 shadow-2xl">
        {/* Top Row: Next Station + Speedometer */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-medium text-slate-500">
                {lang === 'bn' ? 'পরবর্তী' : 'Next'}
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-950 truncate">
                {lang === 'bn' ? telemetry.nextStopNameBn : telemetry.nextStopNameEn}
              </h2>
              <span className="text-sm font-medium text-slate-500 font-mono-tabular">
                ({fmtNum(telemetry.distToNextKm)} {lang === 'bn' ? 'কি' : 'km'})
              </span>
            </div>

            {/* Delay & Live Ping Status (Zero Pill Clutter, Clean Unboxed Status) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-bold ${
                  liveState.delayMinutes > 10 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {liveState.delayMinutes > 0
                  ? lang === 'bn'
                    ? `${fmtNum(liveState.delayMinutes)}মি বিলম্বে`
                    : `${liveState.delayMinutes}m Delayed`
                  : lang === 'bn'
                    ? 'সময়মতো চলছে'
                    : 'On Time'}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                {lang === 'bn' ? 'লাইভ' : 'Live'} · {timeAgoLabel}
              </span>
            </div>
          </div>

          {/* Speedometer Box matching screenshot */}
          <div className="shrink-0 rounded-2xl bg-slate-100 px-3.5 py-2 text-center min-w-[76px]">
            <div className="text-2xl font-bold leading-none text-slate-900 font-mono-tabular">
              {fmtNum(liveState.speedKmh)}
            </div>
            <div className="mt-1 text-[11px] font-medium text-slate-500">
              {lang === 'bn' ? 'কি/ঘ' : 'km/h'}
            </div>
          </div>
        </div>

        {/* Route Segment Progress Bar matching screenshot */}
        <div className="mt-5">
          <div className="relative flex items-center">
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-rose-700 transition-all duration-500"
                style={{ width: `${Math.max(8, Math.min(94, telemetry.segmentProgress01 * 100))}%` }}
              />
            </div>

            {/* Start dot */}
            <span className="absolute left-0 h-2.5 w-2.5 rounded-full bg-rose-700" />

            {/* Moving Train Icon */}
            <div
              className="absolute -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-700 text-white shadow-md ring-2 ring-white transition-all duration-500"
              style={{ left: `${Math.max(10, Math.min(90, telemetry.segmentProgress01 * 100))}%` }}
            >
              <TrainFront className="h-3.5 w-3.5" />
            </div>

            {/* End target ring */}
            <span className="absolute right-0 h-4 w-4 rounded-full border-[3px] border-rose-700 bg-white" />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-500 truncate max-w-[30%]">
              {lang === 'bn' ? telemetry.prevStopNameBn : telemetry.prevStopNameEn}
            </span>
            <span className="text-slate-600 font-mono-tabular truncate">
              {lang === 'bn' ? telemetry.currentAreaNameBn : telemetry.currentAreaNameEn} ·{' '}
              {fmtNum(telemetry.distFromPrevKm)} {lang === 'bn' ? 'কি' : 'km'}
            </span>
            <span className="font-bold text-rose-700 truncate max-w-[30%] text-right">
              {lang === 'bn' ? telemetry.nextStopNameBn : telemetry.nextStopNameEn}
            </span>
          </div>
        </div>

        {/* Bottom 2 Action Buttons: বিস্তারিত & চ্যাট */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDrawer('details')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Info className="h-4 w-4 text-rose-700" />
            <span>{lang === 'bn' ? 'বিস্তারিত' : 'Details'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawer('chat')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MessageSquare className="h-4 w-4 text-rose-700" />
            <span>
              {lang === 'bn' ? 'চ্যাট' : 'Chat'} ({fmtNum(messages.length)})
            </span>
          </button>
        </div>
      </div>

      {/* Details Modal / Sheet */}
      {drawer === 'details' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  {lang === 'bn' ? train.nameBn : train.nameEn} ({fmtNum(train.number)})
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? train.directionBn : train.directionEn} ·{' '}
                  {lang === 'bn' ? train.offDayBn : train.offDayEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer('none')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Coach Order */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-500">
                {lang === 'bn' ? 'বগির বিন্যাস (ইঞ্জিন থেকে শেষ বগি)' : 'Coach Order (Loco to Tail)'}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950">
                  {lang === 'bn' ? 'ইঞ্জিন' : 'LOCO'}
                </span>
                {train.coaches.map((c, idx) => (
                  <span
                    key={c}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      idx === train.coaches.length - 1
                        ? 'bg-rose-700 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {c}
                    {idx === train.coaches.length - 1
                      ? lang === 'bn'
                        ? ' (শেষ)'
                        : ' (Tail)'
                      : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Official SMS Shortcut */}
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <span className="font-semibold">
                {lang === 'bn' ? 'অফিশিয়াল SMS ট্র্যাকিং:' : 'Official SMS Tracking:'}{' '}
              </span>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono-tabular font-bold text-emerald-800">
                TR {train.number}
              </code>{' '}
              → <strong className="font-mono-tabular">16318</strong>
            </div>

            {/* Fares */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-500">
                {lang === 'bn' ? 'ভাড়ার তালিকা (ঢাকা রুট আনুমানিক)' : 'Ticket Fares'}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {train.fares.map((f) => (
                  <div
                    key={f.classEn}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-700">{lang === 'bn' ? f.classBn : f.classEn}</span>
                    <strong className="font-mono-tabular text-slate-950">
                      ৳{fmtNum(f.priceBdt)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Timetable */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-500">
                {lang === 'bn' ? 'স্টপেজ ও সময়সূচি' : 'Stop-by-Stop Timetable'}
              </div>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {train.stops.map((s) => {
                  const st = STATIONS[s.stationId];
                  return (
                    <div
                      key={s.stationId}
                      className="flex items-center justify-between px-3 py-2.5 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {lang === 'bn' ? st?.nameBn : st?.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          {fmtNum(s.kmFromStart)} {lang === 'bn' ? 'কি.মি.' : 'km'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 font-mono-tabular text-slate-700">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {s.arrival} / {s.departure}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Passenger Chat Drawer */}
      {drawer === 'chat' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4">
          <div className="flex h-[82vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  {lang === 'bn' ? 'যাত্রী লাইভ চ্যাট' : 'Passenger Live Chat'} —{' '}
                  {lang === 'bn' ? train.nameBn : train.nameEn}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? `${fmtNum(liveState.activeReporters)} জন যাত্রী সক্রিয় আছেন`
                    : `${liveState.activeReporters} passengers active`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer('none')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  {lang === 'bn'
                    ? 'এখনো কোনো বার্তা নেই। প্রথম আপডেট দিন!'
                    : 'No messages yet. Share the first live update!'}
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {m.author} {m.coach ? `· ${m.coach}` : ''}
                      </span>
                      <span className="font-mono-tabular">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="border-t border-slate-100 p-3.5 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatAuthor}
                  onChange={(e) => setChatAuthor(e.target.value)}
                  placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'}
                  className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
                <select
                  value={chatCoach}
                  onChange={(e) => setChatCoach(e.target.value)}
                  className="w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  {train.coaches.map((c) => (
                    <option key={c} value={`${c} বগি`}>
                      {lang === 'bn' ? `${c} বগি` : `Coach ${c}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'ট্রেনের অবস্থান বা প্ল্যাটফর্ম আপডেট লিখুন...'
                      : 'Share train delay or crossing update...'
                  }
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !chatText.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-700 text-white hover:bg-rose-600 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
