import test from 'node:test'
import assert from 'node:assert/strict'
import { teamLogoSrcList } from './teamLogoSrcList.js'

const BASE = '/TCLOT/'

test('teamLogoSrcList — mapped ids prefer 192px pipeline output, not source uploads', () => {
  const urls = teamLogoSrcList(72086, { 72086: 'Shire.PNG' }, false, BASE)
  assert.equal(urls[0], '/TCLOT/team-logos-web/72086.png')
  assert.equal(urls[1], '/TCLOT/team-logos-web/Shire.PNG')
  assert.equal(
    urls.some((u) => u.includes('/team-logos/Shire')),
    false,
    'source uploads are not in the default src list',
  )
})

test('teamLogoSrcList — unmapped ids only try team-logos-web/{id}.png', () => {
  const urls = teamLogoSrcList(26587, {}, false, BASE)
  assert.deepEqual(urls, ['/TCLOT/team-logos-web/26587.png'])
})

test('teamLogoSrcList — customLogoOnly still allows named source uploads', () => {
  const urls = teamLogoSrcList(72086, { 72086: 'Shire.PNG' }, true, BASE)
  assert.equal(urls[0], '/TCLOT/team-logos-web/Shire.PNG')
  assert.equal(urls[1], '/TCLOT/team-logos/Shire.PNG')
})

test('teamLogoSrcList — empty / invalid ids return []', () => {
  assert.deepEqual(teamLogoSrcList(null, {}), [])
  assert.deepEqual(teamLogoSrcList('', {}), [])
  assert.deepEqual(teamLogoSrcList('x', {}), [])
})
