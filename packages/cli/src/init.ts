// remixcn init: prepares an existing Remix 3 app for RemixCN. It writes
// components.json, maps the default #remixcn aliases in package.json imports,
// and installs the theme and license texts, as one change. It installs no npm
// package and replaces no file the user changed without --overwrite.
import { join, relative, sep } from 'node:path'

import { commit } from './add.ts'
import type { Change, Context, FileResult, WriteOptions } from './add.ts'
import { CliError } from './errors.ts'
import { placeFiles } from './install.ts'
import {
  aliasNames,
  checkComponentsConfig,
  checkRemixProject,
  configSchemaUrl,
  configVersion,
  defaultAliases,
  defaultNamespace,
  defaultRegistryUrl,
  readComponentsConfig,
  readProject,
  registriesOf,
  remixVersion,
  resolveAlias,
  resolveDirectories,
} from './project.ts'
import type { ComponentsConfig, Project } from './project.ts'
import { resolveItems } from './resolve.ts'

/** Where the default aliases point: browser-reachable directories of a remix new app. */
export const defaultDirectories = {
  ui: 'app/ui/public/components/ui',
  lib: 'app/ui/public/lib',
  components: 'app/ui/public/components',
}

export const themeItem = `${defaultNamespace}/theme`

export interface InitOptions extends WriteOptions {
  items: string[]
}

export interface InitResult {
  dryRun: boolean
  items: string[]
  files: FileResult[]
  /** The installed theme stylesheet, relative to the app. */
  theme?: string
  warnings: string[]
}

function indentOf(text: string | undefined) {
  return /^[ \t]+(?=")/m.exec(text ?? '')?.[0] ?? '  '
}

function toJson(value: unknown, indent: string) {
  return `${JSON.stringify(value, null, indent)}\n`
}

/** Adds the entries of `defaults` that `value` lacks, after the ones it has. */
function withDefaults(value: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  let existing = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return { ...existing, ...Object.fromEntries(Object.entries(defaults).filter(([key]) => existing[key] === undefined)) }
}

/**
 * Fills in what RemixCN needs and keeps every other field in its place.
 * Changing a value the user set is a conflict that only --overwrite allows.
 */
function mergeConfig(existing: ComponentsConfig | undefined, overwrite: boolean): ComponentsConfig {
  let required: Record<string, unknown> = { $schema: configSchemaUrl, version: configVersion, rsc: false, tsx: true }
  // A new file lists css before the aliases; init fills it in once the theme has a place.
  let config: ComponentsConfig = existing ? { ...existing } : { ...required, css: undefined }
  let conflicts: string[] = []

  for (let [field, value] of Object.entries(required)) {
    if (config[field] === undefined || overwrite) config[field] = value
    else if (config[field] !== value) {
      conflicts.push(
        `components.json sets ${field} to ${JSON.stringify(config[field])}; RemixCN needs ${JSON.stringify(value)}`,
      )
    }
  }
  if (conflicts.length > 0) {
    throw new CliError(
      'CONFLICT',
      'components.json has settings RemixCN would change, so nothing was written. Pass --overwrite to change them.',
      conflicts,
    )
  }

  config.aliases = withDefaults(config.aliases, defaultAliases)
  config.registries = withDefaults(config.registries, { [defaultNamespace]: defaultRegistryUrl })
  return config
}

/** Maps each default alias that doesn't resolve yet to its default directory in package.json imports. */
function addImports(project: Project, config: ComponentsConfig): Project {
  let existing = project.packageJson.value.imports
  if (existing !== undefined && (typeof existing !== 'object' || existing === null || Array.isArray(existing))) {
    throw new CliError('PROJECT', 'package.json imports must map import aliases such as "#app/*" to paths')
  }
  let imports: Record<string, unknown> = { ...existing }
  let unresolved: string[] = []

  for (let name of aliasNames) {
    let alias = String(config.aliases?.[name])
    if (resolveAlias(project, alias) !== undefined) continue
    if (alias === defaultAliases[name]) imports[`${alias}/*`] = `./${defaultDirectories[name]}/*`
    else unresolved.push(`aliases.${name} "${alias}" matches no package.json imports or tsconfig.json paths entry`)
  }
  if (unresolved.length > 0) {
    throw new CliError(
      'PROJECT',
      "components.json has aliases remixcn can't resolve to a directory. Map them, or remove them so init sets the defaults:",
      unresolved,
    )
  }

  if (Object.keys(imports).length === Object.keys(project.packageJson.value.imports ?? {}).length) return project
  return { ...project, packageJson: { ...project.packageJson, value: { ...project.packageJson.value, imports } } }
}

export async function init(options: InitOptions, context: Context): Promise<InitResult> {
  let project = readProject(options.root)
  checkRemixProject(project)

  let existing = readComponentsConfig(project.root)
  let config = mergeConfig(existing?.value, options.overwrite)
  let problems = checkComponentsConfig(config)
  if (problems.length > 0) throw new CliError('PROJECT', "components.json can't be set up for RemixCN:", problems)

  let prepared = addImports(project, config)
  let directories = resolveDirectories(prepared, config)

  let { items, requested } = await resolveItems([themeItem, ...options.items], {
    registries: registriesOf(config),
    cwd: context.cwd,
    fetchJson: context.fetchJson,
    remix: remixVersion(project),
  })
  let files = placeFiles(items, { root: project.root, directories, requested })

  let theme = files.find((file) => file.item === 'theme' && file.path.endsWith('.css'))
  if (config.css === undefined && theme) config.css = relative(project.root, theme.path).split(sep).join('/')

  let indent = indentOf(existing?.text ?? project.packageJson.text)
  let changes: Change[] = [
    { path: join(project.root, 'components.json'), content: toJson(config, indent), merge: true },
  ]
  if (prepared !== project) {
    changes.push({
      path: project.packageJson.path,
      content: toJson(prepared.packageJson.value, indentOf(project.packageJson.text)),
      merge: true,
    })
  }

  let warnings = aliasNames
    .filter((name) => !directories[name].split(sep).includes('public'))
    .map(
      (name) =>
        `${relative(project.root, directories[name])} is not in a public/ directory, so Remix's asset server won't serve the ${name} files. Point aliases.${name} at a directory under app/**/public/.`,
    )

  return {
    dryRun: options.dryRun,
    items: items.map((item) => item.name),
    files: await commit([...changes, ...files], options, context),
    ...(theme && { theme: relative(project.root, theme.path).split(sep).join('/') }),
    warnings,
  }
}

/** The steps that wire RemixCN into the app, following the Remix 3 guides. */
export function nextSteps(theme: string | undefined): string[] {
  let stylesheet = theme ?? `${defaultDirectories.lib}/theme.css`
  return [
    `Link the theme in <head>, before any other stylesheet. Resolve its URL once in app/assets.ts:\n     export const themeHref = await assetServer.getHref('${stylesheet}')\n   and render it in app/actions/document.tsx:\n     <link rel="stylesheet" href={themeHref} />`,
    'Let the asset server serve the components: allowFiles in app/assets.ts must cover "app/**/public/**".',
    "Interactive components are clientEntry(...) modules. Start the browser runtime once with run() in app/actions/public/entry.ts, and render scriptEntry's <ImportMap> and module script in the document, as Remix's Interactivity guide shows (node_modules/remix/guides/05-interactivity.md).",
    'Add components: npx remixcn add button',
  ]
}
