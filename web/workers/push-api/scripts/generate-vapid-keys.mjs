#!/usr/bin/env node
/**
 * Generate VAPID key pair for Web Push.
 * Run: node scripts/generate-vapid-keys.mjs
 *
 * Set the output as Cloudflare Worker secrets and bake the public key into
 * the web build as VITE_VAPID_PUBLIC_KEY.
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('Add these Cloudflare Worker secrets (wrangler secret put):')
console.log('')
console.log('VAPID_SUBJECT=mailto:your@email.com')
console.log(`VAPID_SERVER_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_SERVER_PRIVATE_KEY=${keys.privateKey}`)
console.log('')
console.log('Bake into the web app build (.env.local / GitHub Actions):')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log('')
console.log('Also generate a random PUSH_INTERNAL_SECRET for CI-triggered alerts.')
