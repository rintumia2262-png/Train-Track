import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Map as MapIcon,
  Radio,
  Search,
  TrainFront,
} from 'lucide-react';
import { LiveTelemetryCard } from './components/LiveTelemetryCard';
import {
  InsideTrainAndShopView,
  StationBoardView,
  TrainSearchView,
} from './components/TrainExplorerViews';
import { TrainMap3D } from './components/TrainMap3D';
import {
  ChatMessage,
  INITIAL_CHAT_MESSAGES,
  LiveTrainState,
  TRAINS,
} from './data/railwayNetwork';
import { OfflineIndicator, PWAInstallButton } from './pwa/PWAComponents';
import { buildTrackPolyline, computeTrainTelemetry, toBnDigits } from './utils/trackMath';
import { TrainAudioEngine } from './utils/trainAudio';

type ActiveTab = 'map' | 'search' | 'stations' | 'share';

const CACHE_KEY = 'bd_train_track_cached_states_v1';

function buildInitialTrainMap(): Record<string, LiveTrainState> {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, LiveTrainState>;
      if (parsed && parsed['ekota-706']) return parsed;
    }
  } catch {
    // Ignore storage error
  }

  const now = Date.now();
  const map: Record<string, LiveTrainState> = {};
  for (const t of TRAINS) {
    map[t.id] = {
      id: t.id,
      progress01: t.initialProgress01,
      speedKmh: t.initialSpeedKmh,
      delayMinutes: t.initialDelayMin,
      lastUpdatedAt: now - t.initialLastPingSecAgo * 1000,
      activeReporters: 5,
      lastReporterLabelBn: 'অন-বোর্ড যাত্রী GPS',
      lastReporterLabelEn: 'On-board Passenger GPS',
    };
  }
  return map;
}

