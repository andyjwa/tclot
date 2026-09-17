function playerLabel(p) {
  return p.fullName || p.webName || ''
}

function foldSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Club short name, then player name. */
export function compareForbiddenByClub(a, b) {
  return (
    (a.team || '').localeCompare(b.team || '', undefined, { sensitivity: 'base' }) ||
    playerLabel(a).localeCompare(playerLabel(b), undefined, { sensitivity: 'base' })
  )
}

export function compareForbiddenPlayers(a, b, takenPickupIds) {
  const aTaken = takenPickupIds?.has(Number(a.id)) ? 0 : 1
  const bTaken = takenPickupIds?.has(Number(b.id)) ? 0 : 1
  return aTaken - bTaken || compareForbiddenByClub(a, b)
}

export function matchesForbiddenSearch(p, query) {
  const q = foldSearchText(query).trim()
  if (!q) return true
  const hay = foldSearchText([p.webName, p.fullName, p.team, p.position].filter(Boolean).join(' '))
  return hay.includes(q)
}

export function filterForbiddenPlayers(players, query, takenPickupIds) {
  return (players ?? [])
    .filter((p) => matchesForbiddenSearch(p, query))
    .slice()
    .sort((a, b) => compareForbiddenPlayers(a, b, takenPickupIds))
}
