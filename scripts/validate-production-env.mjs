import fs from 'node:fs'
import path from 'node:path'

const envFile = process.argv[2] ?? '.env'
const repoRoot = process.cwd()

function parseEnv(content) {
    const env = {}
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (!match) continue

        const key = match[1]
        let value = match[2].trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        env[key] = value
    }
    return env
}

function isHttpsUrl(value) {
    try {
        const parsed = new URL(value)
        return parsed.protocol === 'https:'
    } catch {
        return false
    }
}

function addRequiredError(errors, env, name) {
    if (!env[name] || env[name].trim() === '') {
        errors.push(`${name} is required`)
        return true
    }
    return false
}

function validateAllowedOrigins(errors, value) {
    if (!value || value.trim() === '') {
        errors.push('ALLOWED_ORIGINS is required')
        return
    }

    const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)

    if (origins.length === 0) {
        errors.push('ALLOWED_ORIGINS must include at least one origin')
        return
    }

    for (const origin of origins) {
        if (origin === '*' || origin.includes('*')) {
            errors.push('ALLOWED_ORIGINS must not contain wildcard origins')
            continue
        }
        if (!isHttpsUrl(origin)) {
            errors.push('ALLOWED_ORIGINS must contain only HTTPS origins')
        }
    }
}

function validateApiUrl(errors, env, name) {
    if (addRequiredError(errors, env, name)) return
    if (!env[name].includes('/api/v1')) {
        errors.push(`${name} must include /api/v1`)
    }
}

function validatePathValue(warnings, env, name) {
    if (!env[name] || env[name].trim() === '') return

    const resolved = path.resolve(repoRoot, env[name])
    const relative = path.relative(repoRoot, resolved)
    const outsideRepo = relative.startsWith('..') || path.isAbsolute(relative)
    if (!outsideRepo) {
        warnings.push(`${name} is inside the repository; production should prefer a host path outside git`)
    }
}

function main() {
    if (!fs.existsSync(envFile)) {
        console.error(`Production env validation failed: ${envFile} was not found.`)
        process.exit(1)
    }

    const env = parseEnv(fs.readFileSync(envFile, 'utf8'))
    const errors = []
    const warnings = []

    if (!addRequiredError(errors, env, 'IMAGE_TAG') && env.IMAGE_TAG === 'latest') {
        errors.push("IMAGE_TAG must not be 'latest'")
    }

    for (const name of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
        addRequiredError(errors, env, name)
    }

    if (!addRequiredError(errors, env, 'SECRET_KEY') && env.SECRET_KEY.length < 32) {
        errors.push('SECRET_KEY must be at least 32 characters long')
    }

    addRequiredError(errors, env, 'TELEGRAM_BOT_TOKEN')

    if (!addRequiredError(errors, env, 'TELEGRAM_WEBAPP_URL') && !isHttpsUrl(env.TELEGRAM_WEBAPP_URL)) {
        errors.push('TELEGRAM_WEBAPP_URL must be an HTTPS URL')
    }

    validateAllowedOrigins(errors, env.ALLOWED_ORIGINS)
    validateApiUrl(errors, env, 'API_URL')
    validateApiUrl(errors, env, 'VITE_API_URL')
    validatePathValue(warnings, env, 'NGINX_SSL_DIR')
    validatePathValue(warnings, env, 'BACKUPS_DIR')

    for (const warning of warnings) {
        console.warn(`warning: ${warning}`)
    }

    if (errors.length > 0) {
        console.error('Production env validation failed:')
        for (const error of errors) {
            console.error(`- ${error}`)
        }
        process.exit(1)
    }

    console.log('Production env validation passed. Values were not printed.')
}

main()
