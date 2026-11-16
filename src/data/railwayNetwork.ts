export interface StationNode {
  id: string;
  nameBn: string;
  nameEn: string;
  code: string;
  coords: [number, number]; // [lng, lat]
  platformCount: number;
}

export interface TrainStop {
  stationId: string;
  arrival: string;
  departure: string;
  kmFromStart: number;
}

export interface TrainFare {
  classBn: string;
  classEn: string;
  priceBdt: number;
}

export interface TrainDefinition {
  id: string;
  number: string;
  nameBn: string;
  nameEn: string;
  offDayBn: string;
  offDayEn: string;
  directionBn: string;
  directionEn: string;
  coaches: string[];
  stops: TrainStop[];
  fares: TrainFare[];
  initialProgress01: number;
  initialSpeedKmh: number;
  initialDelayMin: number;
  initialLastPingSecAgo: number;
}

export interface LiveTrainState {
  id: string;
  progress01: number; // 0..1 along stops polyline
  speedKmh: number;
  delayMinutes: number;
  lastUpdatedAt: number; // epoch ms
  activeReporters: number;
  lastReporterLabelBn: string;
  lastReporterLabelEn: string;
  statusNoteBn?: string;
  statusNoteEn?: string;
}

export interface ChatMessage {
  id: string;
  trainId: string;
  author: string;
  coach?: string;
  text: string;
  createdAt: number;
}

export interface TravelGearItem {
  id: string;
  nameBn: string;
  nameEn: string;
  descBn: string;
  descEn: string;
  priceBdt: number;
  categoryBn: string;
  categoryEn: string;
}

