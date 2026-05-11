import { useState } from 'react'

export function PlayerKit({ shirtUrl, badgeUrl, teamShort }) {
  const urls = [shirtUrl, badgeUrl].filter(Boolean)
  const [u, setU] = useState(0)
  if (u >= urls.length) {
    return (
      <span className="pl-kit-fallback" title={teamShort}>
        {teamShort?.slice(0, 3) ?? '?'}
      </span>
    )
  }
  const isShirt = u === 0 && Boolean(shirtUrl)
  return (
    <img
      className={isShirt ? 'pl-kit-shirt' : 'pl-kit-badge'}
      src={urls[u]}
      alt=""
      loading="lazy"
      onError={() => setU((x) => x + 1)}
    />
  )
}
