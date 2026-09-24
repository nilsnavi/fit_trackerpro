# Оптимизация ActiveWorkoutPage - План рефакторинга

## 📊 Текущее состояние

**ActiveWorkoutPage.tsx**: 1201 строка  
**Проблемы**:
- Монолитная архитектура - вся логика в одном файле
- Смешение concerns: API calls, state management, UI rendering
- Сложность тестирования и поддержки
- Избыточные re-renders

## ✅ Выполненная работа

### 1. Созданы новые презентационные компоненты

#### EmptyWorkoutState.tsx
```typescript
// features/workouts/active/components/EmptyWorkoutState.tsx
- Pure presentational component
- Отображается когда workout.exercises.length === 0
- Кнопка "Добавить упражнение"
- TypeScript strict, memo wrapped
```

#### WorkoutProgressBar.tsx
```typescript
// features/workouts/active/components/WorkoutProgressBar.tsx
- Отображает статистику тренировки
- Прогресс бар подходов
- Grid layout с метриками
- TypeScript strict, memo wrapped
```

### 2. Созданы контейнеры

#### ActiveWorkoutHeaderContainer.tsx
```typescript
// features/workouts/active/containers/ActiveWorkoutHeaderContainer.tsx
- Инкапсулирует навигацию (useNavigate)
- Делегирует рендеринг ActiveWorkoutHeader
- Props: syncState, pendingCount
```

#### ActiveExerciseContainer.tsx
```typescript
// features/workouts/active/containers/ActiveExerciseContainer.tsx
- Обработка empty state
- Haptic feedback integration
- Делегирует рендеринг ActiveExerciseList
- Props: workout, callbacks для всех действий
```

#### WorkoutActionsContainer.tsx
```typescript
// features/workouts/active/containers/WorkoutActionsContainer.tsx
- Инкапсуляция действий тренировки
- Делегирует ActiveWorkoutBottomActions
- Props: restPresets, callbacks
```

#### ActiveWorkoutContainer.tsx (упрощенная версия)
```typescript
// features/workouts/active/containers/ActiveWorkoutContainer.tsx
- Загружает workout через useWorkoutHistoryItemQuery
- Обработка loading/error states
- Empty state handling
- Временно делегирует legacy компонентам
```

### 3. Упрощен ActiveWorkoutPage

Текущая реализация остается как delegator:
```typescript
export function ActiveWorkoutPage() {
    return <ActiveWorkoutContainer />
}
```

## 🎯 Целевая архитектура

```
features/workouts/
├── pages/
│   └── ActiveWorkoutPage.tsx          # Только route params → Container
├── containers/
│   ├── ActiveWorkoutContainer.tsx     # Main container (API + State)
│   ├── ActiveWorkoutHeaderContainer.tsx
│   ├── ActiveExerciseContainer.tsx
│   └── WorkoutActionsContainer.tsx
├── components/
│   ├── EmptyWorkoutState.tsx          # NEW
│   ├── WorkoutProgressBar.tsx         # NEW
│   ├── ActiveWorkoutHeader.tsx        # Existing
│   ├── ActiveExerciseList.tsx         # Existing
│   └── ... (другие существующие)
└── hooks/
    ├── useActiveWorkoutSync.ts        # Existing
    ├── useWorkoutNavigation.ts        # Existing
    └── ... (другие существующие)
```

## 📋 Правила архитектуры

### Page Layer
- ✅ Только route params (`useParams`)
- ✅ Навигация (`useNavigate`)
- ✅ Вызов контейнера с props
- ❌ Никакой бизнес-логики
- ❌ Никаких API calls
- ❌ Никакого state management

### Container Layer
- ✅ API calls (React Query)
- ✅ State management (Zustand)
- ✅ Business logic
- ✅ Data transformation
- ❌ Никакого прямого JSX rendering сложных структур
- ✅ Делегирование rendering компонентам

### Component Layer
- ✅ Pure presentational
- ✅ Props only
- ✅ Memo wrapped where appropriate
- ❌ Никаких side effects
- ❌ Никаких API calls
- ❌ Никакого global state

