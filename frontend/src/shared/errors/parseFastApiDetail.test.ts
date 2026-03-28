import { parseFastApiDetail } from './parseFastApiDetail'
import { normalizeFromHttpResponse } from './normalizeError'
import { ErrorCodes } from './errorCodes'

describe('parseFastApiDetail', () => {
    it('maps string detail', () => {
        expect(parseFastApiDetail('Not found')).toEqual({ message: 'Not found' })
    })

    it('maps validation array', () => {
        const r = parseFastApiDetail([
            { loc: ['body', 'weight'], msg: 'must be positive', type: 'value_error' },
        ])
        expect(r.fieldErrors).toHaveLength(1)
        expect(r.fieldErrors?.[0].field).toBe('body.weight')
        expect(r.message).toContain('must be positive')
    })
})

describe('normalizeFromHttpResponse', () => {
    it('uses VALIDATION_ERROR for 422', () => {
        const ce = normalizeFromHttpResponse(422, {
            detail: [{ loc: ['query', 'x'], msg: 'required', type: 'missing' }],
        })
        expect(ce.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(ce.status).toBe(422)
        expect(ce.fieldErrors?.[0].field).toBe('query.x')
    })

    it('unwraps FastAPI wrapper detail', () => {
        const ce = normalizeFromHttpResponse(400, { detail: 'Bad input' })
        expect(ce.message).toBe('Bad input')
        expect(ce.code).toBe('HTTP_400')
    })
})
