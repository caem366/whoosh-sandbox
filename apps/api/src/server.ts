import { environment } from './config.js'
import { app } from './app.js'

app.listen(environment.PORT, () => {
  console.info(`WHOOSH API listening on port ${environment.PORT}`)
})
