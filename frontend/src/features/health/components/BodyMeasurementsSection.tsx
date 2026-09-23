/**
 * Секция замеров тела: запрос (владелец сети) + презентационная карточка (WS2-1).
 *
 * Запрос отделён от карточки, чтобы её состояния (пусто/ошибка/загрузка)
 * проверялись юнит-тестами без React Query.
 */
import { useBodyMeasurementsQuery } from '@features/health/hooks/useHealthQueries'
import { BodyMeasurementsCard } from '@features/health/components/BodyMeasurementsCard'

const MEASUREMENTS_PAGE_SIZE = 50

export function BodyMeasurementsSection() {
    const query = useBodyMeasurementsQuery({ page_size: MEASUREMENTS_PAGE_SIZE })

    return (
        <BodyMeasurementsCard
            items={query.data?.items ?? []}
            isLoading={query.isLoading}
            isError={query.isError}
            onRetry={() => void query.refetch()}
        />
    )
}
