export default class TerrariaWorldFileError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TerrariaWorldParserError'
  }
}
