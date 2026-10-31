import { useEffect, useState } from 'react'
import { MY_CLUB_EVENT, readMyClubId } from './myClub.js'

/** League entry id for this phone, or null. Updates when it changes. */
export function useMyClub() {
  const [id, setId] = useState(() => readMyClubId())
  useEffect(() => {
    const sync = () => setId(readMyClubId())
    window.addEventListener(MY_CLUB_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MY_CLUB_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return id
}
