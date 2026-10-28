/**
 * Sample data for the "starting or not" design mockup (`?starting=1`).
 *
 * The snapshot only includes fixtures whose team sheets are out and that are
 * still to play or already in play. Full-time matches stay on the sheet list
 * and out of the snapshot. A player whose club has not published a sheet is
 * "waiting", which is separate from not starting (benched, or left out).
 *
 * Unowned players exist so the sheet preview still looks like today's XI.
 * `buildSnapshot` drops them.
 */

export const MANAGERS = [
  { id: 'CE', name: 'Crouch End Oashisu', short: 'Crouch End', color: '#795bfb' },
  { id: 'HY', name: 'Hanson of York', short: 'Hanson', color: '#d97706' },
  { id: 'HM', name: 'Hackney Meat Loaf', short: 'Hackney', color: '#e11d48' },
  { id: 'SC', name: 'Seoul Club 7', short: 'Seoul', color: '#0284c7' },
  { id: 'CC', name: 'Clapton Cornershop', short: 'Clapton', color: '#ea580c' },
  { id: 'MJ', name: 'Morpeth Jamiroquai', short: 'Morpeth', color: '#7c3aed' },
  { id: 'TO', name: 'Toronto Oizo', short: 'Toronto', color: '#0f766e' },
  { id: 'BR', name: 'Brampton II Men', short: 'Brampton', color: '#15803d' },
]

export const CLUBS = {
  ARS: { name: 'Arsenal', code: 3 },
  LIV: { name: 'Liverpool', code: 14 },
  NEW: { name: 'Newcastle', code: 4 },
  BRI: { name: 'Brighton', code: 36 },
  MCI: { name: 'Man City', code: 43 },
  WOL: { name: 'Wolves', code: 39 },
  CRY: { name: 'Crystal Palace', code: 31 },
  BRE: { name: 'Brentford', code: 94 },
  WHU: { name: 'West Ham', code: 21 },
  SUN: { name: 'Sunderland', code: 56 },
  BOU: { name: 'Bournemouth', code: 91 },
  MUN: { name: 'Man United', code: 1 },
}

const p = (name, pos, owner = null) => ({ name, pos, owner })

/** Sheets that are out and still to play (or live). These feed the snapshot. */
export const ANNOUNCED = [
  {
    id: 'new-bri',
    home: 'NEW',
    away: 'BRI',
    state: 'live',
    score: '2–1',
    minute: "67'",
    ko: '3:00 PM',
    xi: {
      home: [
        p('Pope', 'GK'),
        p('Livramento', 'DEF', 'BR'),
        p('Schär', 'DEF', 'MJ'),
        p('Burn', 'DEF'),
        p('Hall', 'DEF'),
        p('Bruno G', 'MID', 'CC'),
        p('Longstaff', 'MID'),
        p('Gordon', 'MID', 'CE'),
        p('Barnes', 'MID', 'SC'),
        p('Elanga', 'MID'),
        p('Woltemade', 'FWD'),
      ],
      away: [
        p('Verbruggen', 'GK'),
        p('Lamptey', 'DEF'),
        p('Dunk', 'DEF', 'SC'),
        p('Van Hecke', 'DEF'),
        p('Estupiñán', 'DEF'),
        p('Baleba', 'MID'),
        p('Ayari', 'MID'),
        p('Wieffer', 'MID'),
        p('Rutter', 'MID', 'HY'),
        p('Adingra', 'MID'),
        p('João Pedro', 'FWD', 'MJ'),
      ],
    },
    bench: {
      home: [
        p('Dubravka', 'GK'),
        p('Trippier', 'DEF'),
        p('Tonali', 'MID', 'CE'),
        p('Murphy', 'MID', 'HY'),
        p('Osula', 'FWD'),
      ],
      away: [
        p('Steele', 'GK'),
        p('March', 'MID'),
        p('Minteh', 'MID', 'HM'),
        p('Welbeck', 'FWD', 'TO'),
        p('Ferguson', 'FWD', 'BR'),
      ],
    },
    out: {
      home: [],
      away: [p('Mitoma', 'MID', 'CC')],
    },
  },
  {
    id: 'ars-liv',
    home: 'ARS',
    away: 'LIV',
    state: 'pre',
    score: null,
    minute: null,
    ko: '5:30 PM',
    xi: {
      home: [
        p('Raya', 'GK'),
        p('White', 'DEF', 'HY'),
        p('Saliba', 'DEF', 'CE'),
        p('Gabriel', 'DEF', 'SC'),
        p('Calafiori', 'DEF'),
        p('Rice', 'MID', 'HM'),
        p('Ødegaard', 'MID', 'TO'),
        p('Merino', 'MID'),
        p('Saka', 'MID', 'SC'),
        p('Havertz', 'FWD', 'BR'),
        p('Martinelli', 'MID'),
      ],
      away: [
        p('Alisson', 'GK'),
        p('Bradley', 'DEF'),
        p('Konaté', 'DEF'),
        p('Van Dijk', 'DEF', 'HM'),
        p('Robertson', 'DEF'),
        p('Mac Allister', 'MID', 'HM'),
        p('Gravenberch', 'MID', 'MJ'),
        p('Szoboszlai', 'MID', 'TO'),
        p('Salah', 'MID', 'CC'),
        p('Ekitiké', 'FWD', 'CE'),
        p('Gakpo', 'MID', 'HY'),
      ],
    },
    bench: {
      home: [
        p('Setford', 'GK'),
        p('Timber', 'DEF', 'MJ'),
        p('Partey', 'MID'),
        p('Trossard', 'MID', 'CC'),
        p('Jesus', 'FWD'),
      ],
      away: [
        p('Mamardashvili', 'GK'),
        p('Gomez', 'DEF'),
        p('Endo', 'MID'),
        p('Jones', 'MID', 'BR'),
        p('Isak', 'FWD', 'SC'),
      ],
    },
    out: {
      home: [
        p('Tomiyasu', 'DEF', 'HM'),
        p('Zinchenko', 'DEF', 'TO'),
        p('Nwaneri', 'MID', 'MJ'),
      ],
      away: [
        p('Trent', 'DEF', 'CE'),
        p('Jota', 'FWD', 'BR'),
        p('Chiesa', 'MID', 'HM'),
      ],
    },
  },
]

