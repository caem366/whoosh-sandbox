const app = require('./app.cjs').app

module.exports = (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const originalPath = url.searchParams.get('__whoosh_path')

  if (originalPath) {
    request.url = `/api/${originalPath}`
  }

  return app(request, response)
}
