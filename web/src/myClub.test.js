import assert from 'node:assert/strict'
import test from 'node:test'
import { readMyClubId, writeMyClubId, MY_CLUB_STORAGE_KEY } from './myClub.js'

function withStorage(run) {
  const store = {}
  const original = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v)
      },
      removeItem: (k) => {
        delete store[k]
      },
    },
    dispatchEvent() {},
  }
  try {
    run(store)
  } finally {
    if (original === undefined) delete globalThis.window
    else globalThis.window = original
  }
}

test('readMyClubId is empty until a club is chosen', () => {
  withStorage(() => {
    assert.equal(readMyClubId(), null)
  })
})

test('writeMyClubId stores the club and the push team together', () => {
  withStorage((store) => {
    writeMyClubId(31076)
    assert.equal(readMyClubId(), 31076)
    assert.equal(store[MY_CLUB_STORAGE_KEY], '31076')
    assert.equal(store['tclot:push:entry-id'], '31076')
  })
})

test('a push team chosen earlier becomes your club', () => {
  withStorage((store) => {
    store['tclot:push:entry-id'] = '44904'
    assert.equal(readMyClubId(), 44904)
    assert.equal(store[MY_CLUB_STORAGE_KEY], '44904')
  })
})

test('clearing your club clears the push team too', () => {
  withStorage((store) => {
    writeMyClubId(12)
    writeMyClubId(null)
    assert.equal(readMyClubId(), null)
    assert.equal(store[MY_CLUB_STORAGE_KEY], undefined)
    assert.equal(store['tclot:push:entry-id'], undefined)
  })
})
