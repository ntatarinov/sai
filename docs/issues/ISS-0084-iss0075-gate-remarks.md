# ISS-0084 — Замечания ворот прогона ISS-0075 (Low): три оставшихся обхода без защиты от исчезнувшего имени, пробелы в FR-3, комментарии, версия git в check.yml

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (`handoffs/ISS-0075-20261021-01/step-03-test-design-validator.json`, F1–F3) и RELEASE-VALIDATOR (`step-05-release-validator.json`, F1–F4, подтвердил F1–F3 своими пробами), заведено DOC-UPDATER (шаг 10), 2026-10-21. Пункты планки: Q5, Q6 (проверка не должна оставлять выживающих мутантов), Q13. Требований нет; поведение продукта не затронуто. Блокирующих находок ворота не нашли — прогон закрыт, это остаток.

## Что не так

1. **Три обхода всей папки проекта без защиты от исчезнувшего имени** (поиск приманки секрета, `readdirSync` + `lstatSync`): `tools/test/team-channel.test.js` около 965, `tools/test/team-web-channel.test.js` около 111, `tools/test/team-web-control.test.js` около 978. Живого писателя в момент обхода сейчас нет (отправитель завершён, сообщение принято и подтверждение снято, движков нет), красных не наблюдалось; но в `team-web-channel.test.js` движок жив, и если он когда-либо переименует файл в этот момент, будет тот же `ENOENT`, что был у EN-62. Это остаточный риск класса AP-014. Исправление: при случае перевести на `listFilesLive` (или её вариант, читающий содержимое).
2. **FR-3 не закрепляет `EPERM`.** Мутанты «`EPERM` у `lstat` глотается» и «`EPERM` у `readdir` глотается» выживают (красных 0 из 37; ворота 3 — N1, N2; подтверждено ворота 9). FR-3 проверяет пробрасывание на EACCES, EIO, ENOTDIR. Исправление: добавить `EPERM` (или цикл по EACCES, EPERM, EIO, EMFILE, ENOTDIR).
3. **Сортировка `listFilesLive` не закреплена.** Мутант «без `.sort()`» выживает, потому что на этой файловой системе `readdir` уже отдаёт отсортированный список (ворота 3 — N5). На файловой системе с другим порядком проверка «отсортировано на каждом уровне» была бы случайной. Исправление: в FR-3 подменить `readdirSync` так, чтобы имена шли в обратном порядке, и сверить отсортированный итог.
4. **Комментарии и шапка** (`tools/test/team-helpers.js` строки 40–47; `fixtures/traces/helpers.js`; `flaky-regression.test.js`): комментарий к `assertSafeHome` («Throws unless `home` is an absolute path…») стоит над комментарием и функцией `listFilesLive`, а сама `assertSafeHome` осталась без комментария; ссылка «(design ISS-0075)» ведёт на несуществующий документ (проекта `docs/design/ISS-0075*` нет; нужна ссылка на диагноз `handoffs/ISS-0075-20261021-01/step-01-issue-fixer.json` или `docs/issues/ISS-0075-*.md`); в шапке `flaky-regression.test.js` сказано «FR-1 … FR-6», а FR-6 нет (есть FR-1, FR-2, FR-3, FR-3b, FR-4, FR-5). Поведения не меняет.
5. **Версия git в `.github/workflows/check.yml` не закреплена** — раннер берёт git из образа `ubuntu-24.04`, и версия может смениться (именно смена до 2.55 дала HC-6a). Если нужно, закрепить версию или проверять её в первом шаге; решение — нужна ли такая строгость, принимает ORCH (запись `decisions/`, Q12). Изоляция `sandbox()` от фоновой уборки git этот риск закрывает для HC-6a, но не для других изменений поведения git.

## Доказательство

`handoffs/ISS-0075-20261021-01/step-03-test-design-validator.json` (F1–F3, мутанты N1, N2, N5), `step-05-release-validator.json` (F1–F5; собственные пробы выживших мутантов F2, F3). Проверить п. 1: `grep -n "lstatSync" tools/test/team-channel.test.js tools/test/team-web-channel.test.js tools/test/team-web-control.test.js`; п. 4: `sed -n 36,80p tools/test/team-helpers.js` и `grep -n "FR-6" tools/test/flaky-regression.test.js`; п. 5: `grep -n "git" .github/workflows/check.yml`.

## Как исправить

Малый прогон WF-03 (только `tools/test/` и, если решено, `check.yml`): TEST-DESIGNER правит пп. 1–4 и мутантами проверяет пп. 2–3 (мутант должен краснеть); п. 5 — решение ORCH. Проверки не ослаблять (Q6).

## Маршрут

TEST-DESIGNER → TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.
