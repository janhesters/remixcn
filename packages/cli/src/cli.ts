export interface CliEnvironment {
  stdout: (text: string) => void
  stderr: (text: string) => void
  version: string
}

const usage = `Usage: remixcn [--help | --version]

shadcn components for Remix V3. Nothing to install yet: the registry, the
add command and the MCP server arrive in later releases.

Options:
  -h, --help     Show this help
  -v, --version  Show the version

Docs: https://janhesters.github.io/remixcn/
`

export function run(argv: readonly string[], environment: CliEnvironment): number {
  let [command] = argv

  if (command === undefined || command === '--help' || command === '-h') {
    environment.stdout(usage)
    return 0
  }

  if (command === '--version' || command === '-v') {
    environment.stdout(`${environment.version}\n`)
    return 0
  }

  environment.stderr(`remixcn: unknown command "${command}"\n\n${usage}`)
  return 1
}
