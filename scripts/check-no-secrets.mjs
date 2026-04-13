import { execSync } from 'node:child_process'
import fs from 'node:fs'

function getStagedFiles() {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
}

function isAllowlistedPath(filePath) {
    // Docs and templates often contain token-looking examples.
    if (filePath.startsWith('docs/')) return true
    if (filePath.endsWith('.md')) return true
    if (filePath.endsWith('.example')) return true
    if (filePath.includes('.env.example')) return true
    if (filePath.includes('.env.production.example')) return true
    if (filePath.includes('.env.test')) return true
    return false
}

function scanContent(filePath, content) {
    const findings = []

    // Private keys
    if (/BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/.test(content)) {
        findings.push('looks like a private key block')
    }

    // Common env secrets (only enforce outside allowlist files)
    const suspiciousEnvAssignments = [
        {
            key: 'TELEGRAM_BOT_TOKEN',
            // allow placeholders + obvious test tokens
            re: /^TELEGRAM_BOT_TOKEN\s*=\s*(.+)$/gm,
            allowValue: (v) =>
                /^(PLACEHOLDER|your_.*|test.*|0000.*|changeme)$/i.test(v.trim()),
        },
        {
            key: 'SECRET_KEY',
            re: /^SECRET_KEY\s*=\s*(.+)$/gm,
            allowValue: (v) => /^(PLACEHOLDER|your_.*|test.*|changeme)$/i.test(v.trim()),
        },
        {
            key: 'POSTGRES_PASSWORD',
            re: /^POSTGRES_PASSWORD\s*=\s*(.+)$/gm,
            allowValue: (v) =>
                /^(PLACEHOLDER|your_.*|test.*|changeme|fittracker_password)$/i.test(v.trim()),
        },
        {
            key: 'SENTRY_DSN',
            re: /^SENTRY_DSN\s*=\s*(.+)$/gm,
            allowValue: (v) => v.trim() === '' || /^(PLACEHOLDER)$/i.test(v.trim()),
        },
    ]

    for (const rule of suspiciousEnvAssignments) {
        for (const match of content.matchAll(rule.re)) {
            const value = match[1] ?? ''
            if (!rule.allowValue(value)) {
                findings.push(`${rule.key} has a non-placeholder value`)
            }
        }
    }

    return findings
}

function main() {
    const stagedFiles = getStagedFiles()
    if (stagedFiles.length === 0) return

    const violations = []
    for (const filePath of stagedFiles) {
        if (isAllowlistedPath(filePath)) continue

        // Don't try to read deleted/renamed files
        if (!fs.existsSync(filePath)) continue

        let content = ''
        try {
            content = fs.readFileSync(filePath, 'utf8')
        } catch {
            continue
        }

        const findings = scanContent(filePath, content)
        if (findings.length > 0) {
            violations.push({ filePath, findings })
        }
    }

    if (violations.length > 0) {
        console.error('Blocked commit: possible secrets detected in staged files.')
        for (const v of violations) {
            console.error(`- ${v.filePath}: ${v.findings.join('; ')}`)
        }
        console.error(
            'Fix: move secrets to untracked .env files / GitHub Secrets and commit only *.example templates.'
        )
        process.exit(1)
    }
}

main()
