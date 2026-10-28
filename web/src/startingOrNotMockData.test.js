import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSnapshot } from './startingOrNotMockData.js'

const names = (rows) => rows.map((r) => r.name)

test('everyone sees each fantasy side from sheets that are out, with waiters kept apart', () => {
  const { groups, totals } = buildSnapshot(null, null)
  const ce = groups.find((g) => g.manager.id === 'CE')
  assert.deepEqual(names(ce.starting), ['Gordon', 'Saliba', 'Ekitiké'])
  assert.deepEqual(names(ce.notStarting), ['Tonali', 'Trent'])
  assert.deepEqual(names(ce.waiting), ['Haaland'])
  assert.equal(groups.length, 8)
  assert.equal(totals.waiting, 3)
  assert.ok(groups.every((g) => g.starting.every((p) => p.role === 'xi')))
  assert.ok(groups.every((g) => g.notStarting.every((p) => p.role === 'bench' || p.role === 'nis')))
})

test('a fixture filter keeps both clubs and drops players who are still waiting', () => {
  const { groups, totals } = buildSnapshot(null, 'ars-liv')
  const flat = groups.flatMap((g) => [...g.starting, ...g.notStarting])
  assert.ok(flat.some((p) => p.name === 'Saliba' && p.club === 'ARS'))
  assert.ok(flat.some((p) => p.name === 'Salah' && p.club === 'LIV'))
  assert.equal(flat.some((p) => p.name === 'Gordon'), false)
  assert.equal(totals.waiting, 0)
  assert.equal(groups.some((g) => g.waiting.length), false)
})

test('team and fixture together are the intersection', () => {
  const { groups } = buildSnapshot('CE', 'new-bri')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].manager.id, 'CE')
  assert.deepEqual(names(groups[0].starting), ['Gordon'])
  assert.deepEqual(names(groups[0].notStarting), ['Tonali'])
  assert.equal(groups[0].notStarting[0].role, 'bench')
})

test('unowned names never enter the snapshot', () => {
  const { groups } = buildSnapshot(null, null)
  const flat = groups.flatMap((g) => [...g.starting, ...g.notStarting, ...g.waiting])
  assert.equal(flat.some((p) => p.name === 'Raya' || p.name === 'Alisson'), false)
})
