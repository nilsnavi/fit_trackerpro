# Чистая компонентная архитектура тренировок

## Обзор

Рефакторинг frontend модуля тренировок к чистой компонентной архитектуре с четким разделением ответственности.

## Архитектура

```
features/workouts/
├── api/                    # API слой (HTTP запросы)
│   └── workouts.api.ts    # Чистые API вызовы без бизнес-логики
├── hooks/                  # React хуки
│   ├── useActiveWorkout.ts       # Управление активной тренировкой
│   ├── useRestTimer.ts           # Таймер отдыха
│   └── useWorkoutSession.ts      # Высокоуровневый хук сессии
├── store/                  # Zustand stores (UI/session state)
│   └── workoutSession.store.ts  # Store состояния тренировки
├── components/             # UI компоненты (pure)
│   ├── ActiveWorkoutScreen.tsx   # Главный экран тренировки
│   ├── ExerciseCard.tsx          # Карточка упражнения
│   ├── SetTable.tsx              # Таблица подходов
│   ├── SetRow.tsx                # Строка подхода
│   ├── RestTimer.tsx             # Таймер отдыха
│   ├── WeightRecommendation.tsx  # Рекомендации по весу
│   ├── CompleteWorkoutButton.tsx # Кнопка завершения
│   ├── WorkoutSummary.tsx        # Сводка тренировки
│   └── StartWorkoutSheet.tsx     # Bottom sheet начала
└── pages/                  # Страницы (маршруты)
    ├── WorkoutDashboardPage.tsx  # Дашборд тренировок
    ├── WorkoutHistoryPage.tsx    # История тренировок
    └── WorkoutProgressPage.tsx   # Прогресс тренировок
```

## Принципы архитектуры

### 1. Разделение ответственности

#### API Layer (`api/`)
- **Только** HTTP запросы
- Нормализация данных из API
- **Никакой** бизнес-логики
- **Никакого** состояния

```typescript
// ✅ Правильно
export const workoutsApi = {
    getHistory(params) {
        return api.get('/workouts/history', params)
    }
}

// ❌ Неправильно
export const workoutsApi = {
    getHistory(params) {
        // Бизнес-логика здесь - плохо!
        const data = api.get(...)
        return processData(data)
    }
}
```

#### Hooks Layer (`hooks/`)
- **Бизнес-логика** в хуках
- Комбинация React Query + Zustand
- Переиспользуемая логика

```typescript
// Хук для server state (React Query)
useQuery({ queryKey, queryFn })

// Хук для session state (Zustand)
const store = useWorkoutSessionStore()

// Комбинированный хук
function useWorkoutSession() {
    const query = useQuery(...)  // server state
    const store = useStore()     // session state
    return { ...query, ...store }
}
```

#### Store Layer (`store/`)
- **Только** UI/session state
- Zustand для локального состояния
- **Никаких** API вызовов

```typescript
// ✅ Session state
interface WorkoutSessionState {
    isActive: boolean
    exercises: Exercise[]
    currentExerciseIndex: number | null
}

// ❌ Не добавлять server state
interface WorkoutSessionState {
    history: Workout[]  // Это должно быть в React Query!
}
```

#### Components Layer (`components/`)
- **Pure UI** компоненты
- **Никакой** бизнес-логики
- Получают данные через props
- Вызывают callbacks для действий

```typescript
// ✅ Pure component
function ExerciseCard({ exercise, onClick }) {
    return <button onClick={onClick}>{exercise.name}</button>
}

// ❌ Component with business logic
function ExerciseCard({ exerciseId }) {
    const data = fetchData(exerciseId)  // Плохо!
    return <div>{data.name}</div>
}
```

#### Pages Layer (`pages/`)
- Композиция компонентов
- Подключение хуков
- Маршрутизация

```typescript
function WorkoutDashboardPage() {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    
    return (
        <div>
            <button onClick={() => setIsOpen(true)}>Start</button>
            <StartWorkoutSheet isOpen={isOpen} onClose={...} />
        </div>
    )
}
```

### 2. State Management

#### Server State → React Query
- Данные с сервера
- Кэширование
- Синхронизация
- Инвалидация

```typescript
// История тренировок - server state
const { data } = useQuery({
    queryKey: ['workouts', 'history'],
    queryFn: () => workoutsApi.getHistory(),
})
```

#### Session State → Zustand
- Локальное состояние сессии
- UI state
- Временные данные

```typescript
// Активная тренировка - session state
const { exercises, currentExerciseIndex } = useWorkoutSessionStore()
```

### 3. Data Flow

```
User Action
    ↓
Component (onClick)
    ↓
Hook (business logic)
    ↓
API (HTTP request)
    ↓
Server
    ↓
React Query (cache update)
    ↓
Component re-render
```

## Примеры использования

### Начало тренировки

```typescript
// 1. Пользователь нажимает кнопку
<StartWorkoutSheet onSelectWorkout={handleStart} />

// 2. Обработчик в странице
function handleStart(type: WorkoutType) {
    navigate(`/workouts/active/new?type=${type}`)
}

// 3. Инициализация сессии
const { initialize } = useActiveWorkout({ workoutId })
initialize()
```

