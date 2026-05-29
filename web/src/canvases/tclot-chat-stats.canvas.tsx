/*
 * TCLOT Chat Stats — End-of-season ESPN-style awards canvas.
 *
 * Source: WhatsApp export of "The TC League of Titans" group chat,
 * messages from 2025-08-01 through 2026-05-24.
 *
 * All stats are computed offline in /tmp/whatsapp-tc/analyze.py and
 * embedded below as constants. The component renders entirely client-
 * side with inline styles (no fetches, no npm deps).
 */

import React from 'react'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Finish = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

type Manager = {
  handle: string
  name: string
  short: string
  team: string
  finish: Finish
  msgs: number
  words: number
  avgWords: number
  medianWords: number
  longestLen: number
  longestSnippet: string
  longestDate: string
  pctOfTotal: number
  distinctDays: number
  msgsPerActiveDay: number
  oneWordPct: number
  capsPct: number
  questionPct: number
  exclaimPct: number
  urlPct: number
  mediaPct: number
  mostHour: number
  avgHour: number
  swears: number
  swearRate: number // per 100 msgs
  favSwear: string
  signatureWords: string[]
  signatureBigrams: string[]
}

const HEADLINE = {
  totalMessages: 42_321,
  totalWords: 284_173,
  firstDate: '2025-08-01',
  lastDate: '2026-05-24',
  daysSpan: 297,
  distinctDays: 296,
  avgMsgsPerDay: 142.5,
  busiestHourUTC: 13,
  busiestHourCount: 4453,
  busiestWeekday: 'Saturday',
  busiestWeekdayCount: 11_624,
  hourHistogram: [
    56, 110, 389, 372, 563, 682, 1301, 1670, 2826, 3471, 4051, 3532,
    3120, 4453, 3745, 3673, 4394, 2557, 631, 191, 195, 114, 120, 105,
  ],
  weekday: {
    Mon: 5860,
    Tue: 3105,
    Wed: 3916,
    Thu: 3094,
    Fri: 4564,
    Sat: 11_624,
    Sun: 10_158,
  } as Record<string, number>,
  totalSwears: 1944,
}

const MANAGERS: Manager[] = [
  {
    handle: 'Also Not My Champion',
    name: 'David Higman',
    short: 'Higman',
    team: 'Crouch End Oashisu',
    finish: 1,
    msgs: 4403,
    words: 29_661,
    avgWords: 6.74,
    medianWords: 5,
    longestLen: 796,
    longestSnippet:
      "I get the frustration, and I think you're pointing at a real transition pain rather than a one-off bad weekend…",
    longestDate: '2026-02-15',
    pctOfTotal: 10.4,
    distinctDays: 269,
    msgsPerActiveDay: 16.37,
    oneWordPct: 6.2,
    capsPct: 0.32,
    questionPct: 4.6,
    exclaimPct: 0.4,
    urlPct: 1.07,
    mediaPct: 7.1,
    mostHour: 13,
    avgHour: 11.71,
    swears: 189,
    swearRate: 4.29,
    favSwear: 'fuck',
    signatureWords: ['oasishu', 'evil', 'init', 'spuds', 'rattled', 'weasel'],
    signatureBigrams: ['united getting', 'always rated', 'north london', 'quite funny'],
  },
  {
    handle: "Mike 'Box Office' Sutton",
    name: 'Mike Sutton',
    short: 'Sutton',
    team: 'Clapton Cornershop',
    finish: 2,
    msgs: 523,
    words: 6380,
    avgWords: 12.2,
    medianWords: 9,
    longestLen: 625,
    longestSnippet:
      "What's not to understand? I evidently drafted the worst team, but with the fewest waivers have made up the biggest points difference based on the bench taking real Cornershop quality every week…",
    longestDate: '2026-03-24',
    pctOfTotal: 1.24,
    distinctDays: 159,
    msgsPerActiveDay: 3.29,
    oneWordPct: 3.4,
    capsPct: 0.19,
    questionPct: 12.4,
    exclaimPct: 5.2,
    urlPct: 0.76,
    mediaPct: 10.9,
    mostHour: 8,
    avgHour: 11.45,
    swears: 11,
    swearRate: 2.1,
    favSwear: 'shit',
    signatureWords: ['said', 'luck', 'lot', 'set', 'people'],
    signatureBigrams: ['toy story', 'luck sir', 'good luck'],
  },
  {
    handle: 'Andrew W',
    name: 'Andy Ward',
    short: 'Andy',
    team: 'Toronto Oizo',
    finish: 3,
    msgs: 8105,
    words: 50_107,
    avgWords: 6.18,
    medianWords: 5,
    longestLen: 689,
    longestSnippet:
      'TCLOT · GW 35 — Tri-Continental League of Titans, 2025-26 season — Brampton II Men vs Crouch End Oashisu…',
    longestDate: '2026-04-19',
    pctOfTotal: 19.15,
    distinctDays: 265,
    msgsPerActiveDay: 30.58,
    oneWordPct: 11.6,
    capsPct: 1.28,
    questionPct: 10.0,
    exclaimPct: 4.6,
    urlPct: 0.99,
    mediaPct: 8.2,
    mostHour: 16,
    avgHour: 13.35,
    swears: 381,
    swearRate: 4.7,
    favSwear: 'fuck',
    signatureWords: ['plz', 'goalie', 'intriguing', 'cleany', 'ada', 'hahahahaha'],
    signatureBigrams: ['live scores', 'anthony taylor', 'newly promoted', 'double game', 'head injury'],
  },
  {
    handle: 'Nick Goodacre',
    name: 'Nick Goodacre',
    short: 'Goodacre',
    team: 'Hanson of York AFC',
    finish: 4,
    msgs: 8061,
    words: 55_940,
    avgWords: 6.94,
    medianWords: 5,
    longestLen: 2832,
    longestSnippet:
      '🚨 COMMISSIONER RULING 🚨 — This court, presided over by myself, Commissioner Goodacre, has considered the charges brought against Edward Webster…',
    longestDate: '2025-09-28',
    pctOfTotal: 19.05,
    distinctDays: 279,
    msgsPerActiveDay: 28.89,
    oneWordPct: 11.0,
    capsPct: 4.34,
    questionPct: 4.5,
    exclaimPct: 2.1,
    urlPct: 0.68,
    mediaPct: 6.9,
    mostHour: 16,
    avgHour: 12.41,
    swears: 321,
    swearRate: 3.98,
    favSwear: 'fuck',
    signatureWords: ['gwk', 'pity', 'tmrw', 'aston', 'eurgh', 'newby'],
    signatureBigrams: ['meatloaf sc', 'clapton meatloaf', 'red black', 'goodacre guarantee'],
  },
  {
    handle: '~ Luke Butcher',
    name: 'Luke Butcher',
    short: 'Luke',
    team: 'Seoul Club 7',
    finish: 5,
    msgs: 4455,
    words: 35_117,
    avgWords: 7.88,
    medianWords: 6,
    longestLen: 716,
    longestSnippet:
      "Lets say it was innocent and reform just booked the venue and Farage just booked the room - they should've cancelled immediately on finding out who else was there…",
    longestDate: '2026-02-10',
    pctOfTotal: 10.53,
    distinctDays: 254,
    msgsPerActiveDay: 17.54,
    oneWordPct: 4.8,
    capsPct: 1.03,
    questionPct: 9.2,
    exclaimPct: 5.3,
    urlPct: 2.02,
    mediaPct: 4.3,
    mostHour: 10,
    avgHour: 10.51,
    swears: 136,
    swearRate: 3.05,
    favSwear: 'shit',
    signatureWords: ['wolt', 'leclerc', 'havent', 'lia', 'danger', 'im'],
    signatureBigrams: ['citeh players', 'pathetic effort', 'totally missed', 'im behind'],
  },
  {
    handle: 'Not My Champion',
    name: 'Nick Mottershead',
    short: 'Mottershead',
    team: 'Hackney Meat Loaf',
    finish: 6,
    msgs: 7134,
    words: 50_598,
    avgWords: 7.09,
    medianWords: 5,
    longestLen: 3014,
    longestSnippet:
      "*Tri-Continental League of Titans: Official Rules for 'The Jigsaw' Punishment* — The Jigsaw punishment is exclusively reserved for the individual who finishes in last place…",
    longestDate: '2025-08-08',
    pctOfTotal: 16.86,
    distinctDays: 263,
    msgsPerActiveDay: 27.13,
    oneWordPct: 12.6,
    capsPct: 1.22,
    questionPct: 7.7,
    exclaimPct: 1.3,
    urlPct: 0.1,
    mediaPct: 5.9,
    mostHour: 16,
    avgHour: 12.79,
    swears: 471,
    swearRate: 6.6,
    favSwear: 'fuck',
    signatureWords: ['meow', 'yeh', 'wardy', 'precisely', 'projected', 'biz'],
    signatureBigrams: ['top three', 'meow meow', 'jigsaw puzzle', 'gw come', 'luck gw'],
  },
  {
    handle: 'Jonathan Ward',
    name: 'Jon Ward',
    short: 'Jon',
    team: 'Morpeth Jamiroquai',
    finish: 7,
    msgs: 5975,
    words: 30_602,
    avgWords: 5.12,
    medianWords: 4,
    longestLen: 430,
    longestSnippet:
      "Hey chaps, small life update - just ripping the plaster off now & not expecting anyone to write a sonnet about it…",
    longestDate: '2026-01-12',
    pctOfTotal: 14.12,
    distinctDays: 285,
    msgsPerActiveDay: 20.96,
    oneWordPct: 12.3,
    capsPct: 1.19,
    questionPct: 13.0,
    exclaimPct: 3.0,
    urlPct: 2.49,
    mediaPct: 7.4,
    mostHour: 16,
    avgHour: 12.28,
    swears: 116,
    swearRate: 1.94,
    favSwear: 'fuck',
    signatureWords: ['tenjean', 'leaderboard', 'joao', 'ohh', 'whu', 'ahaha'],
    signatureBigrams: ['tenjean answers', 'norwich sunderland', 'tenjean leaderboard'],
  },
  {
    handle: "Eddy 'Tery' Webster",
    name: 'Eddy Webster',
    short: 'Eddy',
    team: 'Brampton II Men',
    finish: 8,
    msgs: 3657,
    words: 25_731,
    avgWords: 7.04,
    medianWords: 5,
    longestLen: 711,
    longestSnippet:
      "Ineos have been in for 2 years I think maybe a little under. I think the last 2 years specifically have shown an inability to recruit at any level…",
    longestDate: '2025-12-04',
    pctOfTotal: 8.64,
    distinctDays: 254,
    msgsPerActiveDay: 14.4,
    oneWordPct: 10.2,
    capsPct: 0.38,
    questionPct: 5.3,
    exclaimPct: 5.9,
    urlPct: 0.3,
    mediaPct: 5.2,
    mostHour: 13,
    avgHour: 12.86,
    swears: 319,
    swearRate: 8.72,
    favSwear: 'fuck',
    signatureWords: ['loose', 'yoro', 'stunning', 'horrible', 'realize', 'sickening'],
    signatureBigrams: ['doesn seem', 'bad luck', 'young players', 'didn realize', 'scored points'],
  },
]

