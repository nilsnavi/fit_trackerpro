# Exercise Progress Feature

Экран прогресса по упражнениям на основе завершенных тренировок.

## Возможности

### 1. Выбор упражнения
- Выпадающий список с поиском
- Автоматическая загрузка списка из истории тренировок
- Фильтрация по названию

### 2. Ключевые метрики
- **Лучший вес** - максимальный вес в подходе
- **Лучший объем** - максимальный объем (вес × повторения) за тренировку
- **Средний вес** - средний рабочий вес по всем подходам
- **Количество выполнений** - общее количество подходов

### 3. Графики (Recharts)
- **Прогресс веса** - линейный график изменения максимального веса по датам
- **Прогресс объема** - area chart изменения общего объема по датам
- Интерактивные tooltips
- Адаптивный дизайн
- Поддержка темной темы

### 4. История подходов
- Хронологический список всех тренировок с этим упражнением
- Отображение веса, повторений и количества подходов
- Группировка по датам
- Сортировка от новых к старым

## Технические детали

### Данные
Все данные берутся **только из завершенных тренировок** через endpoint `/workouts/history`.

### Хуки

#### useExerciseProgress
Получает и обрабатывает прогресс по конкретному упражнению.

```typescript
interface UseExerciseProgressParams {
    exerciseId: number | null
    dateFrom?: string | null
    dateTo?: string | null
}

interface ExerciseProgressData {
    exerciseId: number
    exerciseName: string
    dates: string[]
    weights: (number | null)[]
    volumes: (number | null)[]
    reps: (number | null)[]
    sets: number[]
    bestWeight: number | null
    bestVolume: number | null
    avgWeight: number | null
    totalExecutions: number
}
```

#### useExercisesList
Получает список всех уникальных упражнений из истории тренировок.

### Компоненты

#### ExerciseSelector
Компонент выбора упражнения с поиском.

**Props:**
- `exercises`: массив упражнений
- `selectedExerciseId`: ID выбранного упражнения
- `onSelect`: callback при выборе
- `isLoading`: флаг загрузки

#### ExerciseMetrics
Отображает 4 ключевые метрики в сетке 2x2.

**Props:**
- `bestWeight`: лучший вес
- `bestVolume`: лучший объем
- `avgWeight`: средний вес
- `totalExecutions`: количество выполнений

#### ExerciseWeightChart
Линейный график прогресса веса.

**Props:**
- `dates`: массив дат
- `weights`: массив весов (может содержать null)

#### ExerciseVolumeChart
Area chart прогресса объема.

**Props:**
- `dates`: массив дат
- `volumes`: массив объемов (может содержать null)

#### ExerciseSetHistory
История подходов с группировкой по датам.

**Props:**
- `history`: массив объектов с данными о подходах

#### ExerciseProgressSkeleton
Skeleton компонент для состояния загрузки.

## Использование

### Маршрутизация
```tsx
// В routes.tsx уже настроено:
<Route
    path="/progress/exercises"
    element={
        <RouteGuard screenTitle="Прогресс упражнений" skeleton={<ProgressExercisesSkeleton />}>
            <ExerciseProgressPage />
        </RouteGuard>
    }
/>
```

### Навигация
```tsx
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()
navigate('/progress/exercises')
```

## API Integration

### Endpoint
`GET /workouts/history`

### Параметры
```typescript
{
    page: number
    page_size: number  // по умолчанию 200
    date_from?: string  // формат YYYY-MM-DD
    date_to?: string    // формат YYYY-MM-DD
}
```

### Обработка данных
1. Загружаются все тренировки за выбранный период
2. Фильтруются упражнения по выбранному exercise_id
3. Собираются все completed sets
4. Вычисляются метрики:
   - Вес = weight из set
   - Объем = weight × reps
   - Группировка по датам
   - Агрегация лучших/средних показателей

## Styling

Используется Tailwind CSS с поддержкой Telegram WebApp темы:
- `bg-telegram-bg` - основной фон
- `bg-telegram-secondary-bg` - вторичный фон
- `text-telegram-text` - основной текст
- `text-telegram-hint` - вспомогательный текст
- `border-border` - границы
- `text-primary` - акцентный цвет

Поддерживается dark mode через CSS переменные.

## Производительность

### Оптимизации
- React Query кэширование (staleTime: 60 секунд)
- useMemo для тяжелых вычислений
- Ленивая загрузка графиков Recharts
- Skeleton loading вместо спиннеров

### Пагинация
Загружается до 200 тренировок за один запрос. Для больших объемов данных рекомендуется добавить пагинацию.

## Будущие улучшения

1. **Сравнение упражнений**
   - Возможность выбрать несколько упражнений
   - Наложение графиков друг на друга

2. **Расширенная аналитика**
   - Тренд прогресса (линия тренда)
   - Прогноз будущих результатов
   - Корреляция между упражнениями

3. **Экспорт данных**
   - CSV экспорт истории подходов
   - PDF отчет с графиками

4. **Фильтры**
   - По типу тренировки
   - По диапазону веса
   - По количеству повторений

5. **Уведомления**
   - Уведомление о новом личном рекорде
   - Напоминание о тренировке упражнения
