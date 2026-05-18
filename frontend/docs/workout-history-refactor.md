# Рефакторинг экрана истории тренировок

## Обзор изменений

Полностью переделан экран истории тренировок (`WorkoutHistoryPage`) с улучшенным UX и новыми функциями.

## Новые возможности

### 1. **Infinite Scroll (Бесконечная прокрутка)**
- Автоматическая подгрузка тренировок при прокрутке
- Использование React Query `useInfiniteQuery`
- IntersectionObserver для отслеживания конца списка
- Индикатор загрузки при подгрузке новых данных

### 2. **Улучшенные фильтры**
- **По типу тренировки:**
  - Все
  - Силовые
  - Кардио
  - Гибкость
  - Смешанные
  - Пользовательские

- **По периоду:**
  - Все время
  - Неделя (последние 7 дней)
  - Месяц (последние 30 дней)

### 3. **Информативные карточки тренировок**
Каждая карточка отображает:
- Название тренировки
- Дата проведения
- Длительность (в минутах)
- Количество подходов
- Общий объем (в тоннах)
- Иконку типа тренировки
- Статус (завершена/в процессе)
- Кнопку "Повторить тренировку" (только для завершенных)

### 4. **Skeleton Loading**
- Плавная анимация загрузки
- Показывает структуру карточек во время загрузки
- Улучшает восприятие производительности

### 5. **Empty State**
- Информативное сообщение при отсутствии тренировок
- Кнопка "Начать тренировку" для быстрого старта
- Адаптивное описание в зависимости от контекста

### 6. **Dark Mobile UI**
- Полная поддержка темной темы Telegram WebApp
- Оптимизировано для мобильных устройств
- Touch-friendly элементы управления
- Плавные анимации и переходы

### 7. **Кнопка "Повторить"**
- Быстрый старт аналогичной тренировки
- Сохраняет тип тренировки
- Добавляет "(повтор)" к названию
- Автоматический переход к активной сессии

### 8. **Быстрый переход в детали**
- Клик по карточке открывает детали тренировки
- Плавная навигация без задержек
- Сохранение состояния фильтров

## Технические детали

### Новые файлы

#### Хуки
- `frontend/src/features/workouts/hooks/useWorkoutHistoryInfinite.ts`
  - Хук для infinite scroll с фильтрацией
  - Поддержка пагинации на backend
  - Интеграция с offline режимом

#### Компоненты
- `frontend/src/features/workouts/history/components/WorkoutHistoryCard.tsx`
  - Карточка тренировки с метриками
  - Вычисление общего объема и количества подходов
  - Обработчики навигации и повторения

- `frontend/src/features/workouts/history/components/WorkoutHistoryFilters.tsx`
  - Компонент фильтров с горизонтальной прокруткой
  - Визуальная индикация активных фильтров
  - Адаптивный дизайн

- `frontend/src/features/workouts/history/components/WorkoutHistoryCardSkeleton.tsx`
  - Skeleton для состояния загрузки
  - Анимация пульсации
  - Повторяющиеся элементы

- `frontend/src/features/workouts/history/components/InfiniteScrollTrigger.tsx`
  - Триггер для бесконечной прокрутки
  - IntersectionObserver API
  - Индикатор загрузки

#### Документация
- `frontend/src/features/workouts/history/README.md`
  - Полная документация компонентов
  - Примеры использования
  - Описание API integration

#### Тесты
- `frontend/src/features/workouts/history/components/WorkoutHistoryCard.test.tsx`
  - Unit тесты для карточки
  - Проверка рендеринга
  - Проверка обработчиков событий

### Измененные файлы
- `frontend/src/features/workouts/pages/WorkoutHistoryPage.tsx`
  - Полностью переписан с использованием новых компонентов
  - Интеграция с `useWorkoutHistoryInfinite`
  - Улучшенная обработка ошибок

## Архитектура

### Структура данных
```typescript
interface WorkoutHistoryItem {
    id: number
    date: string
    duration: number | null
    comments: string | null
    tags: string[]
    exercises: CompletedExercise[]
    session_metrics?: WorkoutSessionMetrics
    // ... другие поля
}
```

### Вычисление метрик
```typescript
// Общий объем = сумма(weight * reps) для всех подходов
totalVolume = Σ(weight × reps)

// Количество подходов = количество completed sets
totalSets = count(completed sets)

// Объем в тоннах = totalVolume / 1000
volumeInTons = totalVolume / 1000
```

### Пагинация
- Размер страницы: 20 элементов
- Backend endpoint: `/workouts/history`
- Параметры: `page`, `page_size`, `date_from`, `date_to`, `workout_type`
- Infinite scroll с prefetch на 200px до конца

## UX улучшения

1. **Мгновенная обратная связь**
   - Skeleton loading вместо спиннера
   - Плавные переходы между состояниями
   - Визуальная индикация активных фильтров

2. **Оптимизация для мобильных**
   - Крупные touch targets (минимум 44x44px)
   - Горизонтальная прокрутка фильтров
   - Swipe-friendly карточки

3. **Доступность**
   - ARIA labels для скринридеров
   - Keyboard navigation
   - Semantic HTML

4. **Производительность**
   - Ленивая загрузка через infinite scroll
   - Оптимизированные re-renders с useMemo
   - Кэширование через React Query

## Интеграция с существующим кодом

### Маршрутизация
Маршрут уже настроен в `routes.tsx`:
```tsx
<Route
    path="/workouts/history"
    element={
        <RouteGuard screenTitle="История тренировок" skeleton={<WorkoutHistorySkeleton />}>
            <WorkoutHistoryPage />
        </RouteGuard>
    }
/>
```

### API Integration
Использует существующий endpoint:
```typescript
workoutsApi.getHistory({
    page: number,
    page_size: number,
    date_from?: string,
    date_to?: string,
    workout_type?: string
})
```

### Offline Support
Интегрировано с offline режимом через `offlineListQueryDefaults`.

## Будущие улучшения

Возможные расширения функциональности:

1. **Расширенная аналитика**
   - График прогресса объема
   - Сравнение с предыдущими тренировками
   - Рекомендации по весу

2. **Дополнительные фильтры**
   - По упражнениям
   - По диапазону дат (кастомный)
   - По длительности

3. **Экспорт данных**
   - CSV экспорт истории
   - PDF отчет
   - Share функциональность

4. **Группировка**
   - Группировка по неделям/месяцам
   - Collapsible секции
   - Sticky headers для дат

5. **Поиск**
   - Поиск по названию тренировки
   - Поиск по упражнениям
   - Фильтрация по тегам

## Тестирование

### Запуск тестов
```bash
npm test -- WorkoutHistoryCard
```

### E2E тесты
Рекомендуется добавить E2E тесты для:
- Фильтрации по типу
- Фильтрации по периоду
- Infinite scroll поведения
- Кнопки "Повторить"
- Навигации к деталям

## Миграция

Старая реализация полностью заменена. Если нужно сохранить старый код:
```bash
git checkout HEAD~1 -- frontend/src/features/workouts/pages/WorkoutHistoryPage.tsx
```

Новая реализация обратно совместима с существующими API и типами данных.
