import { resolveBackendReadinessUrl } from '../readinessUrl'

describe('resolveBackendReadinessUrl', () => {
    const page = 'https://app.example.com'

    it('keeps a same-origin relative API on the page origin', () => {
        expect(resolveBackendReadinessUrl('/api/v1', page)).toBe('/health/ready')
        expect(resolveBackendReadinessUrl('/api/v1/', page)).toBe('/health/ready')
    })

    it('checks a backend on another origin there, not on the SPA origin', () => {
        expect(resolveBackendReadinessUrl('http://localhost:8000/api/v1', 'http://localhost:5173')).toBe(
            'http://localhost:8000/health/ready',
        )
        expect(resolveBackendReadinessUrl('https://api.example.com/api/v1', page)).toBe(
            'https://api.example.com/health/ready',
        )
    })

    it('treats an absolute API URL on the page origin as same-origin', () => {
        expect(resolveBackendReadinessUrl('https://app.example.com/api/v1', page)).toBe('/health/ready')
    })

    it('keeps a reverse-proxy path prefix', () => {
        expect(resolveBackendReadinessUrl('https://x.example.com/backend/api/v1', page)).toBe(
            'https://x.example.com/backend/health/ready',
        )
        expect(resolveBackendReadinessUrl('/backend/api/v1', page)).toBe('/backend/health/ready')
    })

    it('works without a page origin', () => {
        expect(resolveBackendReadinessUrl('/api/v1')).toBe('/health/ready')
        expect(resolveBackendReadinessUrl('https://api.example.com/api/v1', 'null')).toBe(
            'https://api.example.com/health/ready',
        )
    })

    it('falls back to the conventional path for an unparsable URL', () => {
        expect(resolveBackendReadinessUrl('http://', page)).toBe('/health/ready')
    })
})