/** Fixtures that still appear on the sheet list, and stay out of the snapshot. */
export const SHELLS = [
  { id: 'bre-whu', home: 'BRE', away: 'WHU', state: 'ft', score: '3–0', minute: null, ko: '3:00 PM' },
  { id: 'wol-sun', home: 'WOL', away: 'SUN', state: 'scheduled', score: null, minute: null, ko: '8:00 PM' },
  { id: 'bou-cry', home: 'BOU', away: 'CRY', state: 'scheduled', score: null, minute: null, ko: '2:00 PM' },
  { id: 'mun-mci', home: 'MUN', away: 'MCI', state: 'scheduled', score: null, minute: null, ko: '4:30 PM' },
]

export const SHEET_DAYS = [
  { label: 'Saturday, Apr 12', ids: ['bre-whu', 'new-bri', 'ars-liv', 'wol-sun'] },
  { label: 'Sunday, Apr 13', ids: ['bou-cry', 'mun-mci'] },
]

/** Owned players whose club has not published a sheet yet. */
export const WAITING = [
  { name: 'Haaland', pos: 'FWD', club: 'MCI', owner: 'CE', when: 'Sun 4:30', versus: 'MUN' },
  { name: 'Cunha', pos: 'FWD', club: 'WOL', owner: 'HY', when: 'Sat 8:00', versus: 'SUN' },
  { name: 'Mateta', pos: 'FWD', club: 'CRY', owner: 'TO', when: 'Sun 2:00', versus: 'BOU' },
]

export function managerById(id) {
  return MANAGERS.find((m) => m.id === id) || null
}

export function sheetById(id) {
  return [...ANNOUNCED, ...SHELLS].find((f) => f.id === id) || null
}

export function clubName(code) {
  return CLUBS[code]?.name || code
}

/**
 * Fantasy-team snapshot for the current filter.
 *
 * @param {string | null} teamId
 * @param {string | null} fixtureId announced fixture id, or null for every sheet that is out
 */
export function buildSnapshot(teamId, fixtureId) {
  const fixtures = ANNOUNCED.filter((f) => !fixtureId || f.id === fixtureId)
  /** @type {Map<string, { starting: object[], notStarting: object[], waiting: object[] }>} */
  const byOwner = new Map()
  const ensure = (id) => {
    if (!byOwner.has(id)) byOwner.set(id, { starting: [], notStarting: [], waiting: [] })
    return byOwner.get(id)
  }

  for (const f of fixtures) {
    for (const side of ['home', 'away']) {
      const club = f[side]
      const opp = side === 'home' ? f.away : f.home
      const when = f.state === 'live' ? f.minute : f.ko
      const push = (list, role) => {
        for (const player of list || []) {
          if (!player.owner) continue
          if (teamId && player.owner !== teamId) continue
          const bucket = role === 'xi' ? 'starting' : 'notStarting'
          ensure(player.owner)[bucket].push({
            name: player.name,
            pos: player.pos,
            owner: player.owner,
            club,
            opp,
            when,
            live: f.state === 'live',
            role,
            fixtureId: f.id,
          })
        }
      }
      push(f.xi[side], 'xi')
      push(f.bench[side], 'bench')
      push(f.out[side], 'nis')
    }
  }

  if (!fixtureId) {
    for (const w of WAITING) {
      if (teamId && w.owner !== teamId) continue
      ensure(w.owner).waiting.push(w)
    }
  }

  const groups = MANAGERS
    .map((manager) => ({
      manager,
      ...(byOwner.get(manager.id) || { starting: [], notStarting: [], waiting: [] }),
    }))
    .filter((g) => g.starting.length || g.notStarting.length || g.waiting.length)

  const totals = groups.reduce(
    (acc, g) => {
      acc.starting += g.starting.length
      acc.notStarting += g.notStarting.length
      acc.waiting += g.waiting.length
      return acc
    },
    { starting: 0, notStarting: 0, waiting: 0 },
  )

  return { groups, totals }
}
