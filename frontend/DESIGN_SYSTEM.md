# FitTracker Pro - Design System

## Обзор

Дизайн-система FitTracker Pro построена на Tailwind CSS с поддержкой светлой/тёмной темы и интеграцией с Telegram Mini App.

## Содержание

1. [Настройка темы](#настройка-темы)
2. [Компонентные классы](#компонентные-классы)
3. [Анимации](#анимации)
4. [Telegram интеграция](#telegram-интеграция)

---

## Настройка темы

### Переключение темы

```tsx
// Переключение на тёмную тему
document.documentElement.classList.add('dark')

// Переключение на светлую тему
document.documentElement.classList.remove('dark')

// Переключение Telegram темы
document.documentElement.classList.add('telegram-dark')
```

### CSS Variables

Все цвета настраиваются через CSS переменные в `globals.css`:

```css
:root {
  --primary: 217 91% 60%;
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --neutral: 215 16% 47%;
}
```

---

## Компонентные классы

### Кнопки

```tsx
// Основная кнопка
<button className="btn-primary">Нажми меня</button>

// Вторичная кнопка
<button className="btn-secondary">Отмена</button>

// Кнопка успеха
<button className="btn-success">Сохранить</button>

// Кнопка опасности
<button className="btn-danger">Удалить</button>

// Telegram стиль
<button className="btn-telegram">Подтвердить</button>

// Иконка-кнопка
<button className="btn-icon">+</button>

// Прозрачная кнопка
<button className="btn-ghost">Подробнее</button>
```

### Карточки

```tsx
// Карточка тренировки
<div className="card-workout">
  <h3>Тренировка #1</h3>
  <p>Грудь + Трицепс</p>
</div>

// Карточка метрики (с градиентом)
<div className="card-metric">
  <p>Вес</p>
  <p className="text-3xl font-bold">75.5 кг</p>
</div>

// Карточка глюкозы
<div className="card-glucose">
  <p>Норма</p>
  <p>5.4 ммоль/л</p>
</div>

// Статистика
<div className="card-stats">
  <p className="text-2xl font-bold">12</p>
  <p className="text-xs">Тренировок</p>
</div>
```

### Поля ввода

```tsx
// Обычный ввод
<input className="input-field" placeholder="Введите текст..." />

// Числовой ввод
<input type="number" className="input-number" placeholder="0" />

// Поиск
<div className="relative">
  <input className="input-search" placeholder="Поиск..." />
</div>
```

### Бейджи

```tsx
<span className="badge-primary">Новое</span>
<span className="badge-success">Выполнено</span>
<span className="badge-warning">В процессе</span>
<span className="badge-danger">Ошибка</span>
<span className="badge-neutral">Черновик</span>
```

### Список

```tsx
<div className="rounded-xl overflow-hidden">
  <div className="list-item">
    <span>Иконка</span>
    <div className="flex-1">
      <p className="font-medium">Заголовок</p>
      <p className="text-sm text-telegram-hint">Описание</p>
    </div>
    <span className="badge-success">Статус</span>
  </div>
</div>
```

### Таймер

```tsx
<div className="timer-display animate-timer-pulse">
  00:45:30
</div>
<div className="timer-controls">
  <button className="btn-icon">⏮</button>
  <button className="btn-primary">Пауза</button>
  <button className="btn-icon">⏹</button>
</div>
```

### Навигация

```tsx
<nav className="flex justify-around">
  <button className="nav-item-active">
    <span>🏠</span>
    <span className="text-xs">Главная</span>
  </button>
  <button className="nav-item">
    <span>💪</span>
    <span className="text-xs">Тренировки</span>
  </button>
</nav>
```

---

## Анимации

### Готовые анимации

```tsx
// Появление
<div className="animate-fade-in">...</div>

// Слайд вверх
<div className="animate-slide-up">...</div>

// Слайд вниз
<div className="animate-slide-down">...</div>

// Масштабирование
<div className="animate-scale-in">...</div>

// Пульсация
<div className="animate-pulse">...</div>

// Пульсация таймера
<div className="animate-timer-pulse">...</div>

// Тряска
<div className="animate-shake">...</div>

// Вращение
<div className="animate-spin">...</div>

// Подпрыгивание
<div className="animate-bounce">...</div>
```

### Длительность анимации

```tsx
<div className="animate-fade-in duration-150">...</div>
<div className="animate-fade-in duration-300">...</div>
<div className="animate-fade-in duration-500">...</div>
```

---

## Telegram интеграция

### Цветовые переменные Telegram

```tsx
// Фон
<div className="bg-telegram-bg">...</div>

// Вторичный фон
<div className="bg-telegram-secondary-bg">...</div>

// Текст
<p className="text-telegram-text">...</p>

// Подсказка
<p className="text-telegram-hint">...</p>

// Ссылка
<a className="text-telegram-link">...</a>

// Кнопка
<button className="bg-telegram-button text-telegram-button-text">
  Нажми
</button>
```

### Telegram SDK Hook

```tsx
import { useTelegram } from '@/hooks/useTelegram'

function MyComponent() {
  const { 
    sdk, 
    user, 
    hapticFeedback, 
    showMainButton, 
    hideMainButton 
  } = useTelegram()

  // Вибрация
  const handleClick = () => {
    hapticFeedback.light()
  }

  // Показать Main Button
  useEffect(() => {
    showMainButton('Сохранить', () => {
      console.log('Сохранено!')
    })
    return () => hideMainButton()
  }, [])

  return <div>Привет, {user?.firstName}!</div>
}
```

---

## Утилиты

### Safe Area (для мобильных)

```tsx
<div className="safe-area-top">...</div>
<div className="safe-area-bottom">...</div>
<div className="safe-area-x">...</div>
```

### Скрытие скроллбара

```tsx
<div className="no-scrollbar overflow-auto">...</div>
```

### Градиентный текст

```tsx
<h1 className="text-gradient">FitTracker Pro</h1>
```

### Стеклянный эффект

```tsx
<div className="glass">...</div>
```

### Скелетон загрузки

```tsx
<div className="skeleton h-4 w-24 rounded"></div>
```

---

## Тени

```tsx
<div className="shadow-sm">...</div>
<div className="shadow-md">...</div>
<div className="shadow-lg">...</div>
<div className="shadow-xl">...</div>
<div className="shadow-primary">...</div>
<div className="shadow-success">...</div>
<div className="shadow-danger">...</div>
```

---

## Размеры шрифтов

```tsx
<p className="text-xs">Extra Small</p>
<p className="text-sm">Small</p>
<p className="text-base">Base</p>
<p className="text-lg">Large</p>
<p className="text-xl">Extra Large</p>
<p className="text-2xl">2XL</p>
<p className="text-timer">00:00</p>
```

---

## Примеры использования

### Форма тренировки

```tsx
<div className="card-workout space-y-4">
  <h2 className="text-lg font-semibold">Новая тренировка</h2>
  
  <input 
    className="input-field" 
    placeholder="Название тренировки"
  />
  
  <div className="flex gap-3">
    <button className="btn-secondary flex-1">Отмена</button>
    <button className="btn-primary flex-1">Создать</button>
  </div>
</div>
```

### Карточка упражнения

```tsx
<div className="card-exercise animate-slide-up">
  <div className="flex justify-between items-center">
    <div>
      <h3 className="font-medium">Приседания</h3>
      <p className="text-sm text-telegram-hint">4 подхода × 12 повторений</p>
    </div>
    <button className="btn-icon">✓</button>
  </div>
</div>
```

### Навигация

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-telegram-bg safe-area-bottom border-t border-border">
  <div className="flex justify-around py-2">
    <button className="nav-item-active">
      <span className="text-xl">🏠</span>
      <span className="text-xs">Главная</span>
    </button>
    <button className="nav-item">
      <span className="text-xl">💪</span>
      <span className="text-xs">Тренировки</span>
    </button>
    <button className="nav-item">
      <span className="text-xl">📊</span>
      <span className="text-xs">Статистика</span>
    </button>
    <button className="nav-item">
      <span className="text-xl">👤</span>
      <span className="text-xs">Профиль</span>
    </button>
  </div>
</nav>
```

---

## Демо

Для просмотра всех компонентов:

```tsx
import { DesignSystemDemo } from '@/components/ui/DesignSystemDemo'

function App() {
  return <DesignSystemDemo />
}
```
