import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  pruneMockupHtml,
  pruneSourceLogoUploads,
  runPostbuild,
} from './postbuild-gh-pages.mjs'

function tempDist() {
  const dir = mkdtempSync(join(tmpdir(), 'tclot-postbuild-'))
  return dir
}

test('pruneMockupHtml — keeps index/404, removes other root html', () => {
  const dist = tempDist()
  writeFileSync(join(dist, 'index.html'), '<html>app</html>')
  writeFileSync(join(dist, '404.html'), '<html>404</html>')
  writeFileSync(join(dist, 'mockup.html'), '<html>nope</html>')
  const pruned = pruneMockupHtml(dist)
  assert.deepEqual(pruned, ['mockup.html'])
  assert.equal(existsSync(join(dist, 'index.html')), true)
  assert.equal(existsSync(join(dist, 'mockup.html')), false)
  rmSync(dist, { recursive: true, force: true })
})

test('pruneSourceLogoUploads — drops images, keeps JSON manifests', () => {
  const dist = tempDist()
  const logos = join(dist, 'team-logos')
  mkdirSync(logos)
  writeFileSync(join(logos, 'manifest.json'), '{}')
  writeFileSync(join(logos, 'preseason-manifest.json'), '{}')
  writeFileSync(join(logos, '72086.PNG'), 'fake-png')
  writeFileSync(join(logos, 'Bilbo.JPG'), 'fake-jpg')
  const { files, bytes } = pruneSourceLogoUploads(dist)
  assert.equal(files.sort().join(','), '72086.PNG,Bilbo.JPG')
  assert.equal(bytes, 'fake-png'.length + 'fake-jpg'.length)
  assert.equal(existsSync(join(logos, 'manifest.json')), true)
  assert.equal(existsSync(join(logos, '72086.PNG')), false)
  rmSync(dist, { recursive: true, force: true })
})

test('runPostbuild — writes 404 from index then prunes logos and mockups', () => {
  const dist = tempDist()
  writeFileSync(join(dist, 'index.html'), '<html>app</html>')
  writeFileSync(join(dist, 'design.html'), '<html>mock</html>')
  mkdirSync(join(dist, 'team-logos'))
  writeFileSync(join(dist, 'team-logos', '1.png'), 'xx')
  writeFileSync(join(dist, 'team-logos', 'manifest.json'), '{}')
  const result = runPostbuild(dist)
  assert.equal(result.wrote404, true)
  assert.equal(existsSync(join(dist, '404.html')), true)
  assert.equal(existsSync(join(dist, 'design.html')), false)
  assert.equal(existsSync(join(dist, 'team-logos', '1.png')), false)
  assert.equal(existsSync(join(dist, 'team-logos', 'manifest.json')), true)
  rmSync(dist, { recursive: true, force: true })
})