export default function App() {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [selectedTrainId, setSelectedTrainId] = useState<string>('ekota-706');
  const [trainsState, setTrainsState] = useState<Record<string, LiveTrainState>>(buildInitialTrainMap);
  const [chatMap, setChatMap] = useState<Record<string, ChatMessage[]>>(() => {
    const grouped: Record<string, ChatMessage[]> = {};
    for (const m of INITIAL_CHAT_MESSAGES) {
      grouped[m.trainId] = [...(grouped[m.trainId] ?? []), m];
    }
    return grouped;
  });
  const [soundEnabled, setSoundEnabled] = useState(false);

  const audioRef = useRef<TrainAudioEngine | null>(null);

  useEffect(() => {
    audioRef.current = new TrainAudioEngine();
    return () => {
      audioRef.current?.dispose();
    };
  }, []);

  // Connect to Express backend + SSE real-time stream (gracefully falls back to local ticks if offline)
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackTimer: number | null = null;

    const applyTrainList = (list: LiveTrainState[]) => {
      setTrainsState((prev) => {
        const next = { ...prev };
        for (const item of list) {
          next[item.id] = item;
        }
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
        return next;
      });
    };

    fetch('/api/trains')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { trains?: LiveTrainState[] } | null) => {
        if (data?.trains) applyTrainList(data.trains);
      })
      .catch(() => {
        // Offline mode uses cached state
      });

    try {
      es = new EventSource('/api/stream');
      es.addEventListener('trains', (evt) => {
        const payload = JSON.parse((evt as MessageEvent).data) as LiveTrainState[];
        applyTrainList(payload);
      });
      es.addEventListener('chat', (evt) => {
        const msg = JSON.parse((evt as MessageEvent).data) as ChatMessage;
        setChatMap((prev) => {
          const list = prev[msg.trainId] ?? [];
          if (list.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [msg.trainId]: [...list, msg] };
        });
      });
    } catch {
      // Fallback offline tick if SSE unavailable
      fallbackTimer = window.setInterval(() => {
        setTrainsState((prev) => {
          const next = { ...prev };
          for (const t of TRAINS) {
            const cur = next[t.id];
            if (!cur) continue;
            const totalKm = t.stops[t.stops.length - 1]?.kmFromStart || 300;
            const step = cur.speedKmh / 3600 / totalKm;
            next[t.id] = {
              ...cur,
              progress01: cur.progress01 + step > 0.98 ? 0.05 : cur.progress01 + step,
            };
          }
          return next;
        });
      }, 2500);
    }

    return () => {
      es?.close();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
    };
  }, []);

  // Load chat history when switching active train
  useEffect(() => {
    fetch(`/api/trains/${selectedTrainId}/chat`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages?: ChatMessage[] } | null) => {
        if (data?.messages) {
          setChatMap((prev) => ({ ...prev, [selectedTrainId]: data.messages! }));
        }
      })
      .catch(() => {
        // Ignore offline
      });
  }, [selectedTrainId]);

  const selectedTrain = useMemo(
    () => TRAINS.find((t) => t.id === selectedTrainId) ?? TRAINS[0],
    [selectedTrainId]
  );

  const selectedLiveState = trainsState[selectedTrain.id] ?? {
    id: selectedTrain.id,
    progress01: selectedTrain.initialProgress01,
    speedKmh: selectedTrain.initialSpeedKmh,
    delayMinutes: selectedTrain.initialDelayMin,
    lastUpdatedAt: Date.now() - 29_000,
    activeReporters: 5,
    lastReporterLabelBn: 'অন-বোর্ড যাত্রী GPS',
    lastReporterLabelEn: 'On-board Passenger GPS',
  };

  const selectedPolyline = useMemo(() => buildTrackPolyline(selectedTrain), [selectedTrain]);

  const telemetry = useMemo(
    () => computeTrainTelemetry(selectedTrain, selectedLiveState, selectedPolyline),
    [selectedTrain, selectedLiveState, selectedPolyline]
  );

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      audioRef.current?.setEnabled(next, selectedLiveState.speedKmh);
      return next;
    });
  }, [selectedLiveState.speedKmh]);

  const handleSendChat = useCallback(
    async (author: string, coach: string, text: string) => {
      try {
        const res = await fetch(`/api/trains/${selectedTrain.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, coach, text }),
        });
        if (res.ok) {
          const data = (await res.json()) as { message: ChatMessage };
          setChatMap((prev) => {
            const list = prev[selectedTrain.id] ?? [];
            if (list.some((m) => m.id === data.message.id)) return prev;
            return { ...prev, [selectedTrain.id]: [...list, data.message] };
          });
          return;
        }
      } catch {
        // Offline local append fallback
      }

      const fallbackMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        trainId: selectedTrain.id,
        author,
        coach,
        text,
        createdAt: Date.now(),
      };
      setChatMap((prev) => ({
        ...prev,
        [selectedTrain.id]: [...(prev[selectedTrain.id] ?? []), fallbackMsg],
      }));
    },
    [selectedTrain.id]
  );

  const handlePingTrain = useCallback(
    async (
      trainId: string,
      payload: {
        progress01?: number;
        speedKmh?: number;
        delayMinutes?: number;
        reporterLabelBn?: string;
        reporterLabelEn?: string;
      }
    ) => {
      try {
        const res = await fetch(`/api/trains/${trainId}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = (await res.json()) as { train: LiveTrainState };
          setTrainsState((prev) => ({ ...prev, [trainId]: data.train }));
          return;
        }
      } catch {
        // Offline optimistic state
      }

      setTrainsState((prev) => {
        const cur = prev[trainId];
        if (!cur) return prev;
        return {
          ...prev,
          [trainId]: {
            ...cur,
            progress01: payload.progress01 ?? cur.progress01,
            speedKmh: payload.speedKmh ?? cur.speedKmh,
            delayMinutes: payload.delayMinutes ?? cur.delayMinutes,
            lastUpdatedAt: Date.now(),
            activeReporters: cur.activeReporters + 1,
          },
        };
      });
    },
    []
  );

  const handleSelectTrainOnMap = useCallback((trainId: string) => {
    setSelectedTrainId(trainId);
    setActiveTab('map');
  }, []);

  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <OfflineIndicator lang={lang} />

      {/* Top App Bar (Clean 3-Zone Contract) */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-emerald-950/30 bg-[#0f3d2e] px-3 sm:px-5 text-white shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-700 text-white shadow-sm">
            <TrainFront className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight whitespace-nowrap shrink-0">
            BD Train Track
          </span>
        </div>

        {/* Active Train Quick Switcher */}
        <div className="flex min-w-0 flex-1 justify-center">
          <select
            aria-label={lang === 'bn' ? 'ট্রেন নির্বাচন' : 'Select train'}
            value={selectedTrainId}
            onChange={(e) => setSelectedTrainId(e.target.value)}
            className="max-w-[230px] sm:max-w-xs truncate rounded-lg border border-white/20 bg-emerald-950/70 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none cursor-pointer"
          >
            {TRAINS.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                {lang === 'bn' ? t.nameBn : t.nameEn} ({fmtNum(t.number)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton lang={lang} />
          <button
            type="button"
            onClick={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
            className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="relative flex-1 overflow-hidden">
        {activeTab === 'map' && (
          <div className="flex h-full w-full flex-col lg:flex-row">
            {/* 3D Satellite / OSM Map Canvas */}
            <div className="relative flex-1 min-h-0">
              <TrainMap3D
                train={selectedTrain}
                liveState={selectedLiveState}
                lang={lang}
                soundEnabled={soundEnabled}
                onToggleSound={handleToggleSound}
              />
            </div>

            {/* Live Telemetry Bottom Sheet on Mobile / Right Side Panel on Desktop */}
            <aside className="z-20 -mt-5 shrink-0 lg:mt-0 lg:w-[400px] lg:border-l lg:border-slate-200 lg:bg-slate-50 lg:p-4 lg:overflow-y-auto pb-16 lg:pb-20">
              <LiveTelemetryCard
                train={selectedTrain}
                liveState={selectedLiveState}
                telemetry={telemetry}
                lang={lang}
                messages={chatMap[selectedTrain.id] ?? []}
                onSendMessage={handleSendChat}
              />

              {/* Desktop Quick Info Summary */}
              <div className="mt-4 hidden lg:block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">
                  {lang === 'bn' ? 'সক্রিয় ট্রেন তথ্য' : 'Active Train Info'}
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900">
                  {lang === 'bn' ? selectedTrain.nameBn : selectedTrain.nameEn} (
                  {fmtNum(selectedTrain.number)})
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {lang === 'bn' ? selectedTrain.directionBn : selectedTrain.directionEn}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <span>
                    {lang === 'bn' ? 'সোর্স:' : 'Source:'}{' '}
                    <strong className="text-slate-900">
                      {lang === 'bn'
                        ? selectedLiveState.lastReporterLabelBn
                        : selectedLiveState.lastReporterLabelEn}
                    </strong>
                  </span>
                  <span className="font-mono-tabular text-emerald-700 font-semibold">
                    {fmtNum(selectedLiveState.activeReporters)}{' '}
                    {lang === 'bn' ? 'জন সক্রিয়' : 'active'}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="h-full overflow-y-auto bg-slate-100">
            <TrainSearchView
              trainsState={trainsState}
              selectedTrainId={selectedTrainId}
              lang={lang}
              onSelectTrainOnMap={handleSelectTrainOnMap}
              onPingTrain={handlePingTrain}
            />
          </div>
        )}

        {activeTab === 'stations' && (
          <div className="h-full overflow-y-auto bg-slate-100">
            <StationBoardView
              trainsState={trainsState}
              selectedTrainId={selectedTrainId}
              lang={lang}
              onSelectTrainOnMap={handleSelectTrainOnMap}
              onPingTrain={handlePingTrain}
            />
          </div>
        )}

        {activeTab === 'share' && (
          <div className="h-full overflow-y-auto bg-slate-100">
            <InsideTrainAndShopView
              trainsState={trainsState}
              selectedTrainId={selectedTrainId}
              lang={lang}
              onSelectTrainOnMap={handleSelectTrainOnMap}
              onPingTrain={handlePingTrain}
            />
          </div>
        )}
      </main>

      {/* Fixed 4-Tab Thumb-Zone Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-4 border-t border-slate-200 bg-white/95 shadow-lg">
        {(
          [
            {
              id: 'map',
              icon: MapIcon,
              labelBn: '৩ডি ম্যাপ',
              labelEn: '3D Map',
            },
            {
              id: 'search',
              icon: Search,
              labelBn: 'ট্রেন খুঁজুন',
              labelEn: 'Search',
            },
            {
              id: 'stations',
              icon: Building2,
              labelBn: 'স্টেশন বোর্ড',
              labelEn: 'Stations',
            },
            {
              id: 'share',
              icon: Radio,
              labelBn: 'আমি ট্রেনে',
              labelEn: 'Onboard',
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-rose-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              <span className="whitespace-nowrap">
                {lang === 'bn' ? tab.labelBn : tab.labelEn}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