type SwearFamily =
  | 'fuck' | 'shit' | 'cunt' | 'bastard' | 'twat' | 'prick' | 'bollocks'
  | 'wanker' | 'arse' | 'ass' | 'damn' | 'bitch' | 'dick' | 'piss'
  | 'shag' | 'bloody' | 'crap'

// Per-person swear-family breakdown (raw counts). Aggregate across the
// season; matches in /tmp/whatsapp-tc/stats.json.
const SWEARS: Record<string, Record<SwearFamily, number>> = {
  'Andy Ward':        { fuck: 195, shit: 94, cunt: 47, bastard: 2, twat: 6, prick: 4, bollocks: 0,  wanker: 9, arse: 4, ass: 0,  damn: 6, bitch: 3, dick: 5, piss: 2,  shag: 3,  bloody: 1,  crap: 0 },
  'Nick Goodacre':    { fuck: 127, shit: 93, cunt: 2,  bastard: 3, twat: 1, prick: 5, bollocks: 26, wanker: 7, arse: 6, ass: 0,  damn: 8, bitch: 5, dick: 3, piss: 5,  shag: 1,  bloody: 29, crap: 0 },
  'Jon Ward':         { fuck: 52,  shit: 16, cunt: 9,  bastard: 2, twat: 2, prick: 4, bollocks: 2,  wanker: 1, arse: 2, ass: 20, damn: 5, bitch: 0, dick: 0, piss: 1,  shag: 0,  bloody: 0,  crap: 0 },
  'Luke Butcher':     { fuck: 36,  shit: 60, cunt: 4,  bastard: 1, twat: 4, prick: 0, bollocks: 1,  wanker: 0, arse: 3, ass: 8,  damn: 6, bitch: 0, dick: 2, piss: 2,  shag: 0,  bloody: 8,  crap: 1 },
  'Eddy Webster':     { fuck: 194, shit: 75, cunt: 16, bastard: 2, twat: 2, prick: 2, bollocks: 1,  wanker: 3, arse: 2, ass: 6,  damn: 1, bitch: 1, dick: 1, piss: 7,  shag: 1,  bloody: 3,  crap: 2 },
  'Mike Sutton':      { fuck: 0,   shit: 6,  cunt: 0,  bastard: 0, twat: 0, prick: 0, bollocks: 1,  wanker: 0, arse: 0, ass: 0,  damn: 4, bitch: 0, dick: 0, piss: 0,  shag: 0,  bloody: 0,  crap: 0 },
  'Nick Mottershead': { fuck: 284, shit: 68, cunt: 34, bastard: 3, twat: 3, prick: 2, bollocks: 12, wanker: 8, arse: 10, ass: 1, damn: 6, bitch: 6, dick: 6, piss: 7,  shag: 15, bloody: 4,  crap: 2 },
  'David Higman':     { fuck: 80,  shit: 51, cunt: 24, bastard: 0, twat: 0, prick: 1, bollocks: 2,  wanker: 4, arse: 5, ass: 4,  damn: 0, bitch: 3, dick: 2, piss: 2,  shag: 4,  bloody: 0,  crap: 7 },
}

