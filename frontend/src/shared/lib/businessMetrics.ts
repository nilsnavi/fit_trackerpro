/**
 * Продуктовые business-метрики (клиент). Единая точка вызова для последующего
 * подключения провайдера (PostHog, свой бэкенд и т.д.).
 */

export type BusinessMetricEvent =
    | 'started_workout'
    | 'completed_workout'
    | 'abandoned_workout'
    | 'created_template'
    | 'viewed_analytics'

export type BusinessMetricProperties = Record<
    string,
    string | number | boolean | null | undefined
>

export type BusinessMetricSink = (
    event: BusinessMetricEvent,
    properties: BusinessMetricProperties,
) => void

let sink: BusinessMetricSink | null = null

/** Подключение внешнего сборщика (например, в main.tsx). */
export function setBusinessMetricSink(next: BusinessMetricSink | null): void {
    sink = next
}

export function trackBusinessMetric(
    event: BusinessMetricEvent,
    properties: BusinessMetricProperties = {},
): void {
    if (import.meta.env.DEV) {
        console.debug('[business-metric]', event, properties)
    }
    sink?.(event, properties)
}
