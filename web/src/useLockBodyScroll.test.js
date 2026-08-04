import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attachScrollLockTouchGuard,
  lockDocumentScroll,
  unlockDocumentScroll,
} from './useLockBodyScroll.js'

function createClassList() {
  const values = new Set()
  return {
    add(name) {
      values.add(name)
    },
    remove(name) {
      values.delete(name)
    },
    contains(name) {
      return values.has(name)
    },
  }
}

function createDom({ scrollY = 64 } = {}) {
  const html = {
    classList: createClassList(),
    style: {},
    dataset: {},
  }
  const body = {
    classList: createClassList(),
    style: {},
  }
  const scrolledTo = []
  const win = {
    scrollY,
    pageYOffset: scrollY,
    scrollTo(x, y) {
      scrolledTo.push([x, y])
    },
  }
  const doc = {
    documentElement: html,
    body,
    defaultView: win,
  }
  return { doc, win, html, body, scrolledTo }
}

test('lockDocumentScroll pins body and records scrollY', () => {
  const { doc, win, html, body } = createDom({ scrollY: 48 })
  lockDocumentScroll({ document: doc, window: win })
  assert.equal(html.classList.contains('tclot-scroll-lock'), true)
  assert.equal(body.classList.contains('tclot-scroll-lock'), true)
  assert.equal(body.style.position, 'fixed')
  assert.equal(body.style.top, '-48px')
  assert.equal(html.dataset.tclotScrollY, '48')
})

test('unlockDocumentScroll restores styles and scroll position', () => {
  const { doc, win, html, body, scrolledTo } = createDom({ scrollY: 48 })
  lockDocumentScroll({ document: doc, window: win })
  unlockDocumentScroll({ document: doc, window: win })
  assert.equal(html.classList.contains('tclot-scroll-lock'), false)
  assert.equal(body.style.position, '')
  assert.deepEqual(scrolledTo.at(-1), [0, 48])
})

test('lockDocumentScroll is idempotent', () => {
  const { doc, win, html } = createDom({ scrollY: 12 })
  lockDocumentScroll({ document: doc, window: win })
  win.scrollY = 99
  lockDocumentScroll({ document: doc, window: win })
  assert.equal(html.dataset.tclotScrollY, '12')
})

test('attachScrollLockTouchGuard prevents non-passive touchmove', () => {
  const listeners = []
  const doc = {
    addEventListener(type, fn, opts) {
      listeners.push({ type, fn, opts })
    },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    },
  }
  const detach = attachScrollLockTouchGuard({ document: doc })
  assert.equal(listeners.length, 1)
  assert.equal(listeners[0].type, 'touchmove')
  assert.equal(listeners[0].opts.passive, false)
  const event = {
    prevented: false,
    preventDefault() {
      this.prevented = true
    },
  }
  listeners[0].fn(event)
  assert.equal(event.prevented, true)
  detach()
  assert.equal(listeners.length, 0)
})
