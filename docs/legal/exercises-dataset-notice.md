# Exercises dataset — license and media notice

Источник импортированных данных:
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset),
commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`.

## Текст и структура данных

MIT License (из upstream `LICENSE`):

> Copyright (c) 2026 Hasan Emir Yıldırım
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation and data files (the "Software"),
> to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
> sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

В FitTracker импортируются текст, инструкции и структурированные поля dataset.
В source NDJSON сохраняются `source_dataset` и `source_commit`, чтобы связь с
источником не терялась при регенерации.

## Медиа-исключение

Upstream отдельно предупреждает:

> The MIT license above covers ONLY the code, tooling, dataset structure, and
> instruction text/translations in this repository.
>
> It DOES NOT cover the exercise media in the `images/` and `videos/`
> directories. That media is © Gym visual (https://gymvisual.com/) and is
> included here with the rights holder's written permission, at 180×180
> resolution, and must retain the attribution "© Gym visual —
> https://gymvisual.com/".

FitTracker по умолчанию **не включает media binaries**: `media_url` остаётся
`null`, в Git нет тысяч JPG/GIF. Пути и attribution хранятся только для
metadata-first регенерации. Если явно включён `EXERCISES_MEDIA_MODE=local`,
разрешены только исходные 180×180 GIF, а UI обязан показывать:

**© Gym visual — https://gymvisual.com/**

Отдельные условия Gym visual находятся по адресу:
<https://gymvisual.com/content/3-terms-and-conditions-of-use>. Клонирование
upstream-репозитория не предоставляет FitTracker коммерческую лицензию на
медиа. Не скачивайте и не распространяйте ассеты большего разрешения без
отдельного разрешения правообладателя.
