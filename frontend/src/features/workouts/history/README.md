# Workout History Feature

Экран истории тренировок с поддержкой бесконечной прокрутки, фильтрации и быстрого повторения тренировок.

## Компоненты

### WorkoutHistoryPage
Основная страница истории тренировок.

**Возможности:**
- Бесконечная прокрутка (infinite scroll)
- Фильтрация по типу тренировки
- Фильтрация по периоду (все время, неделя, месяц)
- Skeleton loading состояние
- Empty state
- Кнопка "Повторить тренировку"
- Быстрый переход к деталям тренировки

### WorkoutHistoryCard
Карточка отдельной тренировки в списке.

**Отображаемая информация:**
- Название тренировки
- Дата проведения
- Длительность (в минутах)
- Количество подходов
- Общий объем (в тоннах)
- Тип тренировки (иконка)
- Статус (завершена/в процессе)
- Кнопка "Повторить"

### WorkoutHistoryFilters
Компонент фильтров для истории тренировок.

**Фильтры:**
- По типу тренировки: Все, Силовые, Кардио, Гибкость, Смешанные, Пользовательские
- По периоду: Все время, Неделя, Месяц

### WorkoutHistoryCardSkeleton
Skeleton компонент для состояния загрузки карточек тренировок.

### InfiniteScrollTrigger
Компонент для реализации бесконечной прокрутки с использованием IntersectionObserver.

## Хуки

### useWorkoutHistoryInfinite
Хук для получения истории тренировок с поддержкой пагинации и фильтрации.

**Параметры:**
```typescript
interface UseWorkoutHistoryInfiniteParams {
    type?: WorkoutHistoryFilterType  // 'all' | 'strength' | 'cardio' | 'flexibility' | 'mixed' | 'custom'
    datePreset?: WorkoutHistoryDatePreset  // 'all' | 'week' | 'month'
    pageSize?: number  // количество элементов на странице (по умолчанию 20)
}
```

**Возвращаемое значение:**
Стандартный объект React Query useInfiniteQuery с дополнительными полями:
- `data` - страницы с данными
- `fetchNextPage()` - функция для загрузки следующей страницы
- `hasNextPage` - флаг наличия следующих страниц
- `isFetchingNextPage` - флаг загрузки следующей страницы
- `isLoading` - флаг первоначальной загрузки
- `isError` - флаг ошибки
- `error` - объект ошибки
- `refetch()` - функция для повторного запроса

## Использование

```tsx
import { WorkoutHistoryPage } from '@features/workouts/history'

// В роутере
<Route path="/workouts/history" element={<WorkoutHistoryPage />} />
```

## API Integration

Хук использует endpoint `/workouts/history` с параметрами:
- `page` - номер страницы
- `page_size` - размер страницы
- `date_from` - начальная дата (опционально)
- `date_to` - конечная дата (опционально)
- `workout_type` - тип тренировки (опционально)

## Styling

Все компоненты используют Tailwind CSS с поддержкой Telegram WebApp темы:
- `bg-telegram-bg` - основной фон
- `bg-telegram-secondary-bg` - вторичный фон
- `text-telegram-text` - основной текст
- `text-telegram-hint` - вспомогательный текст
- `border-border` - границы

Поддерживается dark mode через CSS переменные Telegram WebApp.
