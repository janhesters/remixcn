const secretPatterns: Array<[string, RegExp]> = [
  ['a private key', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/],
  ['an npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['an npm registry auth token', /:_auth(?:Token)?\s*=\s*(?!\$\{)\S+/],
  ['an AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a Slack token', /\bxox[abeoprs]-[A-Za-z0-9-]{10,}/],
  ['a Stripe live key', /\b[rs]k_live_[A-Za-z0-9]{20,}/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['an Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
]

/**
 * Finds credential-shaped text: the token formats of the services a
 * contributor or CI could leak. It names the kind and line, never the value.
 */
export function findSecrets(text: string): Array<{ kind: string; line: number }> {
  return text
    .split('\n')
    .flatMap((content, index) =>
      secretPatterns.filter(([, pattern]) => pattern.test(content)).map(([kind]) => ({ kind, line: index + 1 })),
    )
}

/** Environment files, private keys and certificates don't belong in a public repository. */
export function isSecretFile(file: string): boolean {
  let name = file.slice(file.lastIndexOf('/') + 1)
  if (name === '.env.example') return false
  return /^\.env(\..+)?$/.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name) || /\.(pem|p12|pfx)$/.test(name)
}
