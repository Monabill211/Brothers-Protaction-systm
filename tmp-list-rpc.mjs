import fs from 'node:fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
const t = await res.text()
const names = [...t.matchAll(/"\/rpc\/([^"]+)"/g)].map((m) => m[1])
const uniq = [...new Set(names)].sort()
console.log('RPC_COUNT', uniq.length)
console.log('---INVOICE---')
for (const n of uniq.filter((n) => /invoice|owner|update|edit/i.test(n))) {
  console.log(n)
}
console.log('---ALL---')
for (const n of uniq) console.log(n)

const paths = [...t.matchAll(/"\/rpc\/([^"]+)"\s*:\s*\{/g)].map((m) => m[1])
const invoicePaths = uniq.filter((n) => /invoice/i.test(n))
for (const name of invoicePaths) {
  const idx = t.indexOf(`"/rpc/${name}"`)
  const slice = t.slice(idx, idx + 2500)
  console.log('---SCHEMA', name, '---')
  console.log(slice.slice(0, 2000))
}
