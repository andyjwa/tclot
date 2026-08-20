/* TCLOT Web Push service worker — receives push payloads and shows OS notifications. */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'TCLOT',
    body: 'League update',
    url: '/',
    tag: 'tclot',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    const text = event.data?.text?.()
    if (text) payload.body = text
  }

  const targetUrl = payload.url || '/'
  event.waitUntil(
    self.registration.showNotification(payload.title || 'TCLOT', {
      body: payload.body || '',
      tag: payload.tag || 'tclot',
      data: { url: targetUrl },
      icon: new URL('icon-192.png', self.registration.scope).href,
      badge: new URL('icon-192.png', self.registration.scope).href,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification?.data?.url || '/'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await client.navigate(rawUrl)
          }
          return
        }
      }
      await self.clients.openWindow(rawUrl)
    })(),
  )
})
