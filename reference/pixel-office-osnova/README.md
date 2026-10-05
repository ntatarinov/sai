# Pixel Office из osnova — эталон

Копия, сделанная 2026-09-25, чтобы Pixel Office не потерялся. **Это не рабочий код
этого проекта**: он ничем не собирается и не запускается отсюда. Переносится в проект
через REQ-001 с поднятой планкой.

| Файл здесь | Откуда в osnova |
|---|---|
| `wwwroot/agent-office.{html,css,js}`, `wwwroot/format.js` | `backend/src/Osnova.Api/wwwroot/` |
| `domain/AgentOffice.cs` | `backend/src/Osnova.Domain/AgentOffice.cs` — модель: требование, задача, событие, решение |
| `domain/AgentOfficeSeed.cs` | `backend/src/Osnova.Data/AgentOfficeSeed.cs` — **ручной журнал с искусственным временем; как источник истины не переносится** (AP-002) |
| `api/agent-office-endpoints.cs` | выдержка из `backend/src/Osnova.Api/Program.cs`, строки 745–1021 и 1037–1043 |
| `tests/layout.js`, `tests/behaviour.js` | `backend/tests/office-checks/` — проверки достижимости и поведения |
| `docs/REQ-OSN-003-agent-office.md`, `docs/REQ-OSN-004-…` | `docs/requirements/` — исходные требования и критерии |

Права в osnova: `agent-office.view` и `agent-office.write` (`Osnova.Domain/Platform.cs`).

Что взять как есть: одна модель событий, путь по сетке проходимости, страница только
читает, узкое право на запись, помеченный режим симуляции.

Что изменить: источник событий — хуки Claude Code, время — реальное (REQ-001).