const TOP_UNIGRAMS: Array<[string, number]> = [
  ['what', 1315], ['goal', 1200], ['one', 962], ['good', 858], ['game', 748],
  ['who', 711],   ['how', 706],   ['don', 617], ['points', 554], ['win', 551],
  ['time', 537],  ['last', 512],  ['league', 500], ['when', 472], ['fuck', 435],
  ['team', 422],  ['play', 411],  ['fucking', 410], ['first', 391], ['really', 381],
  ['top', 373],   ['shit', 366],  ['players', 358], ['love', 339], ['great', 330],
  ['say', 328],   ['sc', 325],    ['after', 314], ['next', 312], ['week', 305],
]

const TOP_BIGRAMS: Array<[string, number]> = [
  ['west ham', 138], ['good luck', 90], ['clean sheet', 84], ['how many', 59],
  ['world cup', 59], ['best luck', 57], ['meatloaf sc', 55], ['fuck sake', 50],
  ['premier league', 49], ['man utd', 47], ['clapton meatloaf', 42], ['clapton sc', 41],
  ['last night', 38], ['draft fc', 38], ['points points', 37], ['cannot believe', 36],
  ['fucking hell', 36], ['sc meatloaf', 36], ['man city', 33], ['win league', 33],
  ['play offs', 33], ['lovely stuff', 32], ['what happened', 32], ['first time', 31],
  ['champions league', 30], ['half time', 30], ['stands clapton', 30], ['fa cup', 29],
  ['pts pts', 29], ['what doing', 28],
]

const TOP_TRIGRAMS: Array<[string, number]> = [
  ['clapton meatloaf sc', 31], ['clapton sc meatloaf', 28], ['good luck sir', 23],
  ['pts pts pts', 17], ['stands clapton sc', 17], ['red black red', 14],
  ['black red black', 14], ['points points points', 13], ['meow meow meow', 12],
  ['meatloaf clapton sc', 10], ['good luck champion', 10], ['stands clapton meatloaf', 10],
  ['points david points', 10], ['set piece coach', 9], ['keep clean sheet', 9],
  ['points andy points', 9], ['sc clapton meatloaf', 9], ['opportunity wish opponents', 8],
  ['la gran verguenza', 8], ['norwich sunderland burnley', 8], ['tenjean leaderboard rounds', 8],
  ['david points points', 8], ['points points andy', 8], ['points points david', 8],
  ['table stands clapton', 8],
]

const TOP_EMOJIS: Array<[string, number]> = [
  ['🤣', 580], ['🍑', 428], ['😂', 410], ['👀', 89], ['💩', 79],
  ['⚽', 68],  ['🚨', 39],  ['🤝', 27],  ['🍞', 23], ['🍆', 18],
  ['👍', 17],  ['🥶', 17],  ['😬', 17],  ['🥲', 15], ['🙌', 14],
]

const RECORDS = {
  biggestDay: { date: '2025-12-20', count: 740, winner: 'Andy Ward', winnerCount: 202 },
  longestGap: { days: 2, from: '2025-10-14', to: '2025-10-16' },
  longestStreak: { days: 221, from: '2025-10-16', to: '2026-05-24' },
  topSwearDay: { date: '2025-12-20', count: 41 },
  topDays: [
    ['2025-12-20', 740], ['2025-11-30', 633], ['2025-11-01', 594],
    ['2026-01-07', 580], ['2026-05-13', 579], ['2025-11-29', 522],
    ['2025-08-30', 513], ['2025-08-31', 506], ['2025-08-17', 503],
    ['2025-09-14', 500],
  ] as Array<[string, number]>,
  biggestDayPerPerson: {
    'Andy Ward':        { date: '2025-12-20', count: 202 },
    'Nick Goodacre':    { date: '2025-11-30', count: 138 },
    'Jon Ward':         { date: '2025-12-20', count: 95 },
    'Luke Butcher':     { date: '2026-02-10', count: 92 },
    'Eddy Webster':     { date: '2025-12-20', count: 79 },
    'Mike Sutton':      { date: '2026-03-24', count: 28 },
    'Nick Mottershead': { date: '2025-12-20', count: 178 },
    'David Higman':     { date: '2025-12-20', count: 96 },
  } as Record<string, { date: string; count: number }>,
}

type Claim = {
  date: string
  who: string
  team: string
  text: string
  verdict: string
  tag: 'wrong' | 'right' | 'mixed'
}

// Hand-curated from claim_candidates in stats.json — quotes are verbatim.
const CLAIMS: Claim[] = [
  {
    date: '2025-08-01',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'But I am telling you now that His Majesties Loaf are going to be running rampant',
    verdict: 'HaMeLo finished 6th. Rampant is a strong word for "below mid".',
    tag: 'wrong',
  },
  {
    date: '2025-08-01',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'Live, Laugh, Loaf',
    verdict: 'More like Live, Laugh, 6th.',
    tag: 'wrong',
  },
  {
    date: '2025-09-01',
    who: 'Jon Ward',
    team: 'Morpeth Jamiroquai',
    text: 'Liverpool should win the league for the next 5 years 😂😂',
    verdict: 'Liverpool not winning this one. Five-year dynasty filed under "Fraud Train".',
    tag: 'wrong',
  },
  {
    date: '2025-09-01',
    who: 'Andy Ward',
    team: 'Toronto Oizo',
    text: 'Ekitike is a fraud',
    verdict: 'Take of the season. Andy still finished 3rd.',
    tag: 'mixed',
  },
  {
    date: '2025-08-31',
    who: 'Andy Ward',
    team: 'Toronto Oizo',
    text: 'Higman still on the Liverpool fraud train?',
    verdict: 'Higman rode that train all the way to the title.',
    tag: 'wrong',
  },
  {
    date: '2025-09-14',
    who: 'Jon Ward',
    team: 'Morpeth Jamiroquai',
    text: 'Oashisu will get the highest GW score this season',
    verdict: 'Correct AND oashisu won the league. Jon was right once.',
    tag: 'right',
  },
  {
    date: '2025-10-27',
    who: 'Andy Ward',
    team: 'Toronto Oizo',
    text: "For me Oashisu clear favs as Liverpool should sort themselves out, Palmer isn't even playing and Arsenal cleanies are going to happen at least 1/3 of games",
    verdict: 'Called the champion in October. Andy was the only one who saw it.',
    tag: 'right',
  },
  {
    date: '2025-11-07',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: "It's why Oashisu won't win the league",
    verdict: 'Famous last words. Oashisu lifted the trophy. Loaf lifted the puzzle.',
    tag: 'wrong',
  },
  {
    date: '2025-11-29',
    who: 'Andy Ward',
    team: 'Toronto Oizo',
    text: "I rate Morpeth's chances of winning the league at 0/10",
    verdict: 'Brutal. Correct. Jon finished 7th.',
    tag: 'right',
  },
  {
    date: '2025-12-03',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'Not winning the title now would officially be a bottle job',
    verdict: 'Bottle job confirmed. He went on to finish 6th. We are filing this under Code Bottle.',
    tag: 'wrong',
  },
  {
    date: '2025-12-06',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'I swear this time last week I would have been prepared to put a £1000 bet on Loaf winning the league. Now, I am thinking about puzzle practice',
    verdict: 'Wisely held the £1000. Foolishly did not commit to puzzle practice — Eddy got the jigsaw.',
    tag: 'mixed',
  },
  {
    date: '2025-12-08',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'Win December - Win the League',
    verdict: 'Did not win December. Did not win the league. Method, validated.',
    tag: 'wrong',
  },
  {
    date: '2025-12-20',
    who: 'Andy Ward',
    team: 'Toronto Oizo',
    text: 'DCL is winning the league',
    verdict: 'DCL was on the team of the league\'s last-place finisher (Eddy). Cosmically wrong.',
    tag: 'wrong',
  },
  {
    date: '2026-01-31',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'FUCK OFF SUTTON YOU FERTILE FRAUD',
    verdict: 'The Fertile Fraud finished 2nd. Loaf finished 6th. The fraud was elsewhere.',
    tag: 'wrong',
  },
  {
    date: '2026-02-21',
    who: 'Nick Mottershead',
    team: 'Hackney Meat Loaf',
    text: 'Was saying to Sutton earlier today, "I reckon I will still win the league you know."',
    verdict: 'He did not. He very much did not.',
    tag: 'wrong',
  },
  {
    date: '2026-05-09',
    who: 'Jon Ward',
    team: 'Morpeth Jamiroquai',
    text: 'Having Haaland and not winning the league should be considered a failure',
    verdict: 'Sutton had Haaland and finished 2nd. By Jon\'s own rule — failure. Jon (7th) qualifies as a worse failure.',
    tag: 'mixed',
  },
  {
    date: '2026-05-09',
    who: 'David Higman',
    team: 'Crouch End Oashisu',
    text: 'Can you say "no way oasishu win the title"',
    verdict: 'Champion\'s flex. He could not be silenced. He should not be silenced.',
    tag: 'right',
  },
]