export const STATIONS: Record<string, StationNode> = {
  dhaka: {
    id: 'dhaka',
    nameBn: 'ঢাকা কমলাপুর',
    nameEn: 'Dhaka Kamalapur',
    code: 'DA',
    coords: [90.4265, 23.733],
    platformCount: 8,
  },
  airport: {
    id: 'airport',
    nameBn: 'ঢাকা বিমানবন্দর',
    nameEn: 'Dhaka Airport',
    code: 'BDBA',
    coords: [90.4083, 23.8515],
    platformCount: 3,
  },
  joydebpur: {
    id: 'joydebpur',
    nameBn: 'জয়দেবপুর',
    nameEn: 'Joydebpur',
    code: 'JDE',
    coords: [90.4203, 23.9999],
    platformCount: 4,
  },
  tangail: {
    id: 'tangail',
    nameBn: 'টাঙ্গাইল',
    nameEn: 'Tangail',
    code: 'TGL',
    coords: [89.9167, 24.2513],
    platformCount: 2,
  },
  bbsetu_e: {
    id: 'bbsetu_e',
    nameBn: 'বঙ্গবন্ধু সেতু পূর্ব',
    nameEn: 'BB Setu East',
    code: 'BBSE',
    coords: [89.8118, 24.4004],
    platformCount: 3,
  },
  ullapara: {
    id: 'ullapara',
    nameBn: 'উল্লাপাড়া',
    nameEn: 'Ullapara',
    code: 'ULP',
    coords: [89.5663, 24.3168],
    platformCount: 2,
  },
  ishwardi_bp: {
    id: 'ishwardi_bp',
    nameBn: 'ঈশ্বরদী বাইপাস',
    nameEn: 'Ishwardi Bypass',
    code: 'ISDB',
    coords: [89.0837, 24.1328],
    platformCount: 2,
  },
  natore: {
    id: 'natore',
    nameBn: 'নাটোর',
    nameEn: 'Natore',
    code: 'NTR',
    coords: [88.983, 24.4102],
    platformCount: 2,
  },
  santahar: {
    id: 'santahar',
    nameBn: 'সান্তাহার',
    nameEn: 'Santahar',
    code: 'STU',
    coords: [88.9974, 24.8058],
    platformCount: 5,
  },
  chhatian_gram: {
    id: 'chhatian_gram',
    nameBn: 'ছাতিয়ান গ্রাম',
    nameEn: 'Chhatian Gram',
    code: 'CTG',
    coords: [89.0185, 24.8648],
    platformCount: 2,
  },
  akkelpur: {
    id: 'akkelpur',
    nameBn: 'আক্কেলপুর',
    nameEn: 'Akkelpur',
    code: 'AKP',
    coords: [89.0205, 24.9718],
    platformCount: 2,
  },
  joypurhat: {
    id: 'joypurhat',
    nameBn: 'জয়পুরহাট',
    nameEn: 'Joypurhat',
    code: 'JPH',
    coords: [89.0227, 25.0968],
    platformCount: 3,
  },
  birampur: {
    id: 'birampur',
    nameBn: 'বিরামপুর',
    nameEn: 'Birampur',
    code: 'BMP',
    coords: [88.9896, 25.3887],
    platformCount: 2,
  },
  parbatipur: {
    id: 'parbatipur',
    nameBn: 'পার্বতীপুর',
    nameEn: 'Parbatipur',
    code: 'PBT',
    coords: [88.9183, 25.6615],
    platformCount: 5,
  },
  dinajpur: {
    id: 'dinajpur',
    nameBn: 'দিনাজপুর',
    nameEn: 'Dinajpur',
    code: 'DJP',
    coords: [88.6378, 25.6279],
    platformCount: 3,
  },
  rajshahi: {
    id: 'rajshahi',
    nameBn: 'রাজশাহী',
    nameEn: 'Rajshahi',
    code: 'RJH',
    coords: [88.6042, 24.3745],
    platformCount: 5,
  },
  narsingdi: {
    id: 'narsingdi',
    nameBn: 'নরসিংদী',
    nameEn: 'Narsingdi',
    code: 'NRD',
    coords: [90.7177, 23.9209],
    platformCount: 2,
  },
  bhairab: {
    id: 'bhairab',
    nameBn: 'ভৈরব বাজার',
    nameEn: 'Bhairab Bazar',
    code: 'BHB',
    coords: [90.9854, 24.0524],
    platformCount: 4,
  },
  brahmanbaria: {
    id: 'brahmanbaria',
    nameBn: 'ব্রাহ্মণবাড়িয়া',
    nameEn: 'Brahmanbaria',
    code: 'BBR',
    coords: [91.1119, 23.9571],
    platformCount: 3,
  },
  akhaura: {
    id: 'akhaura',
    nameBn: 'আখাউড়া',
    nameEn: 'Akhaura',
    code: 'AKH',
    coords: [91.2111, 23.8768],
    platformCount: 4,
  },
  cumilla: {
    id: 'cumilla',
    nameBn: 'কুমিল্লা',
    nameEn: 'Cumilla',
    code: 'CML',
    coords: [91.1809, 23.4607],
    platformCount: 3,
  },
  laksam: {
    id: 'laksam',
    nameBn: 'লাকসাম',
    nameEn: 'Laksam',
    code: 'LKM',
    coords: [91.1235, 23.2407],
    platformCount: 4,
  },
  feni: {
    id: 'feni',
    nameBn: 'ফেনী',
    nameEn: 'Feni',
    code: 'FNI',
    coords: [91.3976, 23.0159],
    platformCount: 3,
  },
  chattogram: {
    id: 'chattogram',
    nameBn: 'চট্টগ্রাম',
    nameEn: 'Chattogram',
    code: 'CTG_MAIN',
    coords: [91.8325, 22.3338],
    platformCount: 6,
  },
  shaistaganj: {
    id: 'shaistaganj',
    nameBn: 'শায়েস্তাগঞ্জ',
    nameEn: 'Shaistaganj',
    code: 'SHG',
    coords: [91.4543, 24.2738],
    platformCount: 2,
  },
  sreemangal: {
    id: 'sreemangal',
    nameBn: 'শ্রীমঙ্গল',
    nameEn: 'Sreemangal',
    code: 'SML',
    coords: [91.7296, 24.3065],
    platformCount: 2,
  },
  kulaura: {
    id: 'kulaura',
    nameBn: 'কুলাউড়া',
    nameEn: 'Kulaura',
    code: 'KLA',
    coords: [92.0318, 24.5162],
    platformCount: 3,
  },
  sylhet: {
    id: 'sylhet',
    nameBn: 'সিলেট',
    nameEn: 'Sylhet',
    code: 'SYL',
    coords: [91.8697, 24.8898],
    platformCount: 4,
  },
  poradah: {
    id: 'poradah',
    nameBn: 'পোড়াদহ',
    nameEn: 'Poradah',
    code: 'PRD',
    coords: [89.0201, 23.9143],
    platformCount: 3,
  },
  jashore: {
    id: 'jashore',
    nameBn: 'যশোর',
    nameEn: 'Jashore',
    code: 'JSR',
    coords: [89.2182, 23.1634],
    platformCount: 3,
  },
  khulna: {
    id: 'khulna',
    nameBn: 'খুলনা',
    nameEn: 'Khulna',
    code: 'KLN',
    coords: [89.5582, 22.82],
    platformCount: 4,
  },
};

