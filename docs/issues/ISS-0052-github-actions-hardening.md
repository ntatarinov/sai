# ISS-0052 — Нет dependabot.yml, в настройках Actions разрешены все действия и не требуется закрепление по SHA

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGNER (прогон REQ030-20261012-01, `-r1`, V2), 2026-10-12; SECURITY-REVIEWER (F1, F4), 2026-10-12. Пункты планки: Q7, Q10. Требования: REQ-030.

## Что не так

1. В репозитории нет `.github/dependabot.yml`: закреплённые по полному SHA действия (`actions/checkout` v7.0.1, `actions/setup-node` v7.0.0) никто не обновляет, устаревший SHA заметят только вручную.
2. Настройки Actions репозитория (прочитаны только на чтение): `allowed_actions: all` (разрешены любые действия), `sha_pinning_required: false` (закрепление по SHA не принуждается — будущая правка workflow может его ослабить), `approval_policy: first_time_contributors` (после первого принятого вклада чужой автор запускает проверки без одобрения). Репозиторий публичный, workflow запускается от `pull_request`: чужой PR выполняет `npm ci` и `npm run check` от своего кода на раннере GitHub; ущерб ограничен расходом вычислений (секретов и переменных в репозитории нет, токен `contents: read` в шаги `run` не передаётся, кэша нет, таймаут 15 минут).

## Доказательство

`handoffs/REQ030-20261012-01/step-01-code-designer-r1.json` (V2), `step-01b-code-design-validator-r2.json` и `-r3.json` (чтение настроек), `step-03-security-reviewer.json` (F1, F4).

## Как исправить

Владельцу (слово владельца, R1): в настройках Actions выбрать «Require approval for all external contributors» (`approval_policy: all_external_contributors`); по желанию — ограничить `allowed_actions` и включить `sha_pinning_required`. Настройки Sai не меняет. Для п. 1 — отдельное требование: `dependabot.yml` для экосистемы `github-actions` (WF-01). Не добавлять в репозиторий секреты и не переходить на `pull_request_target`.

## Маршрут

Вопрос владельцу через ORCH (настройки); WF-01 для `dependabot.yml`.

## Сделано 2026-10-13

Запись 2026-10-13T08:14:16Z (время с часов), прогон `REQ030-20261012-01` (WF-02, шаг 13). Владелец поручил ORCH решить остальные пункты (`decisions/0048`, слова владельца дословно в решении). ORCH сделал и проверил чтением настроек:

- настройка Actions «одобрение внешних вкладчиков»: `approval_policy` = `all_external_contributors` (было `first_time_contributors`) — закрыта часть п. 2: чужой pull request больше не запускает проверки без одобрения;
- защита ветки `main` включена: обязательная проверка `check`, force-push и удаление ветки запрещены, `enforce_admins` = false (администратор может отправлять напрямую, R1 не меняется), обязательных pull request нет.

**Остаётся открытым:** (1) нет `.github/dependabot.yml` для `github-actions` (п. 1; отдельное требование, WF-01); (2) `sha_pinning_required` = false (закрепление по SHA не принуждается); (3) `allowed_actions` = all (разрешены любые действия). Эти настройки в границах 0048 не менялись: границы разрешают только обратимые изменения защиты `main` и одобрения вкладчиков. Статус дефекта остаётся **open**.
