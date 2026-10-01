export class EnvConfigError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Configuración de entorno inválida: ${issues.join(' ')}`)
    this.name = 'EnvConfigError'
    this.issues = issues
  }
}
