// Every text "for display" the server of the business interface forms (design
// REQ-011, sections 6 and 10). Plain words only: no technical terms, no codes of
// statuses, roles or errors, no percent sign (criterion 7). Numbers are whole.

export const TEXT = Object.freeze({
  noTasks: "Задач пока нет",
  needsDecision: "нужно ваше решение",
  testExecutor: "тестовый исполнитель",
  dueUnknown: "срок пока не оценить",
  waitsNone: "Ничего не нужно",
  // Temporary until the window of decisions (REQ-017); goes away with the field
  // waits.note_text.
  decisionsLater:
    "Ответить на вопрос можно будет в окне решений — оно появится позже. Сообщение в чате вопрос не закрывает.",
  paused: "Проект приостановлен, продолжите его командой resume",
  tail: "Последняя запись проекта не дописана — она будет убрана при следующем действии",
  planPending: "Плана пока нет — команда его составляет",
  noTasksAtAll: "Задач нет",
  authorUser: "Вы",
  authorTeam: "Команда Sai",
  labelQuestion: "вопрос",
  labelOpen: "ждёт ответа",
  labelTruncated: "сообщение сокращено",
  sent: "Отправлено",
  created: "Проект создан, команда начала работу",

  // Refusals (section 10).
  hostRefused: "Запрос отклонён",
  refused: "Запрос отклонён: действие доступно только со страницы Sai Team",
  staleKey:
    "Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите — текст в поле пропадёт, скопируйте его, если он нужен",
  tooBig: "Сообщение слишком большое",
  badRequest: "Запрос не понят. Обновите страницу",
  notFound: "Не найдено",
  goalEmpty: "Напишите цель одной фразой",
  goalLong: "Цель длиннее 2000 знаков — сократите её",
  budgetBad:
    "Потолок расходов — число больше 0 и не больше 100000, не больше 6 знаков после запятой",
  realRunsOff:
    "Настоящие запуски на этом компьютере выключены — проект не создан. Как включить, написано в инструкции Sai Team",
  goalRefused:
    "Проект не создан: проверьте цель — после скрытия секретов она не проходит проверку",
  createDisk: "Не удалось записать на диск — проект не создан",
  chatEmpty: "Напишите сообщение",
  chatLong: "Сообщение длиннее 4000 знаков — сократите его",
  chatBusy: "Сообщение не отправлено, повторите через несколько секунд",
  chatUnconfirmed:
    "Сообщение не подтверждено, проверьте чат через несколько секунд",
  chatStopping: "Проект останавливается — сообщение не принято",
  chatDropped:
    "Сообщение не выполнено: проект перезапускался. Отправьте его ещё раз",
  chatFull:
    "Проект не успевает принимать сообщения — повторите через несколько секунд",
  chatLinkDown:
    "Связь с работающим проектом недоступна. Перезапустите Sai Team",
  chatDisk: "Не удалось записать на диск — сообщение не сохранено",
  corrupt: "Данные проекта повреждены — проект нельзя показать",
  readFailed: "Не удалось прочитать данные проекта. Повторите позже",
  internal: "Что-то пошло не так. Повторите позже",
});

// Why the engine of a new project did not start (section 10), by the code of
// its refusal; any other code — WHY_OTHER.
export const WHY_NOT_STARTED = Object.freeze({
  E_SCENARIO: "сценарий тестового исполнителя неверен",
  E_CONFIG: "неверная настройка Sai Team",
  E_WORK_DIR: "рабочая папка проекта недоступна",
  E_NO_BUDGET: "у проекта нет потолка расходов",
  E_REAL_RUNS_OFF: "настоящие запуски на этом компьютере выключены",
  E_DISK: "не удалось записать на диск",
});
export const WHY_OTHER = "внутренняя ошибка";

export function progressOf(done, total) {
  return `${done} из ${total} задач`;
}

export function dueIn(minutes) {
  return `примерно через ${minutes} мин`;
}

export function waitsCount(n) {
  return `Вопросов, ждущих ответа: ${n}`;
}

export function createdNotStarted(why) {
  return `Проект создан, но работа не началась: ${why}`;
}
