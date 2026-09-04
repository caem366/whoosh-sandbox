// Vercel compiles this TypeScript entrypoint as CommonJS, while the API
// workspace is ESM. A dynamic import preserves the API's native module format.
export default async function handler(request: unknown, response: unknown) {
  const { app } = await import('../apps/api/src/app.js')
  return app(request as never, response as never)
}