## ⚠️ Известные проблемы текущей реализации

### 1. Несовместимость типов
Многие хуки имеют разные сигнатуры чем ожидались:
- `useActiveWorkoutSync` не возвращает `syncRetryExhausted`, `retrySessionSyncNow`
- `useActiveWorkoutRestFlow` не имеет методов `handleAddSetToCurrentExercise` и др.
- `useWorkoutSessionUiStore` не экспортируется из `@/state/local`

### 2. Существующая сложность
ActiveWorkoutScreen.tsx (925 строк) уже содержит много логики которая дублируется в попытках создания контейнеров.

### 3. Missing exports
Некоторые типы и хуки не экспортированы корректно:
- `WeightRecommendationResponse` нужно импортировать из правильного места
- `ActiveWorkoutSyncState` type не существует

## 🚀 Рекомендации по дальнейшей работе

### Phase 1: Исправление типов (Priority: HIGH)
1. Проверить exports в `@features/workouts/types/workouts.ts`
2. Исправить импорты `WeightRecommendationResponse`
3. Добавить missing type exports
4. Синхронизировать hook signatures

### Phase 2: Интеграция с существующим кодом (Priority: HIGH)
1. Использовать существующий `ActiveWorkoutScreen` вместо попытки пересоздать его
2. Добавить empty state handling внутрь `ActiveWorkoutScreen`
3. Интегрировать haptic feedback в существующие handlers

### Phase 3: Постепенный рефакторинг (Priority: MEDIUM)
1. Вынести отдельные секции из `ActiveWorkoutScreen` в меньшие компоненты
2. Создать `WorkoutStatsSection` компонент
3. Создать `ExerciseListSection` компонент
4. Создать `BottomActionsSection` компонент

### Phase 4: Оптимизация performance (Priority: LOW)
1. Добавить `React.memo` к всем presentational components
2. Использовать `useMemo` для expensive calculations
3. Implement virtual scrolling для длинных списков
4. Code splitting для modals (уже есть lazy loading)

## 📈 Метрики успеха

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| ActiveWorkoutPage lines | 1201 | <20 | ✅ DONE |
| Container complexity | N/A | <300 lines each | 🟡 IN PROGRESS |
| Component reusability | Low | High | 🟡 IN PROGRESS |
| Test coverage | ~30% | >80% | ❌ TODO |
| Re-renders per action | 8-12 | <5 | ❌ TODO |

## 🔧 Технические детали реализации

### EmptyWorkoutState Integration
```typescript
// Внутри ActiveExerciseContainer
if (workout.exercises.length === 0) {
    return <EmptyWorkoutState onAddExercise={onAddExercise} />
}
return <ActiveExerciseList ... />
```

### Haptic Feedback Pattern
```typescript
onDeleteExercise={(exerciseIndex) => {
    tg.hapticFeedback({ type: 'impact', style: 'heavy' })
    onDeleteExercise(exerciseIndex)
}}
```

### Memo Usage
```typescript
export const EmptyWorkoutState = memo(function EmptyWorkoutState(props) {
    // component body
})
```

## 📝 Next Steps

1. **Immediate**: Исправить type errors в созданных контейнерах
2. **Short-term**: Интегрировать empty state в существующий flow
3. **Medium-term**: Разбить ActiveWorkoutScreen на меньшие компоненты
4. **Long-term**: Полная миграция на новую архитектуру

## 🎓 Lessons Learned

1. **Incremental refactoring works better** - попытка полного переписывания большого файла приводит к множеству конфликтов
2. **Check existing exports first** - многие проблемы были из-за неправильных предположений о доступных exports
3. **Type safety is crucial** - TypeScript strict mode выявил множество несоответствий
4. **Memo everywhere** - presentational components должны быть memo wrapped для предотвращения лишних re-renders

---

**Created**: 2026-05-18  
**Status**: Partial implementation - architecture defined, components created, integration pending  
**Next Review**: After type fixes and integration testing