type InJoke = {
  name: string
  count: number
  firstDate: string
  by: string
  example: string
}

const INJOKES: InJoke[] = [
  {
    name: 'Fraud / Fraudster',
    count: 198,
    firstDate: '2025-08-16',
    by: 'Nick Mottershead',
    example: 'Potter = fraud',
  },
  {
    name: "Live, Laugh, Loaf",
    count: 6,
    firstDate: '2025-08-01',
    by: 'Nick Mottershead',
    example: 'Live, Laugh, Loaf',
  },
  {
    name: 'HaMeLo',
    count: 14,
    firstDate: '2025-08-01',
    by: 'Nick Mottershead',
    example: 'HaMeLo to some of the fans',
  },
  {
    name: 'The Jigsaw',
    count: 47,
    firstDate: '2025-08-05',
    by: 'Eddy Webster',
    example: 'Minus the Jigsaw',
  },
  {
    name: '"I\'d like to take this opportunity to wish my opponents…"',
    count: 9,
    firstDate: '2025-08-22',
    by: 'Nick Mottershead',
    example: "I'd like to take this opportunity to wish my opponents - Hanson of York AFC - the very best of luck in the GW to come…",
  },
  {
    name: '🍑 (the bench-pick / boom emoji)',
    count: 428,
    firstDate: '2025-08-15',
    by: 'Nick Mottershead',
    example: 'Mac Allister 🍑 (maybe)',
  },
  {
    name: 'Long throw discourse',
    count: 84,
    firstDate: '2025-08-04',
    by: 'Nick Goodacre',
    example: 'I must I\'m a huge fan that the long throw is starting to creep back into football. Such an under utilised threat',
  },
  {
    name: 'Goodacre Guarantee™',
    count: 12,
    firstDate: '2026-01-18',
    by: 'Nick Goodacre',
    example: "It's a Goodacre guarantee that Brighton will score",
  },
  {
    name: '🚨 COMMISSIONER RULING 🚨 (vs Eddy)',
    count: 4,
    firstDate: '2025-09-28',
    by: 'Nick Goodacre',
    example: 'COMMISSIONER RULING — court charging Edward Webster with cheating, specifically with improperly acquiring two players, Dominic Calvert-Lewin and Bafode Diakite, from the waiver wire when they were not permitted…',
  },
  {
    name: 'Meow meow meow',
    count: 17,
    firstDate: '2025-10-18',
    by: 'Nick Mottershead',
    example: 'Impossible to see this and not automatically start saying, "Meow meow meow meow meow meow meow meow meow meow meow meow meow meow…"',
  },
]

type Superlative = {
  title: string
  winner: string
  stat: string
}

const SUPERLATIVES: Superlative[] = [
  { title: 'Spammer of the Year', winner: 'Andy Ward', stat: '8,105 messages · 19.15% of the chat · 30.6/active day' },
  { title: 'Word Salad Chef', winner: 'Nick Goodacre', stat: '55,940 words (most in the chat)' },
  { title: 'King of Swears', winner: 'Nick Mottershead', stat: '471 swears · 6.6 per 100 msgs · favourite: "fuck" ×284' },
  { title: 'F-Rate Champion (per-100-msg)', winner: 'Eddy Webster', stat: '8.72 swears per 100 messages — peak rage density' },
  { title: 'Loudest in the Room (CAPS)', winner: 'Nick Goodacre', stat: '4.34% of messages are ALL-CAPS — 3× the next person' },
  { title: 'Most Likely to Send One Word', winner: 'Nick Mottershead', stat: '12.6% of messages are a single word' },
  { title: 'Question Asker', winner: 'Jon Ward', stat: '13.0% of messages contain "?" — chat\'s curiosity engine' },
  { title: 'Exclaimer-in-Chief', winner: 'Eddy Webster', stat: '5.9% exclaim rate — Tery yells in chat too' },
  { title: 'Link Slinger', winner: 'Jon Ward', stat: '2.49% URL rate — busiest poster of articles' },
  { title: 'Media Mogul', winner: 'Mike Sutton', stat: '10.9% of his (rare) messages are images/GIFs/video' },
  { title: 'Night Owl', winner: 'Andy Ward', stat: 'Latest avg hour (13.35 UTC ≈ Toronto morning into UK evening)' },
  { title: 'Early Bird', winner: 'Luke Butcher', stat: 'Earliest avg hour (10.51 UTC — Seoul-time after-work poster)' },
  { title: 'Quietest in Defeat', winner: 'Mike Sutton', stat: 'Only 523 messages all season — finished 2nd anyway' },
  { title: 'Best at Being Right', winner: 'Andy Ward', stat: "Called Oashisu as champs back in October: 'For me Oashisu clear favs as Liverpool should sort themselves out'" },
  { title: 'Best at Being Wrong', winner: 'Nick Mottershead', stat: '"Not winning the title now would officially be a bottle job" (Dec 3) → finished 6th' },
  { title: 'Champion of Confidence', winner: 'David Higman', stat: "'Can you say no way oasishu win the title' — May 9, then did exactly that" },
  { title: 'Longest Single Message', winner: 'Nick Mottershead', stat: '3,014 characters — the official Jigsaw rulebook' },
  { title: 'Court Justice Award', winner: 'Nick Goodacre', stat: "2,832-char COMMISSIONER RULING vs Eddy over DCL/Diakite waiver heist" },
  { title: 'Most Days Active', winner: 'Jon Ward', stat: '285 of 297 days — quiet but constant' },
  { title: 'Catchphrase Hall of Fame', winner: 'Nick Mottershead', stat: '"I\'d like to take this opportunity to wish my opponents…" — used 9 times' },
]

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const PALETTE = {
  bg: 'var(--tclot-bg)',
  surface: 'var(--tclot-surface)',
  surface2: 'var(--tclot-surface-2)',
  border: 'var(--tclot-border)',
  text: 'var(--tclot-text)',
  muted: 'var(--tclot-muted)',
  accent: 'var(--tclot-accent)',
  accentSoft: 'var(--tclot-accent-soft)',
  good: 'var(--tclot-good)',
  bad: 'var(--tclot-bad)',
  mixed: 'var(--tclot-mixed)',
}

