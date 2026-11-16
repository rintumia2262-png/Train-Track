import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Navigation,
  Radio,
  Search,
  ShoppingBag,
  TrainFront,
} from 'lucide-react';
import {
  LiveTrainState,
  STATIONS,
  TRAINS,
  TrainDefinition,
  TRAVEL_GEAR_ITEMS,
} from '../data/railwayNetwork';
import { buildTrackPolyline, snapGpsToTrack, toBnDigits } from '../utils/trackMath';

interface ExplorerProps {
  trainsState: Record<string, LiveTrainState>;
  selectedTrainId: string;
  lang: 'bn' | 'en';
  onSelectTrainOnMap: (trainId: string) => void;
  onPingTrain: (
    trainId: string,
    payload: {
      progress01?: number;
      speedKmh?: number;
      delayMinutes?: number;
      reporterLabelBn?: string;
      reporterLabelEn?: string;
    }
  ) => Promise<void>;
}

export const TrainSearchView: React.FC<ExplorerProps> = ({
  trainsState,
  lang,
  onSelectTrainOnMap,
}) => {
  const [query, setQuery] = useState('');
  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');

  const stationList = useMemo(() => Object.values(STATIONS), []);
  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  const filteredTrains = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRAINS.filter((t) => {
      const matchesQuery =
        !q ||
        t.nameBn.toLowerCase().includes(q) ||
        t.nameEn.toLowerCase().includes(q) ||
        t.number.includes(q) ||
        t.stops.some((s) => {
          const st = STATIONS[s.stationId];
          return (
            st?.nameBn.toLowerCase().includes(q) || st?.nameEn.toLowerCase().includes(q)
          );
        });

      const fromIdx = fromStation
        ? t.stops.findIndex((s) => s.stationId === fromStation)
        : 0;
      const toIdx = toStation
        ? t.stops.findIndex((s) => s.stationId === toStation)
        : t.stops.length - 1;

      const matchesRoute =
        (!fromStation || fromIdx !== -1) &&
        (!toStation || toIdx !== -1) &&
        (!fromStation || !toStation || fromIdx < toIdx);

      return matchesQuery && matchesRoute;
    });
  }, [query, fromStation, toStation]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'ট্রেনের নাম, নম্বর (৭০৬, ৭০১) বা স্টেশন খুঁজুন...'
                : 'Search train name, number (706, 701) or station...'
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={fromStation}
            onChange={(e) => setFromStation(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            <option value="">{lang === 'bn' ? 'যাত্রা শুরু স্টেশন (সব)' : 'From Station (All)'}</option>
            {stationList.map((st) => (
              <option key={st.id} value={st.id}>
                {lang === 'bn' ? st.nameBn : st.nameEn}
              </option>
            ))}
          </select>

          <select
            value={toStation}
            onChange={(e) => setToStation(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            <option value="">{lang === 'bn' ? 'গন্তব্য স্টেশন (সব)' : 'To Station (All)'}</option>
            {stationList.map((st) => (
              <option key={st.id} value={st.id}>
                {lang === 'bn' ? st.nameBn : st.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filteredTrains.map((train) => {
          const live = trainsState[train.id];
          return (
            <div
              key={train.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      {lang === 'bn' ? train.nameBn : train.nameEn}{' '}
                      <span className="font-mono-tabular text-sm text-slate-500">
                        ({fmtNum(train.number)})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'bn' ? train.directionBn : train.directionEn}
                    </p>
                  </div>
                  {live && (
                    <span className="font-mono-tabular text-xs font-bold text-emerald-700">
                      {fmtNum(live.speedKmh)} {lang === 'bn' ? 'কি/ঘ' : 'km/h'}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>{lang === 'bn' ? train.offDayBn : train.offDayEn}</span>
                  <span className="font-mono-tabular">
                    {fmtNum(train.stops.length)} {lang === 'bn' ? 'স্টপেজ' : 'stops'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectTrainOnMap(train.id)}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4" />
                <span>{lang === 'bn' ? '৩ডি ম্যাপে লাইভ দেখুন' : 'Track on 3D Map'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StationBoardView: React.FC<ExplorerProps> = ({
  trainsState,
  lang,
  onSelectTrainOnMap,
}) => {
  const [stationId, setStationId] = useState('santahar');
  const station = STATIONS[stationId];
  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  const arrivingTrains = useMemo(() => {
    return TRAINS.map((train) => {
      const stop = train.stops.find((s) => s.stationId === stationId);
      if (!stop) return null;
      return { train, stop, live: trainsState[train.id] };
    }).filter((x): x is { train: TrainDefinition; stop: NonNullable<TrainDefinition['stops'][number]>; live: LiveTrainState } => Boolean(x));
  }, [stationId, trainsState]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold text-slate-500">
          {lang === 'bn' ? 'স্টেশন নির্বাচন করুন' : 'Select Railway Station'}
        </label>
        <select
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
        >
          {Object.values(STATIONS).map((st) => (
            <option key={st.id} value={st.id}>
              {lang === 'bn' ? st.nameBn : st.nameEn} ({st.code})
            </option>
          ))}
        </select>

        {station && (
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span>
              {lang === 'bn' ? 'প্ল্যাটফর্ম সংখ্যা:' : 'Platforms:'}{' '}
              <strong className="font-mono-tabular text-slate-800">
                {fmtNum(station.platformCount)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {station.coords[1].toFixed(4)}°N, {station.coords[0].toFixed(4)}°E
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {arrivingTrains.map(({ train, stop, live }) => (
          <div
            key={train.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TrainFront className="h-4 w-4 shrink-0 text-rose-700" />
                <h4 className="font-bold text-slate-950 truncate">
                  {lang === 'bn' ? train.nameBn : train.nameEn} ({fmtNum(train.number)})
                </h4>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {lang === 'bn' ? train.directionBn : train.directionEn} ·{' '}
                <span className="font-mono-tabular">
                  {stop.arrival} / {stop.departure}
                </span>
              </p>
              {live && (
                <p className="mt-1 text-xs font-semibold text-rose-700">
                  {live.delayMinutes > 0
                    ? lang === 'bn'
                      ? `${fmtNum(live.delayMinutes)}মি বিলম্ব`
                      : `${live.delayMinutes}m delay`
                    : lang === 'bn'
                      ? 'সময়মতো'
                      : 'On time'}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelectTrainOnMap(train.id)}
              className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              {lang === 'bn' ? 'ট্র্যাক করুন' : 'Track'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const InsideTrainAndShopView: React.FC<ExplorerProps> = ({
  trainsState,
  selectedTrainId,
  lang,
  onPingTrain,
  onSelectTrainOnMap,
}) => {
  const [activeTrainId, setActiveTrainId] = useState(selectedTrainId);
  const [sharingLiveGps, setSharingLiveGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [delayInput, setDelayInput] = useState(15);
  const [cartIds, setCartIds] = useState<string[]>([]);

  const train = TRAINS.find((t) => t.id === activeTrainId) ?? TRAINS[0];
  const fmtNum = (val: number | string) => (lang === 'bn' ? toBnDigits(val) : String(val));

  const handleShareRealGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus(
        lang === 'bn'
          ? 'এই ব্রাউজারে GPS সুবিধা পাওয়া যায়নি—নিচে থেকে স্টেশন চেক-ইন ব্যবহার করুন।'
          : 'Geolocation unavailable — use station check-in below.'
      );
      return;
    }

    setSharingLiveGps(true);
    setGpsStatus(lang === 'bn' ? 'আপনার GPS পজিশন রেললাইনের সাথে মেলানো হচ্ছে...' : 'Snapping GPS to railway line...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const poly = buildTrackPolyline(train);
        const snapped = snapGpsToTrack(poly, pos.coords.longitude, pos.coords.latitude);
        const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : trainsState[train.id]?.speedKmh ?? 45;

        await onPingTrain(train.id, {
          progress01: snapped.progress01,
          speedKmh,
          delayMinutes: delayInput,
          reporterLabelBn: 'যাত্রীর লাইভ GPS পিং',
          reporterLabelEn: 'Passenger Live GPS',
        });

        setSharingLiveGps(false);
        setGpsStatus(
          lang === 'bn'
            ? `সফল! রেললাইনে লোকেশন আপডেট হয়েছে (দূরত্ব ${snapped.distanceKm.toFixed(1)} কি.মি.)`
            : `Updated on track! (${snapped.distanceKm.toFixed(1)} km from corridor)`
        );
      },
      () => {
        setSharingLiveGps(false);
        setGpsStatus(
          lang === 'bn'
            ? 'GPS অনুমতি পাওয়া যায়নি—নিচের স্টেশন চেক-ইন বাটন ব্যবহার করে সরাসরি লোকেশন শেয়ার করুন।'
            : 'Location permission denied — use quick station check-in below.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleStationCheckIn = async (stopIdx: number) => {
    const progress01 = Math.max(0.02, Math.min(0.98, stopIdx / Math.max(1, train.stops.length - 1)));
    const st = STATIONS[train.stops[stopIdx].stationId];
    await onPingTrain(train.id, {
      progress01,
      delayMinutes: delayInput,
      reporterLabelBn: `${st?.nameBn ?? ''} স্টেশন চেক-ইন`,
      reporterLabelEn: `${st?.nameEn ?? ''} Station Ping`,
    });
    setGpsStatus(
      lang === 'bn'
        ? `${st?.nameBn} স্টেশনে আপনার লোকেশন আপডেট লাইভ ম্যাপে যুক্ত হয়েছে!`
        : `Broadcasted live check-in at ${st?.nameEn}!`
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      {/* "I'm Inside Train" Crowdsourced GPS Sharing Card */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {lang === 'bn' ? 'আমি ট্রেনের ভেতরে আছি (লাইভ শেয়ারিং)' : "I'm Inside Train (Live GPS Share)"}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {lang === 'bn'
                ? 'আপনার অবস্থান শেয়ার করলে অন্য যাত্রীরা ৩ডি ম্যাপে ট্রেনের সঠিক অবস্থান ও গতি দেখতে পাবেন।'
                : 'Share your onboard GPS or station crossing to update the 3D live map for all passengers.'}
            </p>
          </div>
          <Radio className="h-6 w-6 shrink-0 text-emerald-700" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              {lang === 'bn' ? 'আপনার ট্রেন' : 'Your Train'}
            </label>
            <select
              value={activeTrainId}
              onChange={(e) => setActiveTrainId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900"
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
              {lang === 'bn' ? `বিলম্ব রিপোর্ট: ${fmtNum(delayInput)} মিনিট` : `Report Delay: ${delayInput} min`}
            </label>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={delayInput}
              onChange={(e) => setDelayInput(Number(e.target.value))}
              className="mt-3 w-full accent-rose-700"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleShareRealGps}
            disabled={sharingLiveGps}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 cursor-pointer"
          >
            <Navigation className="h-4 w-4" />
            <span>
              {sharingLiveGps
                ? lang === 'bn'
                  ? 'লোকেশন পাঠানো হচ্ছে...'
                  : 'Sending GPS...'
                : lang === 'bn'
                  ? 'লাইভ GPS শেয়ার করুন'
                  : 'Share Live GPS'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTrainOnMap(train.id)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-rose-700" />
            <span>{lang === 'bn' ? '৩ডি ম্যাপে দেখুন' : 'View on 3D Map'}</span>
          </button>
        </div>

        {gpsStatus && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{gpsStatus}</span>
          </div>
        )}

        {/* Quick 1-Tap Station Ping */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-500">
            {lang === 'bn' ? 'অথবা ১-ট্যাপ স্টেশন পিং (ট্রেন এখন কোথায় আছে):' : 'Or 1-Tap Station Check-In:'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {train.stops.map((s, idx) => {
              const st = STATIONS[s.stationId];
              return (
                <button
                  key={s.stationId}
                  type="button"
                  onClick={() => handleStationCheckIn(idx)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 transition-colors cursor-pointer"
                >
                  {lang === 'bn' ? st?.nameBn : st?.nameEn}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Authentic Travel Gear Shop (Matching BD Train Guide feature) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {lang === 'bn' ? 'রেল ট্রাভেল গিয়ার শপ' : 'Rail Travel Gear Shop'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'bn'
                ? 'দীর্ঘ ট্রেন ভ্রমণের প্রয়োজনীয় অরিজিনাল পণ্য'
                : 'Authentic travel essentials for long train journeys'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-900">
            <ShoppingBag className="h-4 w-4 text-rose-700" />
            <span className="font-mono-tabular">{fmtNum(cartIds.length)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TRAVEL_GEAR_ITEMS.map((item) => {
            const added = cartIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5"
              >
                <div>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {lang === 'bn' ? item.categoryBn : item.categoryEn}
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                    {lang === 'bn' ? item.nameBn : item.nameEn}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {lang === 'bn' ? item.descBn : item.descEn}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono-tabular text-sm font-bold text-slate-950">
                    ৳{fmtNum(item.priceBdt)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCartIds((prev) =>
                        prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                      )
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      added
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {added
                      ? lang === 'bn'
                        ? 'ব্যাগে যুক্ত'
                        : 'Added'
                      : lang === 'bn'
                        ? 'ব্যাগে যোগ করুন'
                        : 'Add to Bag'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
