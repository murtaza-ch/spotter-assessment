import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'spotter-contract-'))
const schemaPath = join(temporaryDirectory, 'openapi.yaml')
const typesPath = join(temporaryDirectory, 'schema.d.ts')
const commandOptions = { cwd: repositoryRoot, stdio: 'inherit' }

try {
  execFileSync(
    'uv',
    [
      'run',
      '--project',
      'backend',
      'python',
      'backend/manage.py',
      'spectacular',
      '--file',
      schemaPath,
      '--validate',
      '--fail-on-warn',
    ],
    commandOptions,
  )
  execFileSync(
    process.execPath,
    [
      join(repositoryRoot, 'node_modules/openapi-typescript/bin/cli.js'),
      schemaPath,
      '--array-length',
      '-o',
      typesPath,
    ],
    commandOptions,
  )

  for (const [generated, committed] of [
    [schemaPath, 'backend/openapi.yaml'],
    [typesPath, 'frontend/src/lib/api/schema.d.ts'],
  ]) {
    if (!readFileSync(generated).equals(readFileSync(join(repositoryRoot, committed)))) {
      console.error(`${committed} is out of date. Run npm run api:generate.`)
      process.exitCode = 1
    }
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