function ThemeVars() {
  // Inject CSS vars + light/dark via prefers-color-scheme. Inline so the
  // canvas remains a single self-contained file.
  return (
    <style>{`
      :root {
        --tclot-bg: #fafaf7;
        --tclot-surface: #ffffff;
        --tclot-surface-2: #f3f1ec;
        --tclot-border: #e5e2dc;
        --tclot-text: #1b1b1a;
        --tclot-muted: #6e6a62;
        --tclot-accent: #b03a2e;
        --tclot-accent-soft: #f4dbd6;
        --tclot-good: #2e7d32;
        --tclot-bad: #b03a2e;
        --tclot-mixed: #8a6d00;
        --tclot-grid: #ece8e0;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --tclot-bg: #14130f;
          --tclot-surface: #1d1c18;
          --tclot-surface-2: #25231e;
          --tclot-border: #2f2c25;
          --tclot-text: #f0ece2;
          --tclot-muted: #9a9384;
          --tclot-accent: #e07a6d;
          --tclot-accent-soft: #3a221e;
          --tclot-good: #7ac17a;
          --tclot-bad: #e07a6d;
          --tclot-mixed: #d8b760;
          --tclot-grid: #2a2822;
        }
      }
      .tclot-root *::selection { background: var(--tclot-accent-soft); color: var(--tclot-text); }
    `}</style>
  )
}

const card: React.CSSProperties = {
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 10,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: PALETTE.muted,
  marginBottom: 12,
  fontWeight: 600,
}

const h2: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: PALETTE.text,
  margin: 0,
}

const subtle: React.CSSProperties = { color: PALETTE.muted, fontSize: 13 }

const numberBig: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: PALETTE.text,
  lineHeight: 1.1,
}

// ---------------------------------------------------------------------------
// Small visual primitives
// ---------------------------------------------------------------------------

function MetricTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ ...subtle, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={numberBig}>{value}</div>
      {sub ? <div style={{ ...subtle, marginTop: 6 }}>{sub}</div> : null}
    </div>
  )
}

function BarRow({ label, value, max, valueLabel, color }: { label: React.ReactNode; value: number; max: number; valueLabel?: React.ReactNode; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div style={{ color: PALETTE.text, fontSize: 14 }}>{label}</div>
      <div style={{ height: 10, background: PALETTE.surface2, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color ?? PALETTE.accent }} />
      </div>
      <div style={{ textAlign: 'right', color: PALETTE.muted, fontSize: 13 }}>{valueLabel ?? value.toLocaleString()}</div>
    </div>
  )
}

function HourHeatmap() {
  const max = Math.max(...HEADLINE.hourHistogram)
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Messages by hour (UTC)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 4 }}>
        {HEADLINE.hourHistogram.map((c, h) => {
          const intensity = c / max
          // Use accent at varying opacity
          return (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                title={`${h}:00 UTC · ${c.toLocaleString()} msgs`}
                style={{
                  width: '100%',
                  height: 64,
                  background: PALETTE.surface2,
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    height: `${intensity * 100}%`,
                    background: PALETTE.accent,
                    opacity: 0.55 + 0.45 * intensity,
                  }}
                />
              </div>
              <div style={{ fontSize: 9, color: PALETTE.muted }}>{h.toString().padStart(2, '0')}</div>
            </div>
          )
        })}
      </div>
      <div style={{ ...subtle, marginTop: 10 }}>
        Peak: <strong style={{ color: PALETTE.text }}>{HEADLINE.busiestHourUTC.toString().padStart(2, '0')}:00 UTC</strong> ({HEADLINE.busiestHourCount.toLocaleString()} msgs). The dip around 18–24 UTC is the UK overnight; Andy in Toronto and Luke in Seoul keep the lights flickering.
      </div>
    </div>
  )
}

function WeekdayBars() {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const max = Math.max(...order.map((d) => HEADLINE.weekday[d]))
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Messages by weekday</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, alignItems: 'end', height: 140 }}>
        {order.map((d) => {
          const c = HEADLINE.weekday[d]
          const h = (c / max) * 120
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ ...subtle, fontSize: 11 }}>{c.toLocaleString()}</div>
              <div title={`${d} · ${c.toLocaleString()}`} style={{ width: '100%', height: h, background: d === 'Sat' || d === 'Sun' ? PALETTE.accent : PALETTE.surface2, border: `1px solid ${PALETTE.border}`, borderRadius: 4 }} />
              <div style={{ fontSize: 11, color: PALETTE.text }}>{d}</div>
            </div>
          )
        })}
      </div>
      <div style={{ ...subtle, marginTop: 8 }}>
        Saturday is the league's heartbeat — {HEADLINE.busiestWeekdayCount.toLocaleString()} messages, more than Mon+Tue+Wed combined.
      </div>
    </div>
  )
}

function FinishBadge({ finish }: { finish: Finish }) {
  const colors: Record<Finish, string> = {
    1: '#c8a23a', // gold
    2: '#a8a8a8', // silver
    3: '#b07c4a', // bronze
    4: PALETTE.muted, 5: PALETTE.muted, 6: PALETTE.muted, 7: PALETTE.muted, 8: PALETTE.muted,
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: 11,
      background: colors[finish], color: '#1b1b1a',
      fontSize: 11, fontWeight: 700,
    }}>{finish}</span>
  )
}