export const TRAINS: TrainDefinition[] = [
  {
    id: 'ekota-706',
    number: '706',
    nameBn: 'একতা এক্সপ্রেস',
    nameEn: 'Ekota Express',
    offDayBn: 'মঙ্গলবার নেই (সাপ্তাহিক বন্ধ নেই)',
    offDayEn: 'No Off Day',
    directionBn: 'দিনাজপুর → ঢাকা',
    directionEn: 'Dinajpur → Dhaka',
    coaches: ['চ', 'ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'dinajpur', arrival: '--', departure: '21:20', kmFromStart: 0 },
      { stationId: 'parbatipur', arrival: '21:55', departure: '22:15', kmFromStart: 30 },
      { stationId: 'birampur', arrival: '22:48', departure: '22:50', kmFromStart: 62 },
      { stationId: 'joypurhat', arrival: '23:25', departure: '23:28', kmFromStart: 96 },
      { stationId: 'akkelpur', arrival: '23:44', departure: '23:46', kmFromStart: 110 },
      { stationId: 'chhatian_gram', arrival: '23:58', departure: '00:00', kmFromStart: 122 },
      { stationId: 'santahar', arrival: '00:12', departure: '00:17', kmFromStart: 129.5 },
      { stationId: 'natore', arrival: '01:02', departure: '01:05', kmFromStart: 174 },
      { stationId: 'ullapara', arrival: '02:05', departure: '02:07', kmFromStart: 242 },
      { stationId: 'bbsetu_e', arrival: '02:35', departure: '02:38', kmFromStart: 270 },
      { stationId: 'tangail', arrival: '03:02', departure: '03:04', kmFromStart: 292 },
      { stationId: 'joydebpur', arrival: '04:05', departure: '04:08', kmFromStart: 356 },
      { stationId: 'airport', arrival: '04:32', departure: '04:35', kmFromStart: 374 },
      { stationId: 'dhaka', arrival: '05:10', departure: '--', kmFromStart: 392 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 465 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 892 },
      { classBn: 'এসি সিট', classEn: 'AC Seat', priceBdt: 1070 },
      { classBn: 'এসি বার্থ', classEn: 'AC Berth', priceBdt: 1605 },
    ],
    // Positioned right between আক্কেলপুর -> ছাতিয়ান গ্রাম -> সান্তাহার (matching screenshot!)
    initialProgress01: 0.305,
    initialSpeedKmh: 25,
    initialDelayMin: 53,
    initialLastPingSecAgo: 29,
  },
  {
    id: 'drutojan-757',
    number: '757',
    nameBn: 'দ্রুতযান এক্সপ্রেস',
    nameEn: 'Drutojan Express',
    offDayBn: 'বুধবার বন্ধ নেই',
    offDayEn: 'No Off Day',
    directionBn: 'ঢাকা → পঞ্চগড় / দিনাজপুর',
    directionEn: 'Dhaka → Dinajpur',
    coaches: ['চ', 'ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'dhaka', arrival: '--', departure: '20:45', kmFromStart: 0 },
      { stationId: 'airport', arrival: '21:12', departure: '21:17', kmFromStart: 18 },
      { stationId: 'joydebpur', arrival: '21:42', departure: '21:45', kmFromStart: 36 },
      { stationId: 'tangail', arrival: '22:48', departure: '22:50', kmFromStart: 100 },
      { stationId: 'bbsetu_e', arrival: '23:15', departure: '23:18', kmFromStart: 122 },
      { stationId: 'ullapara', arrival: '23:48', departure: '23:50', kmFromStart: 150 },
      { stationId: 'natore', arrival: '00:55', departure: '00:58', kmFromStart: 218 },
      { stationId: 'santahar', arrival: '01:45', departure: '01:50', kmFromStart: 263 },
      { stationId: 'akkelpur', arrival: '02:14', departure: '02:16', kmFromStart: 282 },
      { stationId: 'joypurhat', arrival: '02:32', departure: '02:35', kmFromStart: 296 },
      { stationId: 'parbatipur', arrival: '03:45', departure: '04:05', kmFromStart: 362 },
      { stationId: 'dinajpur', arrival: '04:40', departure: '--', kmFromStart: 392 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 465 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 892 },
      { classBn: 'এসি বার্থ', classEn: 'AC Berth', priceBdt: 1605 },
    ],
    initialProgress01: 0.42,
    initialSpeedKmh: 68,
    initialDelayMin: 12,
    initialLastPingSecAgo: 18,
  },
  {
    id: 'suborna-701',
    number: '701',
    nameBn: 'সুবর্ণ এক্সপ্রেস',
    nameEn: 'Suborna Express',
    offDayBn: 'সোমবার বন্ধ',
    offDayEn: 'Monday Off',
    directionBn: 'চট্টগ্রাম → ঢাকা',
    directionEn: 'Chattogram → Dhaka',
    coaches: ['ছ', 'চ', 'ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'chattogram', arrival: '--', departure: '07:30', kmFromStart: 0 },
      { stationId: 'feni', arrival: '08:48', departure: '08:50', kmFromStart: 92 },
      { stationId: 'laksam', arrival: '09:24', departure: '09:26', kmFromStart: 132 },
      { stationId: 'cumilla', arrival: '09:48', departure: '09:50', kmFromStart: 158 },
      { stationId: 'akhaura', arrival: '10:35', departure: '10:37', kmFromStart: 208 },
      { stationId: 'bhairab', arrival: '11:02', departure: '11:04', kmFromStart: 241 },
      { stationId: 'airport', arrival: '12:08', departure: '12:12', kmFromStart: 304 },
      { stationId: 'dhaka', arrival: '12:45', departure: '--', kmFromStart: 322 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 450 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 855 },
      { classBn: 'এসি সিট', classEn: 'AC Seat', priceBdt: 1025 },
    ],
    initialProgress01: 0.54,
    initialSpeedKmh: 76,
    initialDelayMin: 0,
    initialLastPingSecAgo: 14,
  },
  {
    id: 'sonar-bangla-788',
    number: '788',
    nameBn: 'সোনার বাংলা এক্সপ্রেস',
    nameEn: 'Sonar Bangla Express',
    offDayBn: 'মঙ্গলবার বন্ধ',
    offDayEn: 'Tuesday Off',
    directionBn: 'ঢাকা → চট্টগ্রাম',
    directionEn: 'Dhaka → Chattogram',
    coaches: ['ছ', 'চ', 'ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'dhaka', arrival: '--', departure: '07:00', kmFromStart: 0 },
      { stationId: 'airport', arrival: '07:25', departure: '07:30', kmFromStart: 18 },
      { stationId: 'narsingdi', arrival: '08:05', departure: '08:07', kmFromStart: 54 },
      { stationId: 'bhairab', arrival: '08:35', departure: '08:37', kmFromStart: 85 },
      { stationId: 'brahmanbaria', arrival: '08:55', departure: '08:57', kmFromStart: 103 },
      { stationId: 'cumilla', arrival: '09:50', departure: '09:52', kmFromStart: 164 },
      { stationId: 'feni', arrival: '10:36', departure: '10:38', kmFromStart: 230 },
      { stationId: 'chattogram', arrival: '12:00', departure: '--', kmFromStart: 322 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 450 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 855 },
      { classBn: 'এসি সিট', classEn: 'AC Seat', priceBdt: 1025 },
    ],
    initialProgress01: 0.36,
    initialSpeedKmh: 72,
    initialDelayMin: 8,
    initialLastPingSecAgo: 42,
  },
  {
    id: 'parabat-709',
    number: '709',
    nameBn: 'পারাবত এক্সপ্রেস',
    nameEn: 'Parabat Express',
    offDayBn: 'মঙ্গলবার বন্ধ',
    offDayEn: 'Tuesday Off',
    directionBn: 'ঢাকা → সিলেট',
    directionEn: 'Dhaka → Sylhet',
    coaches: ['ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'dhaka', arrival: '--', departure: '06:20', kmFromStart: 0 },
      { stationId: 'airport', arrival: '06:48', departure: '06:53', kmFromStart: 18 },
      { stationId: 'bhairab', arrival: '07:56', departure: '07:59', kmFromStart: 85 },
      { stationId: 'brahmanbaria', arrival: '08:20', departure: '08:22', kmFromStart: 103 },
      { stationId: 'shaistaganj', arrival: '09:24', departure: '09:27', kmFromStart: 164 },
      { stationId: 'sreemangal', arrival: '10:08', departure: '10:11', kmFromStart: 196 },
      { stationId: 'kulaura', arrival: '10:55', departure: '10:58', kmFromStart: 238 },
      { stationId: 'sylhet', arrival: '12:15', departure: '--', kmFromStart: 295 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 375 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 719 },
      { classBn: 'এসি সিট', classEn: 'AC Seat', priceBdt: 863 },
    ],
    initialProgress01: 0.62,
    initialSpeedKmh: 58,
    initialDelayMin: 19,
    initialLastPingSecAgo: 55,
  },
  {
    id: 'banalata-791',
    number: '791',
    nameBn: 'বনলতা এক্সপ্রেস',
    nameEn: 'Banalata Express',
    offDayBn: 'শুক্রবার বন্ধ',
    offDayEn: 'Friday Off',
    directionBn: 'ঢাকা → রাজশাহী',
    directionEn: 'Dhaka → Rajshahi',
    coaches: ['ছ', 'চ', 'ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'dhaka', arrival: '--', departure: '13:30', kmFromStart: 0 },
      { stationId: 'airport', arrival: '13:55', departure: '14:00', kmFromStart: 18 },
      { stationId: 'joydebpur', arrival: '14:22', departure: '14:24', kmFromStart: 36 },
      { stationId: 'bbsetu_e', arrival: '15:40', departure: '15:42', kmFromStart: 122 },
      { stationId: 'ishwardi_bp', arrival: '16:50', departure: '16:52', kmFromStart: 204 },
      { stationId: 'rajshahi', arrival: '17:50', departure: '--', kmFromStart: 265 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 375 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 719 },
    ],
    initialProgress01: 0.48,
    initialSpeedKmh: 82,
    initialDelayMin: 0,
    initialLastPingSecAgo: 11,
  },
  {
    id: 'chitra-763',
    number: '763',
    nameBn: 'চিত্রা এক্সপ্রেস',
    nameEn: 'Chitra Express',
    offDayBn: 'সোমবার বন্ধ',
    offDayEn: 'Monday Off',
    directionBn: 'খুলনা → ঢাকা',
    directionEn: 'Khulna → Dhaka',
    coaches: ['ঙ', 'ঘ', 'গ', 'খ', 'ক'],
    stops: [
      { stationId: 'khulna', arrival: '--', departure: '09:00', kmFromStart: 0 },
      { stationId: 'jashore', arrival: '09:58', departure: '10:02', kmFromStart: 56 },
      { stationId: 'poradah', arrival: '11:32', departure: '11:35', kmFromStart: 145 },
      { stationId: 'ishwardi_bp', arrival: '12:08', departure: '12:10', kmFromStart: 175 },
      { stationId: 'ullapara', arrival: '13:02', departure: '13:04', kmFromStart: 235 },
      { stationId: 'bbsetu_e', arrival: '13:34', departure: '13:36', kmFromStart: 263 },
      { stationId: 'tangail', arrival: '14:02', departure: '14:04', kmFromStart: 285 },
      { stationId: 'joydebpur', arrival: '15:02', departure: '15:05', kmFromStart: 349 },
      { stationId: 'dhaka', arrival: '16:05', departure: '--', kmFromStart: 385 },
    ],
    fares: [
      { classBn: 'শোভন চেয়ার', classEn: 'Shovon Chair', priceBdt: 505 },
      { classBn: 'স্নিগ্ধা (এসি)', classEn: 'Snigdha AC', priceBdt: 966 },
      { classBn: 'এসি বার্থ', classEn: 'AC Berth', priceBdt: 1737 },
    ],
    initialProgress01: 0.27,
    initialSpeedKmh: 64,
    initialDelayMin: 15,
    initialLastPingSecAgo: 35,
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    trainId: 'ekota-706',
    author: 'রাফি আহমেদ',
    coach: 'ক বগি',
    text: 'ট্রেন আক্কেলপুর ছেড়ে সান্তাহারের দিকে যাচ্ছে, ছাতিয়ান গ্রামের কাছাকাছি গতি কম।',
    createdAt: Date.now() - 180_000,
  },
  {
    id: 'msg-2',
    trainId: 'ekota-706',
    author: 'তানভীর হাসান',
    coach: 'গ বগি',
    text: 'আজকে প্রায় ৫০ মিনিটের মতো লেট আছে, সান্তাহারে ক্রসিং হতে পারে।',
    createdAt: Date.now() - 75_000,
  },
  {
    id: 'msg-3',
    trainId: 'suborna-701',
    author: 'সাব্বির রহমান',
    coach: 'খ বগি',
    text: 'সুবর্ণ এক্সপ্রেস আজ একদম রাইট টাইমে চলছে।',
    createdAt: Date.now() - 120_000,
  },
];