### Обновление подхода

```typescript
// 1. Пользователь отмечает подход
<SetRow onToggle={() => handleSetToggle(index)} />

// 2. Хук обрабатывает логику
function handleSetToggle(setIndex: number) {
    updateSets(exerciseIndex, updatedSets)  // Zustand
    debouncedSyncToServer()                  // React Query mutation
}
```

### Завершение тренировки

```typescript
// 1. Пользователь завершает тренировку
<CompleteWorkoutButton onComplete={handleComplete} />

// 2. Мутация отправляет данные
function handleComplete() {
    completeMutation.mutate(payload, {
        onSuccess: () => {
            queryClient.invalidateQueries(['workouts', 'history'])
            navigate('/workouts/history')
        }
    })
}
```

## Преимущества новой архитектуры

### 1. Тестируемость
- Pure компоненты легко тестировать
- Хуки можно моковать
- API слой изолирован

### 2. Переиспользование
- Компоненты независимы
- Хуки комбинируются
- Легко расширять

### 3. Производительность
- React Query кэширует
- Zustand оптимизирован
- Минимум ререндеров

### 4. Поддержка
- Четкая структура
- Понятная ответственность
- Легко найти код

## Миграция существующего кода

### Шаг 1: Выделить API
Переместить все API вызовы в `api/workouts.api.ts`

### Шаг 2: Создать хуки
Обернуть API вызовы в React Query хуки

### Шаг 3: Создать store
Вынести session state в Zustand

### Шаг 4: Рефактор компонентов
Удалить бизнес-логику из компонентов

### Шаг 5: Обновить страницы
Использовать новые хуки и компоненты

## Best Practices

### ✅ DO

1. **Разделять server и session state**
   ```typescript
   // Server state
   const { data } = useQuery(...)
   
   // Session state
   const { exercises } = useWorkoutSessionStore()
   ```

2. **Держать компоненты чистыми**
   ```typescript
   function Component({ data, onUpdate }) {
       return <button onClick={onUpdate}>{data.value}</button>
   }
   ```

3. **Использовать селекторы Zustand**
   ```typescript
   const exercises = useWorkoutSessionStore(s => s.exercises)
   ```

4. **Инвалидировать кеш после мутаций**
   ```typescript
   onSuccess: () => {
       queryClient.invalidateQueries({ queryKey })
   }
   ```

### ❌ DON'T

1. **Не смешивать API и бизнес-логику**
   ```typescript
   // ❌ Плохо
   const api = {
       async getData() {
           const data = await fetch()
           return processData(data)  // Бизнес-логика в API!
       }
   }
   ```

2. **Не добавлять API вызовы в компоненты**
   ```typescript
   // ❌ Плохо
   function Component() {
       useEffect(() => {
           fetch('/api/data')  // API в компоненте!
       }, [])
   }
   ```

3. **Не хранить server state в Zustand**
   ```typescript
   // ❌ Плохо
   const store = create(() => ({
       workouts: [],  // Это должно быть в React Query!
   }))
   ```

4. **Не дублировать логику**
   ```typescript
   // ❌ Плохо - дублирование
   function HookA() { /* логика X */ }
   function HookB() { /* та же логика X */ }
   
   // ✅ Хорошо
   function useLogicX() { /* логика X */ }
   function HookA() { useLogicX() }
   function HookB() { useLogicX() }
   ```

## Типизация

Все файлы используют TypeScript strict mode:

```typescript
// Явные типы для props
interface ComponentProps {
    value: number
    onUpdate: (value: number) => void
}

// Явные возвращаемые типы
function useCustomHook(): ReturnType {
    return { data, update }
}

// Type guards
function isWorkout(data: unknown): data is Workout {
    return typeof data === 'object' && data !== null && 'id' in data
}
```

## Тестирование

### Компоненты
```typescript
describe('ExerciseCard', () => {
    it('renders exercise name', () => {
        render(<ExerciseCard exercise={mockExercise} />)
        expect(screen.getByText(mockExercise.name)).toBeInTheDocument()
    })
})
```

### Хуки
```typescript
describe('useRestTimer', () => {
    it('counts down correctly', () => {
        const { result } = renderHook(() => useRestTimer({ initialSeconds: 10 }))
        act(() => result.current.start())
        // Assert timer decreases
    })
})
```

### API
```typescript
describe('workoutsApi', () => {
    it('fetches history', async () => {
        const data = await workoutsApi.getHistory()
        expect(data.items).toBeInstanceOf(Array)
    })
})
```

## Будущие улучшения

1. **Error Boundaries**
   - Обработка ошибок на уровне компонентов
   - Fallback UI

2. **Optimistic Updates**
   - Оптимистичные обновления UI
   - Rollback при ошибке

3. **Infinite Scroll**
   - Пагинация истории
   - Virtual scrolling

4. **Offline Support**
   - Service Worker
   - Local cache sync

5. **Performance Monitoring**
   - React Profiler
   - Performance metrics
