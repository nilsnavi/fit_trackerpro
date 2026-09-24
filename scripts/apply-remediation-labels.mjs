#!/usr/bin/env node
/**
 * Apply labels and dependency links to the production remediation issues.
 *
 * Why this script exists: the issue pack was created by a bot token that has no
 * push access, so GitHub silently dropped labels on creation. Run this once with
 * an operator token that has push access to finish the setup.
 *
 * Usage:
 *   node scripts/apply-remediation-labels.mjs --dry-run     # show the plan, change nothing
 *   node scripts/apply-remediation-labels.mjs               # apply labels
 *   node scripts/apply-remediation-labels.mjs --deps        # also post "Depends on #N" comments
 *
 * Requires: `gh` CLI authenticated for the target repository.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const packPath = path.join(repoRoot, 'docs', 'roadmap', 'remediation-issues-2026-09-23.json')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const withDeps = args.includes('--deps')
const repoFlag = args.find((a) => a.startsWith('--repo='))
const repo = repoFlag ? repoFlag.split('=')[1] : 'nilsnavi/fit_trackerpro'

function gh(ghArgs) {
    return execFileSync('gh', ghArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

function ghJson(ghArgs) {
    return JSON.parse(gh(ghArgs))
}

function loadPack() {
    if (!fs.existsSync(packPath)) {
        console.error(`error: issue pack not found at ${packPath}`)
        process.exit(1)
    }
    return JSON.parse(fs.readFileSync(packPath, 'utf8'))
}

function existingLabels() {
    const names = ghJson(['label', 'list', '--repo', repo, '--limit', '200', '--json', 'name'])
    return new Set(names.map((l) => l.name))
}

function issueNumberByTitle(pack) {
    const issues = ghJson([
        'issue', 'list', '--repo', repo, '--state', 'all', '--limit', '300',
        '--json', 'number,title',
    ])
    const byTitle = new Map(issues.map((i) => [i.title.trim(), i.number]))
    const mapping = {}
    for (const issue of pack.issues) {
        for (const candidate of [issue.title, issue.title.replace(/^P(\d) — /, 'P$1 - ')]) {
            if (byTitle.has(candidate.trim())) {
                mapping[issue.id] = byTitle.get(candidate.trim())
                break
            }
        }
    }
    return mapping
}

function main() {
    const pack = loadPack()
    const available = existingLabels()
    const numbers = issueNumberByTitle(pack)

    const missing = pack.issues.filter((i) => !numbers[i.id]).map((i) => i.id)
    if (missing.length > 0) {
        console.warn(`warning: issues not found in repository (skipped): ${missing.join(', ')}`)
        console.warn('         run the pack creation first (see docs/roadmap/remediation-issues-2026-09-23.json)')
    }

    let applied = 0
    let skippedLabels = 0
    let deps = 0

    for (const issue of pack.issues) {
        const number = numbers[issue.id]
        if (!number) continue

        const wanted = issue.labels
        const usable = wanted.filter((l) => available.has(l))
        const dropped = wanted.filter((l) => !available.has(l))
        if (dropped.length > 0) skippedLabels += 1

        if (dryRun) {
            console.log(
                `#${number} ${issue.id}: labels=[${usable.join(', ')}]` +
                (dropped.length ? ` (missing in repo: ${dropped.join(', ')})` : ''),
            )
        } else if (usable.length > 0) {
            gh(['issue', 'edit', String(number), '--repo', repo, ...usable.flatMap((l) => ['--add-label', l])])
            console.log(`#${number} ${issue.id}: labels applied (${usable.join(', ')})`)
            applied += 1
        }

        if (withDeps && issue.depends_on?.length > 0) {
            const refs = issue.depends_on.map((id) => (numbers[id] ? `#${numbers[id]}` : id))
            const body = `Depends on: ${refs.join(', ')}\n\n(Auto-generated from docs/roadmap/remediation-issues-2026-09-23.json)`
            if (dryRun) {
                console.log(`#${number} ${issue.id}: would comment "${body.split('\n')[0]}"`)
            } else {
                gh(['issue', 'comment', String(number), '--repo', repo, '--body', body])
                deps += 1
            }
        }
    }

    console.log(
        dryRun
            ? `\ndry-run complete: ${Object.keys(numbers).length} issues resolved`
            : `\ndone: ${applied} issues labelled, ${deps} dependency comments, ${skippedLabels} issues had unknown labels dropped`,
    )
    if (dryRun) {
        console.log('re-run without --dry-run (operator token with push access) to apply changes')
    }
}

main()
