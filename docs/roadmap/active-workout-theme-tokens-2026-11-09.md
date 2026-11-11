# Задача UI-1 — Привести active-workout флоу к дизайн-токенам (light/dark)

**Дата:** 2026-11-09
**Приоритет:** P1 · **Оценка:** M (3–5 дней) · **Тип:** frontend/UI
**Статус:** ✅ выполнено (2026-11-09)
**Зависимости:** нет
**Источник:** аудит UI 2026-11-09 (экраны перегружены / две дизайн-системы)

---

## Результат (2026-11-09)

Мигрировано на дизайн-токены (убраны хардкод-hex, `bg-black`, `bg-white/*`, `border-white/*`):

- `features/workouts/active/components/ActiveWorkoutScreen.tsx`
- `features/workouts/active/components/PreviousResultCard.tsx`
- `features/workouts/active/components/ProgressionPrefillNotice.tsx`
- `features/workouts/active/components/ProgressionRecommendationCard.tsx`
- `features/workouts/active/modals/AddExerciseModal.tsx`
- `features/workouts/pages/WorkoutSummaryPage.tsx`
- `features/workouts/pages/ProgressionTargetsPage.tsx`
- `features/workouts/pages/WorkoutsPage.tsx` (divide-white → divide-border)

Маппинг: `#090D12`/`#0B1118`/`bg-black` → `bg-telegram-bg`; `#101720`/`#151C26`/`#0B1626`/`#111821` → `bg-telegram-secondary-bg`; `#F8FAFC` → `text-telegram-text`; `#8A94A6`/`#64748B` → `text-telegram-hint`; `#22C55E`/`#4ADE80`/`#DCFCE7` → `success`; `#2563EB`/`#60A5FA`/`#93C5FD`/`#DBEAFE`/`#38BDF8`/`#7DD3FC` → `primary`; `#FACC15`/`#FEF3C7` → `warning`; `#EF4444`/`#FCA5A5` → `danger`; `border-white/*` → `border-border`; `bg-white/*` → `bg-muted`; `bg-black/20|25|35` → `bg-telegram-bg/60|70`.

Оставлены намеренно: `text-white`/`bg-white/20` на цветных/gradient-фонах (primary, success, gradient-hero, modal-scrim `bg-black/50`), слегка изменены только surfaces/бордеры.

Проверено: `npm run typecheck` ✅, `npm run lint` (max-warnings 0) ✅, `npm run test:ci` — **96 suites / 640 tests passed**; остаточный grep по hex/`bg-black`/`workouts` — только допустимые scrim/colored-bg.

---

## Проблема (исходно)

В приложении сосуществуют две дизайн-системы. Экраны главной, аналитики, здоровья,
профиля и коуча уже переведены на токены (`bg-telegram-bg`, `bg-telegram-secondary-bg`,
`text-telegram-text`, `text-telegram-hint`, `bg-primary`, `border-border`) и следуют
светлой/тёмной теме Telegram.

**Флоу активной тренировки и его пост-экраны — нет.** Они используют собственную
тёмную палитру с хардкод-hex (`bg-[#090D12]`, `text-[#F8FAFC]`, `text-[#8A94A6]`,
`bg-[#101720]`, `bg-[#22C55E]`, `border-white/[0.08]` и т. д.). Итог: в светлой теме
Telegram переход в тренировку резко уводит всё в тёмное, визуально это другой продукт.

Это завершающий шаг унификации, начатой в правках 2026-11-09 (Home, WorkoutsPage,
HomeHealthSection, EmergencyButton, home/StartWorkoutSheet, home/TemplateCard).

## Затронутые файлы

Основной флоу:
- `frontend/src/features/workouts/active/components/ActiveWorkoutScreen.tsx` (ядро, ~1200 строк)
- `frontend/src/features/workouts/active/modals/AddExerciseModal.tsx`
- `frontend/src/features/workouts/active/modals/*` (проверить остальные модалки: FinishWorkoutModal, ExerciseStructureEditorModal, AddTimerModal, AbandonWorkoutConfirmModal)
- `frontend/src/features/workouts/active/components/*` (ActiveWorkoutSummarySection, ActiveExerciseList, ActiveExerciseNavigator, ProgressionRecommendationCard, ProgressionPrefillNotice, PreviousResultCard)
- `frontend/src/features/workouts/active/containers/*` (ActiveWorkoutBottomActions, WorkoutActionsContainer, ActiveWorkoutExerciseSection, ActiveWorkoutSummarySection)

Пост-экраны / связанные:
- `frontend/src/features/workouts/pages/WorkoutSummaryPage.tsx`
- `frontend/src/features/workouts/pages/ProgressionTargetsPage.tsx`
- `frontend/src/features/workouts/workoutMode/*` (WorkoutModePageView, WorkoutModeExerciseCard, WorkoutModeStickyFooter, ExerciseModeConfigForm, AddExerciseSheet)

## Что сделать

1. Инвентаризация: `grep -rn "#[0-9a-fA-F]\{6\}" frontend/src/features/workouts` + поиск `bg-black`, `bg-white/`, `text-white`, `border-white/`, `ring-white/`.
2. Заменить по отображению:
   - `#090D12` / `#0B1118` / `bg-black` → `bg-telegram-bg` (или `bg-background`)
   - `#101720` / `#151C26` / `#0B1626` → `bg-telegram-secondary-bg` (или `bg-card`)
   - `#F8FAFC` / `text-white` → `text-telegram-text`
   - `#8A94A6` / `#64748B` → `text-telegram-hint`
   - `#22C55E` / `#16A34A` / `#4ADE80` → `success`
   - `#2563EB` / `#1D4ED8` / `#60A5FA` / `#93C5FD` / `#38BDF8` / `#7DD3FC` → `primary`
   - `#FACC15` / `#FEF3C7` → `warning`
   - `#EF4444` / `#FCA5A5` → `danger`
   - `border-white/[0.08]` → `border-border`; `bg-white/[0.06]` → `bg-telegram-secondary-bg`
3. Сохранить крупную типографику/плотность (это фокусный режим тренировки) — меняются только цвета/границы/фоны, не структура и не размеры тапов ≤ 44px.
4. Сохранить все `data-testid` и логику (idempotency, offline-очередь, rest-timer).

## Готово, когда

- В перечисленных файлах нет хардкод-hex и `bg-black`/`text-white` (проверяется grep).
- Экран активной тренировки, модалка добавления упражнения и `WorkoutSummaryPage` читаемы и консистентны в **светлой и тёмной** темах.
- Юнит-тесты зелёные; при необходимости обновлены.

## Проверка

```bash
cd frontend
npm run typecheck && npm run lint
npm run test:ci
# остаточный хардкод (должно быть пусто по целевым файлам):
grep -rn "#[0-9a-fA-F]\{6\}\|bg-black\|text-white" src/features/workouts/active src/features/workouts/pages/WorkoutSummaryPage.tsx src/features/workouts/pages/ProgressionTargetsPage.tsx
```

Ручная приёмка: старт → подходы → отдых → завершение; добавить упражнение; сводка тренировки; цели прогрессии — в light и dark.

## Риски

- `ActiveWorkoutScreen.tsx` большой и в критичном флоу — правки должны быть механическими (цвет→токен), не рефакторингом структуры.
- Некоторые акценты (`#22C55E` подтверждение подхода, `#FACC15` warm-up) несут смысл — при замене на `success`/`warning` сохранить контраст.

## Машинно-читаемый пакет

`docs/roadmap/remediation-issues-2026-11-09.json` (готов для заведения в трекер).
