/**
 * The exit code of each kind of failure. They are part of the CLI's contract:
 * scripts branch on them, and packages/cli/README.md documents them.
 */
export const exitCodes = {
  INTERNAL: 1,
  USAGE: 2,
  PROJECT: 3,
  NETWORK: 4,
  REGISTRY: 5,
  UNSAFE_PATH: 6,
  CONFLICT: 7,
  WRITE: 8,
  UNAVAILABLE: 9,
} as const

export type ErrorCode = keyof typeof exitCodes

/** A failure the CLI reports to the user: a code, a message, and the problems behind it. */
export class CliError extends Error {
  code: ErrorCode
  details: string[]

  constructor(code: ErrorCode, message: string, details: string[] = []) {
    super(message)
    this.name = 'CliError'
    this.code = code
    this.details = details
  }

  get exitCode(): number {
    return exitCodes[this.code]
  }
}
