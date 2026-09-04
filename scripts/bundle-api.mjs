import { build } from 'esbuild'
import { resolve } from 'node:path'

await build({
  entryPoints: [resolve('apps/api/src/app.ts')],
  outfile: resolve('api/app.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
})
