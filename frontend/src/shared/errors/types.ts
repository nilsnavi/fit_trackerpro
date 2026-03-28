/**
 * Unified client-side error payload for UI, logging, and analytics.
 * All API failures should be mapped into this shape.
 */
export interface ClientFieldError {
    /** Dot-separated path when available, e.g. "body.weight" */
    field: string
    message: string
}

export interface ClientError {
    /** HTTP status when the failure is from the API; null for network/client issues */
    status: number | null
    /** Stable machine-readable code */
    code: string
    /** Primary human-readable message */
    message: string
    fieldErrors?: ClientFieldError[]
    /** Request URL without query string when known */
    requestUrl?: string
}

/** FastAPI validation error item (OpenAPI / Pydantic) */
export interface FastAPIValidationItem {
    loc?: (string | number)[]
    msg: string
    type?: string
}
