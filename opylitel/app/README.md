# ОПЫЛИТЕЛЬ — только синтетический сервис

Реальный приём всегда закрыт. Node24+: `node opylitel/app/server/local.mjs` из корня репозитория; URL `http://127.0.0.1:8787/opylitel/app/`. База вне webroot; `OPY_TEST_DB=/private/demo.sqlite`, `PORT=8787`. Сервер слушает только loopback, не выставлять dev server в интернет.

Проверка: `node --test opylitel/app/tests/*.test.mjs`; с установленным Playwright/Chromium `BROWSER_PATH=/path/to/chromium node opylitel/app/tests/ui-check.mjs`; общая сборка `pnpm build`.

Карта: «Тестовый кабинет» → «Аграрий А» → «Открыть тестовую роль» → «Вставить вымышленный контур» или «Рисовать» → «Сохранить черновик». Второе поле — через «Новое поле». Вершины перетаскиваются, координаты редактируются с клавиатуры. «Отменить изменения» возвращает сохранённое. Для публикации отдельно выбрать аудиторию и поставить галочку. У пчеловода появляются только разрешённые контуры. Аграрий Б и чужой координатор не видят draft. Подложка включается отдельно; без неё всё сохранённое остаётся.

Заявки содержат вымышленный район и системный TEST_CONTACT_ONLY. Телефон/имя вводить нельзя, неизвестные поля отклоняются. Тестовые роли не являются production-регистрацией. Локальный SQLite и размещённый D1 используют общий core, разные адаптеры. Внешняя owner-only защита Site обязательна; реальные данные на зарубежный тестовый хостинг не переносить.

Офлайн snapshot: `node opylitel/app/server/maintenance.mjs backup /private/demo.sqlite /private/backup.sqlite`. Restore при ОСТАНОВЛЕННОМ сервере: `node opylitel/app/server/maintenance.mjs restore /private/demo.sqlite /private/backup.sqlite /private/deletion-ledger.json`. Нужен отдельный долговечный журнал удалений при полной утрате основной БД; это не принятый production-регламент. Hosted D1 restore этим скриптом не проверяется.

Leaflet1.9.4 BSD-2-Clause: assets/vendor/LEAFLET-LICENSE. Из CSS удалены ссылки на неиспользуемые marker images; вершины используют divIcon. Авторская SVG-иллюстрация создана для проекта. OSM optional tiles: https://operations.osmfoundation.org/policies/tiles/ — HTTPS, видимая атрибуция, правильный Referer, браузерный кеш, без prefetch/offline/download. Автотесты перехватывают запросы тайлов. Библиотека бесплатна; тайлы/геокодер не считаются бесплатными без лимитов/условий. Для рабочего режима проверить провайдера/географию/лицензию отдельно.

Производный Worker: `node opylitel/app/server/build-preview.mjs /absolute/preview-checkout` после сохранения Site identity в нём. Каноническая разработка только GitHub /opylitel. Production основной ветки не публикуется этой командой. Паспорт, дефекты и допуск: docs/PASSPORT_EUCP-OPY-001.md.


## Обновление r3
Переносимый российский синтетический выпуск, строгий config, миграции, независимый журнал удалений, проверяемый snapshot/restore и исполняемый stage/activate/rollback: `deploy/ENVIRONMENT.md`. Свежие доказательства и ограничения: `docs/R3_REPORT.md`. Предыдущие сведения о restore в этой памятке заменяются r3 регламентом.
