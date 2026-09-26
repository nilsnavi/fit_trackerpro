# Каталог упражнений из exercises-dataset

FitTracker Pro импортирует метаданные и русские инструкции из публичного репозитория
[`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset).
Импорт выполняется детерминированным скриптом, а не во время запуска API.

## Зафиксированный источник

- Файл: `data/exercises.json` (проверка также требует `instruction_steps.ru`)
- Зафиксированный commit: `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- Запись источника: `hasaneyldrm/exercises-dataset`
- Исходных упражнений: **1 324**
- Итоговых строк каталога: **1 354** (1 324 импортированных + 30 сохранённых legacy-строк)
- Текущая политика медиа: **metadata-only (Phase A)**, `media_url` равен `null`

Английское имя никогда не используется как заголовок каталога. Для каждого
импортированного упражнения генератор сначала проверяет
`backend/reference_data/exercises_dataset_name_ru.json`, затем применяет
детерминированный шаблонный генератор. Английское имя хранится в
`metadata.source_name_en` и `metadata.aliases` для поиска. Отчёт импорта
фиксирует `names_ru_failed: 0` и проверяет наличие кириллицы в каждой строке.

## Mapping

- `slug`: `exds-{четыре цифры id}-{ascii-slug имени}`; длина ограничена 180 символами.
- `body_part=cardio` становится `cardio`; остальные части тела по умолчанию
  становятся `strength`. Явные stretch/mobility/yoga-движения получают
  `flexibility`, balance/stability-дриллы — `balance`; rehab ставится только
  при явном слове rehabilitation/therapy/rehab.
- Оборудование нормализуется в коды `ref_equipment.json`. В набор добавлены
  `machine` и `stability_ball`; исходная строка всегда остаётся в metadata.
- `target`, `muscle_group` и `secondary_muscles` мапятся в коды
  `ref_muscle_group.json`; порядок — primary target, synergist, secondary.
  Неизвестные исходные значения считаются в import report и сохраняются в metadata.
- `instruction_steps.ru` соединяются через перенос строки в `description` и
  ограничиваются 2 000 символами безопасным многоточием. Полный массив шагов
  сохраняется в `metadata.instruction_steps_ru`.
- Все risk flags для импортированных строк по умолчанию `false`.

## Перегенерация

Скрипт не требует Python-пакетов и не обращается к базе данных. Клонируйте
репозиторий на зафиксированный commit и запустите:

```bash
git clone https://github.com/hasaneyldrm/exercises-dataset.git /tmp/exercises-dataset
cd /tmp/exercises-dataset
git checkout 7455efae41b330c265e7cd4b78dfa848e7ce5ebd
cd /path/to/fit_trackerpro
python backend/scripts/import_exercises_dataset.py --input /tmp/exercises-dataset
```

Команда обновляет:

- `backend/reference_data/exercises.ndjson`
- `backend/reference_data/exercises_dataset_import_report.json`

Импорт проверяет количество 1 324, русские инструкции, допустимые категории,
кириллические имена и отсутствие slug collision. Для fixture-импорта в тестах
можно использовать `--allow-count`; в каталог такой результат записывать нельзя.

После генерации примените reference data к базе идемпотентным upsert-путём:

```bash
cd backend
python -m app.cli.seed_reference_data apply --data-dir reference_data
```

Существующие legacy-slug не удаляются и не архивируются. Автоматическая archive
политика применяется только к отсутствующим `exds-*` строкам; это сохраняет
внешние ключи истории и шаблонов.

## Медиа и права

По умолчанию GIF и JPG не копируются и не добавляются в Git. В NDJSON остаются
пути, `media_id` и обязательная атрибуция для будущего использования. Текст и
структура данных распространяются по MIT, но медиа из `images/` и `videos/` не
покрыто MIT: это материалы © Gym visual с отдельными условиями. Полный notice
находится в [`docs/legal/exercises-dataset-notice.md`](legal/exercises-dataset-notice.md).

Локальное медиа — отдельный, осознанный режим для разработки. Он копирует
только исходные GIF из клона в игнорируемый `frontend/public/exercise-media/`
(размер исходного ассета должен оставаться 180×180) и записывает локальный
`media_url`:

```bash
EXERCISES_MEDIA_MODE=local \
python backend/scripts/import_exercises_dataset.py \
  --input /tmp/exercises-dataset \
  --media-output frontend/public/exercise-media
```

Перед распространением такого билда нужно проверить права Gym visual и оставить
видимую в каталоге атрибуцию `© Gym visual — https://gymvisual.com/`. Более
высокое разрешение и массовые медиа-файлы в этот репозиторий не добавляются.