function ManagerScoreboard() {
  const maxMsgs = Math.max(...MANAGERS.map((m) => m.msgs))
  const sorted = [...MANAGERS].sort((a, b) => b.msgs - a.msgs)
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 6px' }}>
        <div style={sectionTitle}>The Eight</div>
        <h2 style={h2}>Per-manager scoreboard</h2>
        <div style={{ ...subtle, marginTop: 4 }}>Ranked by message count. Finish = final league position.</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: PALETTE.muted, borderBottom: `1px solid ${PALETTE.border}` }}>
              <th style={{ padding: '10px 16px' }}>#</th>
              <th style={{ padding: '10px 16px' }}>Manager · Team</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Msgs</th>
              <th style={{ padding: '10px 8px' }}>Share</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Words</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Avg w/msg</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Median</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Days</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Per active day</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Longest msg</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.name} style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
                <td style={{ padding: '12px 16px' }}><FinishBadge finish={m.finish} /></td>
                <td style={{ padding: '12px 16px', color: PALETTE.text }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ ...subtle, fontSize: 12 }}>{m.team}</div>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: PALETTE.text }}>{m.msgs.toLocaleString()}</td>
                <td style={{ padding: '12px 8px', minWidth: 140 }}>
                  <div style={{ height: 6, background: PALETTE.surface2, borderRadius: 4 }}>
                    <div style={{ width: `${(m.msgs / maxMsgs) * 100}%`, height: '100%', background: PALETTE.accent, borderRadius: 4 }} />
                  </div>
                  <div style={{ ...subtle, fontSize: 11, marginTop: 4 }}>{m.pctOfTotal}%</div>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.words.toLocaleString()}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.avgWords}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.medianWords}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.distinctDays}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.msgsPerActiveDay}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>{m.longestLen} ch</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LongestSnippets() {
  const sorted = [...MANAGERS].sort((a, b) => b.longestLen - a.longestLen).slice(0, 4)
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Magnum opus per manager</div>
      <h2 style={h2}>Longest single messages</h2>
      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        {sorted.map((m) => (
          <div key={m.name} style={{ borderLeft: `3px solid ${PALETTE.accent}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 13, color: PALETTE.text, fontWeight: 600 }}>{m.name} <span style={subtle}>· {m.longestLen} chars · {m.longestDate}</span></div>
            <div style={{ ...subtle, fontSize: 13, marginTop: 4 }}>{m.longestSnippet}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SwearLeaderboard() {
  const sorted = [...MANAGERS].sort((a, b) => b.swears - a.swears)
  const maxTotal = Math.max(...sorted.map((m) => m.swears))
  const maxRate = Math.max(...sorted.map((m) => m.swearRate))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
      <div style={{ ...card }}>
        <div style={sectionTitle}>Foul Mouth Open · Total</div>
        <h2 style={h2}>King of swears: Mottershead</h2>
        <div style={{ ...subtle, marginTop: 4 }}>Total occurrences across 17 swear families (word-boundary, case-insensitive).</div>
        <div style={{ marginTop: 14 }}>
          {sorted.map((m) => (
            <BarRow key={m.name} label={<span><strong style={{ color: PALETTE.text }}>{m.name}</strong> <span style={{ color: PALETTE.muted, fontSize: 12 }}>· fav: {m.favSwear}</span></span>} value={m.swears} max={maxTotal} />
          ))}
        </div>
      </div>
      <div style={{ ...card }}>
        <div style={sectionTitle}>Foul Mouth Open · Density</div>
        <h2 style={h2}>Per 100 messages</h2>
        <div style={{ ...subtle, marginTop: 4 }}>Eddy posts less but each message punches harder.</div>
        <div style={{ marginTop: 14 }}>
          {[...MANAGERS].sort((a, b) => b.swearRate - a.swearRate).map((m) => (
            <BarRow key={m.name} label={<strong style={{ color: PALETTE.text }}>{m.name}</strong>} value={m.swearRate} max={maxRate} valueLabel={m.swearRate.toFixed(2)} />
          ))}
        </div>
        <div style={{ ...subtle, marginTop: 14, fontSize: 12, borderTop: `1px solid ${PALETTE.border}`, paddingTop: 12 }}>
          <strong style={{ color: PALETTE.text }}>Foulest day of the season:</strong> {RECORDS.topSwearDay.date} — {RECORDS.topSwearDay.count} swears in one day (coincides with the biggest message day overall).
        </div>
      </div>
    </div>
  )
}

function SwearMatrix() {
  // Top 8 most-used families across the league, render a heat-table.
  const totals: Record<SwearFamily, number> = { fuck: 0, shit: 0, cunt: 0, bastard: 0, twat: 0, prick: 0, bollocks: 0, wanker: 0, arse: 0, ass: 0, damn: 0, bitch: 0, dick: 0, piss: 0, shag: 0, bloody: 0, crap: 0 }
  for (const p of Object.values(SWEARS)) {
    for (const k in p) totals[k as SwearFamily] += p[k as SwearFamily]
  }
  const families = (Object.keys(totals) as SwearFamily[]).sort((a, b) => totals[b] - totals[a]).slice(0, 10)
  const max = Math.max(...families.flatMap((f) => Object.values(SWEARS).map((p) => p[f])))
  const order = [...MANAGERS].sort((a, b) => b.swears - a.swears).map((m) => m.name)
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Swear-family heat-map</div>
      <h2 style={h2}>Who says what</h2>
      <div style={{ ...subtle, marginTop: 4 }}>Per-person counts of the 10 most-used swear families.</div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: PALETTE.muted }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Manager</th>
              {families.map((f) => <th key={f} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>{f}</th>)}
              <th style={{ padding: '6px 8px', textAlign: 'right', color: PALETTE.text }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.map((name) => {
              const row = SWEARS[name]
              const total = Object.values(row).reduce((a, b) => a + b, 0)
              return (
                <tr key={name} style={{ borderTop: `1px solid ${PALETTE.border}` }}>
                  <td style={{ padding: '6px 8px', color: PALETTE.text, fontWeight: 600 }}>{name}</td>
                  {families.map((f) => {
                    const v = row[f]
                    const intensity = v === 0 ? 0 : 0.15 + (v / max) * 0.85
                    return (
                      <td key={f} style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: v > 0 ? PALETTE.text : PALETTE.muted,
                        background: v > 0 ? `color-mix(in srgb, ${PALETTE.accent} ${Math.round(intensity * 70)}%, transparent)` : 'transparent',
                      }}>{v}</td>
                    )
                  })}
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: PALETTE.text, fontWeight: 600 }}>{total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NgramColumns() {
  const Section = ({ title, items, color }: { title: string; items: Array<[string, number]>; color?: string }) => {
    const max = Math.max(...items.map(([, c]) => c))
    return (
      <div style={{ ...card, height: '100%' }}>
        <div style={sectionTitle}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, marginTop: 8 }}>
          {items.slice(0, 20).map(([w, c]) => (
            <div key={w + c} style={{ display: 'grid', gridTemplateColumns: '1fr 50px', alignItems: 'center', gap: 8, padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: PALETTE.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>{w}</span>
                <div style={{ flex: 1, height: 4, background: PALETTE.surface2, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(c / max) * 100}%`, height: '100%', background: color ?? PALETTE.accent }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', color: PALETTE.muted, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={sectionTitle}>The Lexicon</div>
        <h2 style={h2}>What 296 days of chat actually sounded like</h2>
        <div style={{ ...subtle, marginTop: 4 }}>Stopwords, URLs, "image omitted", @mentions and contractions stripped. Words shown after cleaning.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Section title="Top unigrams" items={TOP_UNIGRAMS} />
        <Section title="Top bigrams" items={TOP_BIGRAMS} />
        <Section title="Top trigrams" items={TOP_TRIGRAMS} />
      </div>
    </div>
  )
}

function SignaturePhrases() {
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Vocal fingerprints</div>
      <h2 style={h2}>Signature words & phrases per manager</h2>
      <div style={{ ...subtle, marginTop: 4 }}>Words & bigrams each manager uses far more often than the rest of the league (weighted by relative rate, min 8 uses).</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
        {MANAGERS.map((m) => (
          <div key={m.name} style={{ background: PALETTE.surface2, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ color: PALETTE.text, fontWeight: 600, fontSize: 14 }}>{m.name}</div>
            <div style={{ ...subtle, fontSize: 12 }}>{m.team}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ ...subtle, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Words</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {m.signatureWords.map((w) => (
                  <span key={w} style={{
                    background: PALETTE.accentSoft, color: PALETTE.text, fontSize: 11,
                    padding: '2px 6px', borderRadius: 4, fontFamily: 'ui-monospace, Menlo, monospace',
                  }}>{w}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ ...subtle, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bigrams</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                {m.signatureBigrams.map((b) => (
                  <span key={b} style={{ color: PALETTE.text, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace' }}>"{b}"</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VolumeRecords() {
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Records & extremes</div>
      <h2 style={h2}>Volume & rhythm</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
        <MetricTile label="Biggest single day" value={`${RECORDS.biggestDay.count}`} sub={`${RECORDS.biggestDay.date} · won by ${RECORDS.biggestDay.winner} (${RECORDS.biggestDay.winnerCount} of ${RECORDS.biggestDay.count})`} />
        <MetricTile label="Longest silent gap" value={`${RECORDS.longestGap.days} days`} sub={`${RECORDS.longestGap.from} → ${RECORDS.longestGap.to} (and that's it — 2 days, all season)`} />
        <MetricTile label="Longest active streak" value={`${RECORDS.longestStreak.days} days`} sub={`${RECORDS.longestStreak.from} → ${RECORDS.longestStreak.to} (running through final whistle)`} />
        <MetricTile label="Loudest swear day" value={`${RECORDS.topSwearDay.count} swears`} sub={`${RECORDS.topSwearDay.date}`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <div style={sectionTitle}>Top 10 chattiest days</div>
          {(() => {
            const max = RECORDS.topDays[0][1]
            return RECORDS.topDays.map(([d, c]) => (
              <BarRow key={d} label={d} value={c} max={max} />
            ))
          })()}
        </div>
        <div>
          <div style={sectionTitle}>Biggest day per manager</div>
          {Object.entries(RECORDS.biggestDayPerPerson)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([name, info]) => (
              <BarRow key={name} label={<span><strong style={{ color: PALETTE.text }}>{name}</strong> <span style={{ color: PALETTE.muted, fontSize: 12 }}>· {info.date}</span></span>} value={info.count} max={RECORDS.biggestDayPerPerson['Andy Ward'].count} />
            ))}
        </div>
      </div>
      <div style={{ ...subtle, marginTop: 12, borderTop: `1px solid ${PALETTE.border}`, paddingTop: 12, fontSize: 13 }}>
        December 20, 2025 is the chat's Mt. Olympus: 740 messages, 41 swears, and 6 of 8 managers logged their personal busiest day on it. Andy alone fired off 202.
      </div>
    </div>
  )
}

function Claims() {
  const verdictColor = (t: Claim['tag']) => (t === 'right' ? PALETTE.good : t === 'wrong' ? PALETTE.bad : PALETTE.mixed)
  const verdictLabel = (t: Claim['tag']) => (t === 'right' ? 'CORRECT' : t === 'wrong' ? 'WRONG' : 'MIXED')
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>The hot takes desk</div>
      <h2 style={h2}>Wildest claims, judged against the final table</h2>
      <div style={{ ...subtle, marginTop: 4 }}>
        Final standings: 1 Higman · 2 Sutton · 3 Andy · 4 Goodacre · 5 Luke · 6 Mottershead · 7 Jon · 8 Eddy. Quotes are verbatim.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        {CLAIMS.map((c) => (
          <div key={c.date + c.who + c.text.slice(0, 24)} style={{
            background: PALETTE.surface2,
            border: `1px solid ${PALETTE.border}`,
            borderLeft: `4px solid ${verdictColor(c.tag)}`,
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.45 }}>
              "{c.text}"
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
              <div style={subtle}><strong style={{ color: PALETTE.text }}>{c.who}</strong> · {c.team} · {c.date}</div>
              <div style={{ color: verdictColor(c.tag), fontWeight: 700, letterSpacing: '0.05em' }}>{verdictLabel(c.tag)}</div>
            </div>
            <div style={{ ...subtle, marginTop: 8, fontSize: 12.5, fontStyle: 'italic' }}>{c.verdict}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InJokes() {
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Inside the bubble</div>
      <h2 style={h2}>In-jokes & recurring memes</h2>
      <div style={{ ...subtle, marginTop: 4 }}>Counts are season totals. "First" is the earliest reference in the chat.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        {INJOKES.map((j) => (
          <div key={j.name} style={{
            background: PALETTE.surface2, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ color: PALETTE.text, fontWeight: 600 }}>{j.name}</div>
              <div style={{ color: PALETTE.accent, fontWeight: 700, fontSize: 16 }}>{j.count}</div>
            </div>
            <div style={{ ...subtle, fontSize: 12, marginTop: 4 }}>First: {j.firstDate} · {j.by}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: PALETTE.text, fontStyle: 'italic' }}>"{j.example}"</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Emojis() {
  const max = TOP_EMOJIS[0][1]
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>Pictograms</div>
      <h2 style={h2}>Top emojis in message text</h2>
      <div style={{ ...subtle, marginTop: 4 }}>WhatsApp reactions don't appear in exports, so only literal emoji inside messages.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 14 }}>
        {TOP_EMOJIS.map(([e, c]) => (
          <div key={e} style={{ background: PALETTE.surface2, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>{e}</div>
            <div style={{ color: PALETTE.text, fontWeight: 600, marginTop: 6 }}>{c.toLocaleString()}</div>
            <div style={{ height: 4, background: 'transparent', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(c / max) * 100}%`, height: '100%', background: PALETTE.accent }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...subtle, marginTop: 12, fontSize: 13 }}>
        Three weird flexes: 🍑 (428) is the league's bench-pick / "boom" emoji, started by Mottershead in mid-August;
        💩 (79) is the universal fantasy-football review; 🍞 (23) is the official HaMeLo seal.
      </div>
    </div>
  )
}

function Fingerprints() {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 6px' }}>
        <div style={sectionTitle}>How they type</div>
        <h2 style={h2}>Communication-style fingerprint</h2>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'right', color: PALETTE.muted, borderBottom: `1px solid ${PALETTE.border}` }}>
              <th style={{ padding: '10px 16px', textAlign: 'left' }}>Manager</th>
              <th style={{ padding: '10px 8px' }}>Avg w/msg</th>
              <th style={{ padding: '10px 8px' }}>One-word %</th>
              <th style={{ padding: '10px 8px' }}>CAPS %</th>
              <th style={{ padding: '10px 8px' }}>? %</th>
              <th style={{ padding: '10px 8px' }}>! %</th>
              <th style={{ padding: '10px 8px' }}>Link %</th>
              <th style={{ padding: '10px 8px' }}>Media %</th>
              <th style={{ padding: '10px 8px' }}>Peak hour (UTC)</th>
              <th style={{ padding: '10px 8px' }}>Avg hour (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {[...MANAGERS].sort((a, b) => a.finish - b.finish).map((m) => (
              <tr key={m.name} style={{ borderBottom: `1px solid ${PALETTE.border}`, textAlign: 'right' }}>
                <td style={{ padding: '10px 16px', textAlign: 'left', color: PALETTE.text }}>
                  <FinishBadge finish={m.finish} /> <span style={{ marginLeft: 8, fontWeight: 600 }}>{m.name}</span>
                </td>
                <td style={{ padding: '10px 8px' }}>{m.avgWords}</td>
                <td style={{ padding: '10px 8px' }}>{m.oneWordPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.capsPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.questionPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.exclaimPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.urlPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.mediaPct}%</td>
                <td style={{ padding: '10px 8px' }}>{m.mostHour.toString().padStart(2, '0')}:00</td>
                <td style={{ padding: '10px 8px' }}>{m.avgHour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Superlatives() {
  return (
    <div style={{ ...card }}>
      <div style={sectionTitle}>ESPYs · TC League edition</div>
      <h2 style={h2}>End-of-season superlatives</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 14 }}>
        {SUPERLATIVES.map((s) => (
          <div key={s.title} style={{
            background: PALETTE.surface2, border: `1px solid ${PALETTE.border}`, borderRadius: 8, padding: 12,
          }}>
            <div style={{ ...subtle, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.title}</div>
            <div style={{ color: PALETTE.accent, fontWeight: 700, fontSize: 16, marginTop: 4 }}>{s.winner}</div>
            <div style={{ color: PALETTE.text, fontSize: 13, marginTop: 4 }}>{s.stat}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Disambiguation() {
  return (
    <div style={{ ...card, background: PALETTE.surface2 }}>
      <div style={sectionTitle}>Methodology · identifying the anonymous handles</div>
      <h2 style={h2}>Who is "Not My Champion" vs "Also Not My Champion"?</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ color: PALETTE.text, fontWeight: 700 }}>Not My Champion → Nick Mottershead · Hackney Meat Loaf · finished 6th</div>
          <ul style={{ marginTop: 8, paddingLeft: 18, color: PALETTE.text, fontSize: 13, lineHeight: 1.55 }}>
            <li>2025-08-01 · "But I am telling you now that <em>His Majesties Loaf</em> are going to be running rampant" — referring to his own team Hackney Meat Loaf.</li>
            <li>2025-08-01 · "HaMeLo to some of the fans" / "Live, Laugh, Loaf" — only the Loaf manager would brand themselves.</li>
            <li>2025-08-01 · Nick Goodacre replies "He's hackney now" about Not My Champion — naming the Hackney team.</li>
            <li>2025-09-13 · "May I take this opportunity to wish my opponents — Seoul Club 7, our reigning champs — the very best of luck" — Mottershead's recurring weekly trash-talk template (HaMeLo vs SC7 in GW3).</li>
          </ul>
        </div>
        <div>
          <div style={{ color: PALETTE.text, fontWeight: 700 }}>Also Not My Champion → David Higman · Crouch End Oashisu · finished 1st (champion)</div>
          <ul style={{ marginTop: 8, paddingLeft: 18, color: PALETTE.text, fontSize: 13, lineHeight: 1.55 }}>
            <li>2025-08-22 · "What a start for oasishu" — referring to his own team Oashisu/Oasishu.</li>
            <li>2026-05-09 · "Can you say 'no way oasishu win the title'" — champion's flex.</li>
            <li>His signature words include "oasishu", "spuds", "north london" — all Crouch End / Tottenham-adjacent vocabulary.</li>
            <li>2025-09-14 · Jon Ward: "Oashisu will get the highest GW score this season" — addressing the other anon as the Oashisu manager.</li>
          </ul>
        </div>
      </div>
      <div style={{ ...subtle, fontSize: 12, marginTop: 12, borderTop: `1px solid ${PALETTE.border}`, paddingTop: 10 }}>
        Source: WhatsApp export 2025-08-01 → 2026-05-24 ({HEADLINE.totalMessages.toLocaleString()} messages, {HEADLINE.totalWords.toLocaleString()} words). Stats computed offline; quotes verbatim from the export.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top-level layout
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div style={{ ...card, padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ ...subtle, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.16em' }}>The TC League of Titans · 2025-26 season in chat</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: PALETTE.text }}>
            42,321 messages of footballing nonsense
          </h1>
          <div style={{ ...subtle, marginTop: 8, maxWidth: 720, fontSize: 14 }}>
            Eight managers, one WhatsApp group, 297 days. David Higman lifted the trophy; Eddy
            Webster picked up the jigsaw. This is what happened in the chat in between.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...subtle, fontSize: 12 }}>{HEADLINE.firstDate} → {HEADLINE.lastDate}</div>
          <div style={{ color: PALETTE.text, fontWeight: 700, marginTop: 4, fontSize: 14 }}>{HEADLINE.distinctDays} active days of {HEADLINE.daysSpan}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 22 }}>
        <MetricTile label="Total messages" value={HEADLINE.totalMessages.toLocaleString()} sub={`${HEADLINE.avgMsgsPerDay.toFixed(1)} / day average`} />
        <MetricTile label="Total words" value={HEADLINE.totalWords.toLocaleString()} sub={`≈ ${Math.round(HEADLINE.totalWords / 80_000)} novels worth`} />
        <MetricTile label="Active days" value={`${HEADLINE.distinctDays}`} sub={`only ${HEADLINE.daysSpan - HEADLINE.distinctDays} day with zero messages`} />
        <MetricTile label="Busiest hour" value={`${HEADLINE.busiestHourUTC.toString().padStart(2, '0')}:00 UTC`} sub={`${HEADLINE.busiestHourCount.toLocaleString()} messages logged at this hour`} />
        <MetricTile label="Busiest weekday" value={HEADLINE.busiestWeekday} sub={`${HEADLINE.busiestWeekdayCount.toLocaleString()} msgs — match day surge`} />
        <MetricTile label="Total swears" value={HEADLINE.totalSwears.toLocaleString()} sub={`≈ 1 every 22 messages · peak: ${RECORDS.topSwearDay.date} (${RECORDS.topSwearDay.count})`} />
      </div>
    </div>
  )
}

export default function TclotChatStatsCanvas() {
  return (
    <div className="tclot-root" style={{
      background: PALETTE.bg,
      color: PALETTE.text,
      minHeight: '100vh',
      padding: '32px clamp(20px, 4vw, 56px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <ThemeVars />
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 18 }}>
        <Header />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <HourHeatmap />
          <WeekdayBars />
        </div>

        <ManagerScoreboard />

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <VolumeRecords />
          <LongestSnippets />
        </div>

        <SwearLeaderboard />
        <SwearMatrix />

        <NgramColumns />
        <SignaturePhrases />

        <Claims />
        <InJokes />

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <Fingerprints />
          <Emojis />
        </div>

        <Superlatives />

        <Disambiguation />

        <div style={{ ...subtle, textAlign: 'center', fontSize: 12, padding: '12px 0 32px' }}>
          TCLOT 2025-26 · chat stats canvas · Higman lifted the trophy, Eddy got the jigsaw, the rest of us got the group chat.
        </div>
      </div>
    </div>
  )
}