export const TRAVEL_GEAR_ITEMS: TravelGearItem[] = [
  {
    id: 'gear-powerbank',
    nameBn: 'ফাস্ট চার্জ ট্রাভেল পাওয়ারব্যাংক (20,000mAh)',
    nameEn: 'Fast Charge Travel Powerbank 20,000mAh',
    descBn: 'দীর্ঘ ট্রেন যাত্রায় লাইভ GPS ট্র্যাকিং ও ফোন চার্জের জন্য।',
    descEn: 'Reliable dual-port USB-C powerbank for long rail journeys.',
    priceBdt: 1850,
    categoryBn: 'ইলেকট্রনিক্স',
    categoryEn: 'Electronics',
  },
  {
    id: 'gear-pillow',
    nameBn: 'মেমোরি ফোম নেক পিলো',
    nameEn: 'Memory Foam Travel Neck Pillow',
    descBn: 'নাইট কোচ বা শোভন চেয়ার যাত্রায় আরামদায়ক ঘুমের জন্য।',
    descEn: 'Ergonomic neck support for overnight intercity trips.',
    priceBdt: 690,
    categoryBn: 'কমফোর্ট',
    categoryEn: 'Comfort',
  },
  {
    id: 'gear-lock',
    nameBn: 'টিএসএ কম্বিনেশন লাগেজ লক',
    nameEn: 'Heavy-Duty Combination Luggage Lock',
    descBn: 'স্টেশন ও ট্রেনে ব্যাগ নিরাপদ রাখতে টেকসই স্টিল তালা।',
    descEn: 'Braided steel cable lock for backpacks and suitcases.',
    priceBdt: 420,
    categoryBn: 'সুরক্ষা',
    categoryEn: 'Security',
  },
  {
    id: 'gear-flask',
    nameBn: 'থার্মাল স্টেইনলেস ফ্লাস্ক (৫০০মি.লি.)',
    nameEn: 'Insulated Stainless Flask 500ml',
    descBn: '১২ ঘণ্টা গরম বা ঠান্ডা পানি সংরক্ষণের জন্য উপযোগী।',
    descEn: 'Keeps water cold or tea hot up to 12 hours onboard.',
    priceBdt: 950,
    categoryBn: 'হাইড্রেশন',
    categoryEn: 'Hydration',
  },
];
