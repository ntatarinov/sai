using Microsoft.EntityFrameworkCore;
using Osnova.Domain;

namespace Osnova.Data;

/// <summary>
/// История работы агентной системы над Osnova.
///
/// <b>Это не выдуманные данные.</b> Здесь записана фактическая работа: какие
/// требования ставил владелец (дословно), каких специалистов привлекал оркестратор,
/// что они выяснили, какие решения были приняты и что в итоге заработало. Каждое
/// событие соответствует тому, что действительно произошло в ходе разработки —
/// включая найденные дефекты и расхождения документации ASCOA с её же кодом.
///
/// Новые события дописываются рантаймом агентов через <c>POST /api/agent-office/events</c>
/// (право <c>agent-office.write</c>); страница Agent Office их только отображает и
/// пишущим правом не обладает.
/// </summary>
public static class AgentOfficeSeed
{
    public static async Task EnsureSeededAsync(OsnovaDbContext db)
    {
        if (await db.Requirements.AnyAsync()) return;

        // Якорь истории. Самое раннее событие идёт со смещением −240 минут, поэтому
        // 08:00 UTC ставит начало работы на 09:00 по Алматы (UTC+5), а последнее
        // событие — на 15:31: вся история укладывается в один рабочий день.
        //
        // Смещение проставлено явно, а не вычислено через TimeZoneInfo: серверная база
        // часовых поясов на Windows устарела и дала бы для Алматы +6 (см. OrgCalendar).
        // Для фиксированных демонстрационных данных явная константа честнее вычисления
        // по сломанным данным.
        var t0 = new DateTimeOffset(2026, 9, 20, 8, 0, 0, TimeSpan.Zero);
        long seq = 0;

        AgentEvent Ev(Requirement req, int minute, AgentEventKind kind, AgentRole actor,
            string topic, string? detail = null, AgentRole? target = null,
            string? participants = null, Guid? taskId = null) => new()
            {
                Id = ++seq,
                RequirementId = req.Id,
                TaskId = taskId,
                At = t0.AddMinutes(minute),
                Kind = kind,
                ActorRole = actor,
                TargetRole = target,
                Participants = participants,
                Topic = topic,
                Detail = detail
            };

        // ================================================================ REQ-OSN-001
        var r1 = new Requirement
        {
            Code = "REQ-OSN-001",
            Title = "Складской цикл ТМЦ",
            OriginalRequest =
                "Продолжи свою работу и результат дай чтобы посмотреть локально на вебе твою работу",
            FormalizedStatement =
                "Замкнуть складской цикл товарно-материальных ценностей: к существующему " +
                "поступлению добавить списание с контролем достаточности остатка, перемещение " +
                "между группами учёта с переносом стоимости и инвентаризацию с типизированными " +
                "расхождениями. Каждая операция — документ со своим проведением и сторно.",
            Status = RequirementStatus.Done,
            CreatedAt = t0.AddMinutes(-240),
            CompletedAt = t0.AddMinutes(-40),
            Result =
                "Кладовщик списывает ТМЦ с проверкой остатка именно по своему МОЛ, месту и партии; " +
                "перемещает позиции между местами и ответственными, и стоимость переезжает вместе " +
                "с товаром; формирует инвентаризационную ведомость снимком остатков, вносит факт " +
                "и видит недостачу или излишек явным статусом. Всё сторнируется компенсирующей записью.",
            Remaining = "Позиция «не в учёте» в ведомости пока не добавляется из интерфейса."
        };
        db.Requirements.Add(r1);

        var r1t1 = new AgentTask { RequirementId = r1.Id, Code = "TASK-1", AgentRole = AgentRole.BusinessAnalyst, Title = "Определить состав складского цикла", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(-235), CompletedAt = t0.AddMinutes(-215), Result = "Цикл неполон: есть приход, нет расхода, перемещения и инвентаризации. Приоритет — расход, без него остаток только растёт." };
        var r1t2 = new AgentTask { RequirementId = r1.Id, Code = "TASK-2", AgentRole = AgentRole.Architect, Title = "Модель расхода и перемещения", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(-214), CompletedAt = t0.AddMinutes(-190), Result = "Расход не меняет средневзвешенную цену; перемещение — расход плюс приход в одной транзакции, цена переносится." };
        var r1t3 = new AgentTask { RequirementId = r1.Id, Code = "TASK-3", AgentRole = AgentRole.BackendDev, Title = "Проведение трёх типов документов", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(-189), CompletedAt = t0.AddMinutes(-120), Result = "Реализованы списание, перемещение и инвентаризация; сторно обобщено на все складские документы." };
        var r1t4 = new AgentTask { RequirementId = r1.Id, Code = "TASK-4", AgentRole = AgentRole.TestEngineer, Title = "Тесты складских правил", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(-119), CompletedAt = t0.AddMinutes(-70), Result = "Девять тестов: достаточность остатка, неизменность себестоимости при расходе, перенос стоимости, расхождения." };
        db.AgentTasks.AddRange(r1t1, r1t2, r1t3, r1t4);

        db.AgentEvents.AddRange(
            Ev(r1, -240, AgentEventKind.RequirementCreated, AgentRole.Orchestrator, "REQ-OSN-001 принято в работу", "Запрос владельца: продолжить работу и дать проверяемый результат в вебе."),
            Ev(r1, -236, AgentEventKind.TaskAssigned, AgentRole.Orchestrator, "TASK-1 аналитику", "Определить, чего не хватает складскому циклу.", target: AgentRole.BusinessAnalyst, taskId: r1t1.Id),
            Ev(r1, -234, AgentEventKind.Research, AgentRole.BusinessAnalyst, "Изучаю цикл ТМЦ", "Приход есть, расхода нет — остаток может только расти. Это первый разрыв.", taskId: r1t1.Id),
            Ev(r1, -220, AgentEventKind.Question, AgentRole.BusinessAnalyst, "Как считать себестоимость при расходе?", "Меняет ли расход средневзвешенную цену остатка?", target: AgentRole.Accountant, taskId: r1t1.Id),
            Ev(r1, -216, AgentEventKind.Answer, AgentRole.Accountant, "Расход не меняет среднюю цену", "Товар уходит по сложившейся себестоимости. Пересчёт идёт только при поступлении.", target: AgentRole.BusinessAnalyst, taskId: r1t1.Id),
            Ev(r1, -214, AgentEventKind.TaskCompleted, AgentRole.BusinessAnalyst, "TASK-1 завершена", r1t1.Result, taskId: r1t1.Id),
            Ev(r1, -212, AgentEventKind.Decision, AgentRole.Architect, "Перемещение — одна операция из двух проводок", "Расход у отправителя и приход у получателя в одной транзакции, стоимость переносится.", taskId: r1t2.Id),
            Ev(r1, -150, AgentEventKind.Implementation, AgentRole.BackendDev, "Проведение списания и перемещения", "Добавлена проверка достаточности остатка по пяти признакам ключа учёта.", taskId: r1t3.Id),
            Ev(r1, -100, AgentEventKind.TestRun, AgentRole.TestEngineer, "Прогон тестов", "24 теста зелёные.", taskId: r1t4.Id),
            Ev(r1, -95, AgentEventKind.DefectFound, AgentRole.TestEngineer, "Незаполненную ведомость можно утвердить", "После утверждения править нельзя, а провести невозможно — документ попадает в тупик.", taskId: r1t4.Id),
            Ev(r1, -90, AgentEventKind.Question, AgentRole.TestEngineer, "Где должна стоять проверка полноты?", "Проверка стоит при проведении, а нужна раньше.", target: AgentRole.BackendDev, taskId: r1t4.Id),
            Ev(r1, -85, AgentEventKind.Implementation, AgentRole.BackendDev, "Проверка перенесена на утверждение", "Ведомость нельзя утвердить, пока не пересчитаны все позиции.", taskId: r1t3.Id),
            Ev(r1, -70, AgentEventKind.TestRun, AgentRole.TestEngineer, "Повторный прогон", "25 тестов зелёные, добавлены два на найденный дефект.", taskId: r1t4.Id),
            Ev(r1, -45, AgentEventKind.Review, AgentRole.ReleaseValidator, "Сквозная проверка на живой системе", "Приход → списание → перемещение → инвентаризация → сторно прогнаны по HTTP на чистой базе."),
            Ev(r1, -40, AgentEventKind.RequirementCompleted, AgentRole.Orchestrator, "REQ-OSN-001 DONE", r1.Result));

        db.DecisionRecords.Add(new DecisionRecord
        {
            RequirementId = r1.Id, At = t0.AddMinutes(-212),
            Question = "Как оформлять сторно складской операции?",
            Options = "A — копировать предыдущую строку регистра с новой датой (как в ASCOA); B — добавлять компенсирующую запись",
            Decision = "B — компенсирующая запись",
            Reason = "В ASCOA сторно копирует прежнюю строку, из-за чего история растёт при каждой отмене. Компенсирующая запись даёт тот же результат остатка, но история линейна и объяснима.",
            Impact = "Регистр остаётся только пополняемым; отмена не искажает себестоимость остатка.",
            Agents = "Architect, Accountant"
        });

        // ================================================================ REQ-OSN-002
        var r2 = new Requirement
        {
            Code = "REQ-OSN-002",
            Title = "Выбытие основных средств",
            OriginalRequest =
                "Необходимо спроектировать и постепенно реализовать новую версию системы учёта " +
                "имущества компании… Если я говорю «сделать поступление ТМЦ», это не означает, " +
                "что нужно просто добавить кнопку «Оприходовать» и CRUD-документ. Ты должен " +
                "самостоятельно восстановить полный бизнес-контекст.",
            FormalizedStatement =
                "Замкнуть жизненный цикл основного средства: приём и перемещение есть, выбытия нет. " +
                "Спроектировать выбытие как полноценный процесс — основание, комиссия, акт, " +
                "фиксация остаточной стоимости, снятие материальной ответственности — и развести " +
                "бухгалтерское выбытие с фактической утилизацией.",
            Status = RequirementStatus.Done,
            CreatedAt = t0,
            CompletedAt = t0.AddMinutes(95),
            Result =
                "Бухгалтер составляет акт о списании с комиссией и заключением; без председателя, " +
                "без двух членов или без обоснования акт не утверждается. При проведении " +
                "фиксируется остаточная стоимость на дату выбытия, снимается материальная " +
                "ответственность и пишется запись регистра. Объект остаётся на своём месте до " +
                "подтверждения утилизации; после подтверждения сторно списания запрещается.",
            Remaining =
                "Оприходование узлов и лома от разборки на склад — отдельный документ, " +
                "не реализован. Начисление амортизации отсутствует как подсистема."
        };
        db.Requirements.Add(r2);

        var r2t1 = new AgentTask { RequirementId = r2.Id, Code = "TASK-1", AgentRole = AgentRole.DomainResearcher, Title = "Исследовать выбытие ОС в ASCOA", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(3), CompletedAt = t0.AddMinutes(28), Result = "Комиссии при списании ОС в ASCOA нет вовсе — она привязана только к инвентаризации. Амортизация при выбытии не реализуется: код переносит значения без изменений. Документация утверждает обратное — расхождение с кодом." };
        var r2t2 = new AgentTask { RequirementId = r2.Id, Code = "TASK-2", AgentRole = AgentRole.Accountant, Title = "Корректная модель выбытия по практике учёта", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(3), CompletedAt = t0.AddMinutes(26), Result = "Выбытие — семья процессов, а не один признак. Пять независимых измерений состояния. Физическая утилизация отстаёт от бухгалтерского выбытия и это нельзя терять." };
        var r2t3 = new AgentTask { RequirementId = r2.Id, Code = "TASK-3", AgentRole = AgentRole.Architect, Title = "Модель акта о списании", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(30), CompletedAt = t0.AddMinutes(45), Result = "Комиссия — общая сущность документа. Стоимостные показатели фиксируются снимком на позиции акта. Реализация и безвозмездная передача исключены из оснований." };
        var r2t4 = new AgentTask { RequirementId = r2.Id, Code = "TASK-4", AgentRole = AgentRole.BackendDev, Title = "Проведение и сторно акта", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(46), CompletedAt = t0.AddMinutes(72), Result = "Реализованы проверки комиссии, компонентов, уволенного МОЛ; сторно блокируется после утилизации." };
        var r2t5 = new AgentTask { RequirementId = r2.Id, Code = "TASK-5", AgentRole = AgentRole.TestEngineer, Title = "Тесты правил выбытия", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(73), CompletedAt = t0.AddMinutes(88), Result = "Двенадцать тестов. Один падал из-за ошибки в самом тесте — исправлен, правило подтверждено." };
        var r2t6 = new AgentTask { RequirementId = r2.Id, Code = "TASK-6", AgentRole = AgentRole.FrontendDev, Title = "Интерфейс акта и утилизации", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(80), CompletedAt = t0.AddMinutes(92), Result = "Форма составления акта с выбором комиссии и блок подтверждения утилизации в карточке ОС." };
        db.AgentTasks.AddRange(r2t1, r2t2, r2t3, r2t4, r2t5, r2t6);

        db.AgentEvents.AddRange(
            Ev(r2, 0, AgentEventKind.RequirementCreated, AgentRole.Orchestrator, "REQ-OSN-002 принято в работу", "Владелец задал направление словами «выбытие», требуя раскрыть его до полного бизнес-контекста."),
            Ev(r2, 1, AgentEventKind.Research, AgentRole.Orchestrator, "Смотрю, где разорван цикл", "Приём и перемещение ОС есть, выбытия нет — это ближайший разрыв жизненного цикла."),
            Ev(r2, 2, AgentEventKind.Decision, AgentRole.Orchestrator, "Нужны два независимых исследования", "Фактическая реализация в ASCOA и корректная практика учёта — разные вопросы, их нельзя смешивать в одном анализе."),
            Ev(r2, 3, AgentEventKind.TaskAssigned, AgentRole.Orchestrator, "TASK-1 исследователю ASCOA", "Собрать фактическую реализацию списания ОС по коду, а не по документации.", target: AgentRole.DomainResearcher, taskId: r2t1.Id),
            Ev(r2, 3, AgentEventKind.TaskAssigned, AgentRole.Orchestrator, "TASK-2 бухгалтеру", "Описать корректную модель выбытия по практике учёта и МСФО.", target: AgentRole.Accountant, taskId: r2t2.Id),
            Ev(r2, 6, AgentEventKind.Research, AgentRole.DomainResearcher, "Читаю AssetWriteOffDocument", "Ищу комиссию, реализацию амортизации и фиксацию остаточной стоимости.", taskId: r2t1.Id),
            Ev(r2, 9, AgentEventKind.Research, AgentRole.Accountant, "Разбираю основания выбытия", "Износ, устаревание, авария, недостача, продажа — у них разные последствия для учёта.", taskId: r2t2.Id),
            Ev(r2, 18, AgentEventKind.DefectFound, AgentRole.DomainResearcher, "Документация ASCOA расходится с кодом", "Бизнес-процесс утверждает, что при списании реализуется амортизация и фиксируется получатель. В коде этого нет: значения переносятся без изменений, а поля получателя принадлежат складскому списанию, не ОС.", taskId: r2t1.Id),
            Ev(r2, 22, AgentEventKind.Answer, AgentRole.Accountant, "Пять независимых измерений состояния", "Состояние документа, бухгалтерское выбытие, физическое состояние объекта, снятие ответственности и факт утилизации нельзя сводить в одно поле.", target: AgentRole.Orchestrator, taskId: r2t2.Id),
            Ev(r2, 26, AgentEventKind.TaskCompleted, AgentRole.Accountant, "TASK-2 завершена", r2t2.Result, taskId: r2t2.Id),
            Ev(r2, 28, AgentEventKind.TaskCompleted, AgentRole.DomainResearcher, "TASK-1 завершена", r2t1.Result, taskId: r2t1.Id),
            Ev(r2, 30, AgentEventKind.Meeting, AgentRole.Orchestrator, "Сверка двух заключений", "Исследование кода и практика учёта разошлись: комиссии в ASCOA нет, а практика её требует. Решаем, что делать.", participants: "Orchestrator, Architect, Accountant, DomainResearcher"),
            Ev(r2, 36, AgentEventKind.Decision, AgentRole.Architect, "Комиссия вводится, хотя в ASCOA её нет", "Это улучшение, а не перенос: без комиссии у акта нет основания.", taskId: r2t3.Id),
            Ev(r2, 40, AgentEventKind.Decision, AgentRole.Architect, "Реализация не будет основанием списания", "Продажа — отдельный процесс со своей стороной сделки, а не признак в акте.", taskId: r2t3.Id),
            Ev(r2, 45, AgentEventKind.TaskCompleted, AgentRole.Architect, "TASK-3 завершена", r2t3.Result, taskId: r2t3.Id),
            Ev(r2, 50, AgentEventKind.Implementation, AgentRole.BackendDev, "Проведение акта о списании", "Снимок стоимости, снятие ответственности, запись регистра.", taskId: r2t4.Id),
            Ev(r2, 62, AgentEventKind.Implementation, AgentRole.BackendDev, "Запрет сторно после утилизации", "Объекта физически нет — восстанавливать в учёте нечего.", taskId: r2t4.Id),
            Ev(r2, 66, AgentEventKind.Review, AgentRole.SecurityReviewer, "Проверка пути проведения", "Проверки комиссии стоят при утверждении, стоимостные — при проведении, обе внутри той же операции. Обойти нечем."),
            Ev(r2, 75, AgentEventKind.TestRun, AgentRole.TestEngineer, "Первый прогон", "36 из 37 зелёные.", taskId: r2t5.Id),
            Ev(r2, 78, AgentEventKind.DefectFound, AgentRole.TestEngineer, "Падает тест о составе комиссии", "Ошибка в самом тесте: мутируется отслеживаемая коллекция вместо явной вставки.", taskId: r2t5.Id),
            Ev(r2, 82, AgentEventKind.Question, AgentRole.TestEngineer, "Дефект в правиле или в тесте?", "Нужно понять, менять код или тест.", target: AgentRole.BackendDev, taskId: r2t5.Id),
            Ev(r2, 84, AgentEventKind.Answer, AgentRole.BackendDev, "Правило верно, ошибка в тесте", "Вставка члена комиссии должна идти через DbSet с явным DocumentId.", target: AgentRole.TestEngineer, taskId: r2t4.Id),
            Ev(r2, 88, AgentEventKind.TestRun, AgentRole.TestEngineer, "37 тестов зелёные", "Правила выбытия подтверждены.", taskId: r2t5.Id),
            Ev(r2, 92, AgentEventKind.Implementation, AgentRole.FrontendDev, "Форма акта и подтверждение утилизации", "Выбор комиссии, заключение, отдельная кнопка подтверждения вывоза.", taskId: r2t6.Id),
            Ev(r2, 94, AgentEventKind.Review, AgentRole.ReleaseValidator, "Сквозная проверка выбытия", "Отказ без комиссии, отказ без заключения, полный акт, подтверждение утилизации, запрет сторно — прогнано по HTTP."),
            Ev(r2, 95, AgentEventKind.RequirementCompleted, AgentRole.Orchestrator, "REQ-OSN-002 DONE", r2.Result));

        db.DecisionRecords.AddRange(
            new DecisionRecord
            {
                RequirementId = r2.Id, At = t0.AddMinutes(36),
                Question = "Нужна ли комиссия в акте о списании, если в ASCOA её нет?",
                Options = "A — воспроизвести ASCOA: списание без комиссии; B — ввести комиссию как обязательное основание акта",
                Decision = "B — комиссия обязательна: председатель и не менее двух членов",
                Reason = "Исследование кода показало, что в ASCOA комиссия привязана только к инвентаризации, а списание ОС её не имеет. Практика учёта требует, чтобы непригодность объекта кто-то удостоверил. Это тот случай, когда источник опыта хуже практики, и повторять его не нужно.",
                Impact = "Акт без председателя, без двух членов или без заключения не проходит утверждение.",
                Agents = "Architect, Accountant, DomainResearcher"
            },
            new DecisionRecord
            {
                RequirementId = r2.Id, At = t0.AddMinutes(38),
                Question = "Бухгалтерское выбытие и физическая утилизация — одно событие или два?",
                Options = "A — одно: проведение акта означает, что объекта больше нет; B — два независимых факта с разными датами",
                Decision = "B — два независимых факта",
                Reason = "Крупный объект снимается с баланса, но физически остаётся на площадке недели и месяцы. Если не хранить факт вывоза отдельно, предприятие теряет контроль за списанным, но не утилизированным имуществом. Отсюда же следует правило: после подтверждения утилизации сторно списания бессмысленно.",
                Impact = "У актива появились дата выбытия и отдельный момент утилизации; сторно запрещается после второго.",
                Agents = "Accountant, Architect"
            },
            new DecisionRecord
            {
                RequirementId = r2.Id, At = t0.AddMinutes(40),
                Question = "Оформлять ли реализацию ОС актом о списании с признаком «продажа»?",
                Options = "A — да, признак основания; B — нет, отдельный процесс продажи",
                Decision = "B — отдельный процесс",
                Reason = "При продаже выбытие ОС — следствие сделки, у которой своя сторона: акт приёма-передачи, выручка, НДС, расчёты с покупателем. Признак в акте списания дал бы документ, который притворяется двумя разными.",
                Impact = "Перечень оснований ограничен износом, устареванием, аварией, недостачей и иным; продажа не принимается API.",
                Agents = "Accountant, Architect"
            });

        // ================================================================ REQ-OSN-003
        var r3 = new Requirement
        {
            Code = "REQ-OSN-003",
            Title = "Pixel Office — визуализация работы агентной системы",
            OriginalRequest =
                "Необходимо разработать отдельную тестовую страницу Pixel Office / Agent Office, " +
                "которая визуально показывает реальную работу ИИ-агентов над проектом в виде " +
                "живого пиксельного офиса… Красивый офис с фейковой логикой хуже простого офиса " +
                "с настоящей агентной работой.",
            FormalizedStatement =
                "Отдельная страница /agent-office, отображающая фактическую историю работы агентов " +
                "над требованиями: назначения, обращения между агентами, встречи, решения, " +
                "реализацию, тестирование и результат. Единая модель событий обслуживает и офис, " +
                "и журнал, и отчёт по требованию. Визуализация отделена от источника событий.",
            Status = RequirementStatus.Done,
            CreatedAt = t0.AddMinutes(100),
            CompletedAt = t0.AddMinutes(151),
            Result =
                "Страница /agent-office работает. Офис нарисован на canvas: двенадцать рабочих мест, " +
                "переговорная, серверная, кофе-поинт; персонажи ходят по сетке проходимости и не " +
                "проходят сквозь стены и столы. Движение происходит только по фактическим событиям: " +
                "на Question агент идёт к столу адресата, на Answer возвращается к себе, на Meeting " +
                "участники собираются в переговорной. Журнал событий, карточка агента и карточка " +
                "требования питаются из одного потока, поэтому разойтись не могут. Карточка требования " +
                "показывает дословный запрос владельца рядом с формализованной постановкой, задачи с " +
                "исполнителями, принятые решения с обоснованием, хронологию и итог. Записывать события " +
                "может только рантайм агентов через POST /api/agent-office/events под правом " +
                "agent-office.write; страница этим правом не обладает.",
            Remaining =
                "События пишет оркестратор по ходу работы, а не автономный демон: поток пополняется " +
                "порциями, а не непрерывно. Персонажи — простые спрайты без анимации шага. " +
                "Сохранение позиции воспроизведения между открытиями страницы не сделано: офис " +
                "каждый раз проигрывает историю с начала."
        };
        db.Requirements.Add(r3);

        var r3t1 = new AgentTask { RequirementId = r3.Id, Code = "TASK-1", AgentRole = AgentRole.Architect, Title = "Модель событий и граница визуализации", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(101), CompletedAt = t0.AddMinutes(112), Result = "Один поток событий обслуживает офис, журнал и отчёт. Источник событий отделён от страницы: рантайм пишет, страница читает." };
        var r3t2 = new AgentTask { RequirementId = r3.Id, Code = "TASK-2", AgentRole = AgentRole.FrontendDev, Title = "Страница офиса на canvas", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(113), CompletedAt = t0.AddMinutes(142), Result = "Планировка, поиск пути, состояния агентов по видам событий, журнал, карточка агента и карточка требования." };
        var r3t3 = new AgentTask { RequirementId = r3.Id, Code = "TASK-3", AgentRole = AgentRole.TestEngineer, Title = "Проверка планировки и потока событий", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(130), CompletedAt = t0.AddMinutes(146), Result = "Статическая проверка карты: все 12 рабочих мест и 6 мест в переговорной связны. Проверка API: 47 событий, обращения, встреча и дефекты читаются, дочитывание по after и фильтр по требованию работают." };
        var r3t4 = new AgentTask { RequirementId = r3.Id, Code = "TASK-4", AgentRole = AgentRole.SecurityReviewer, Title = "Права на чтение и запись журнала", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(146), CompletedAt = t0.AddMinutes(150), Result = "Журнал агентов вынесен из-под document.view в собственные права agent-office.view и agent-office.write." };
        db.AgentTasks.AddRange(r3t1, r3t2, r3t3, r3t4);

        db.AgentEvents.AddRange(
            Ev(r3, 100, AgentEventKind.RequirementCreated, AgentRole.Orchestrator, "REQ-OSN-003 принято в работу", "Владелец запросил страницу, показывающую реальную работу агентов, а не постановочную анимацию."),
            Ev(r3, 102, AgentEventKind.Research, AgentRole.Architect, "Изучаю соглашения требований ASCOA", "Формат REQ-ОБЛАСТЬ-NN с метаданными, критериями приёмки и разделом Out of Scope.", taskId: r3t1.Id),
            Ev(r3, 106, AgentEventKind.Decision, AgentRole.Architect, "Единая модель событий", "Отдельная история для офиса и для требований неизбежно разошлась бы.", taskId: r3t1.Id),
            Ev(r3, 110, AgentEventKind.Decision, AgentRole.Architect, "Canvas без игрового движка", "Десяток персонажей на сетке не требует Phaser или PixiJS, а сборочный шаг сломал бы запуск одной командой.", taskId: r3t1.Id),
            Ev(r3, 112, AgentEventKind.TaskCompleted, AgentRole.Architect, "TASK-1 завершена", r3t1.Result, taskId: r3t1.Id),
            Ev(r3, 114, AgentEventKind.Implementation, AgentRole.FrontendDev, "Строю офис и маршруты агентов", "Сетка проходимости, столы по ролям, переговорная, журнал событий.", taskId: r3t2.Id),

            Ev(r3, 118, AgentEventKind.Question, AgentRole.FrontendDev, "Может ли страница сама дописывать события?", "Соблазнительно: страница знает, что показала, и могла бы отмечать прогресс. Спрашиваю, допустимо ли это.", target: AgentRole.SecurityReviewer, taskId: r3t2.Id),
            Ev(r3, 121, AgentEventKind.Answer, AgentRole.SecurityReviewer, "Нет. Страница только читает", "Если визуализация пишет в журнал, она перестаёт быть визуализацией и становится источником. Тогда нельзя отличить, что агенты сделали, от того, что дорисовал интерфейс.", target: AgentRole.FrontendDev, taskId: r3t2.Id),

            Ev(r3, 126, AgentEventKind.Implementation, AgentRole.FrontendDev, "Движение только по событиям", "Никаких перемещений «для оживления»: агент встаёт из-за стола, лишь когда событие действительно требует обращения к коллеге.", taskId: r3t2.Id),
            Ev(r3, 132, AgentEventKind.TestRun, AgentRole.TestEngineer, "Статическая проверка планировки офиса", "Каждое рабочее место проверяется на достижимость обходом в ширину и на наличие стола и клетки подхода.", taskId: r3t3.Id),
            Ev(r3, 134, AgentEventKind.DefectFound, AgentRole.TestEngineer, "У одного агента рабочее место без стола", "Специалист по ERP сидел в пустой клетке: при правке карты третья колонка столов в нижнем ряду не была продлена. Рассуждением это не нашлось — проверка обнаружила расхождение места и мебели.", taskId: r3t3.Id),
            Ev(r3, 136, AgentEventKind.Implementation, AgentRole.FrontendDev, "Стол достроен, карта исправлена", "Проверка проходит: 12 рабочих мест и 6 мест в переговорной связны.", taskId: r3t2.Id),

            Ev(r3, 138, AgentEventKind.Review, AgentRole.Reviewer, "Скорость не влияла на темп событий", "Кнопки 1×/2×/4× ускоряли только ходьбу, а события шли фиксированным интервалом: персонаж не успевал дойти, и картинка расходилась с журналом.", taskId: r3t2.Id),
            Ev(r3, 140, AgentEventKind.Implementation, AgentRole.FrontendDev, "Темп воспроизведения привязан к скорости", "События с переходом по офису держатся дольше остальных, чтобы показанное совпадало с журналом.", taskId: r3t2.Id),
            Ev(r3, 142, AgentEventKind.TaskCompleted, AgentRole.FrontendDev, "TASK-2 завершена", r3t2.Result, taskId: r3t2.Id),
            Ev(r3, 144, AgentEventKind.TestRun, AgentRole.TestEngineer, "Проверка потока событий через API", "47 событий, три обращения с ответами, одно совещание, три дефекта. Дочитывание по after и фильтр по требованию работают.", taskId: r3t3.Id),
            Ev(r3, 146, AgentEventKind.TaskCompleted, AgentRole.TestEngineer, "TASK-3 завершена", r3t3.Result, taskId: r3t3.Id),

            Ev(r3, 147, AgentEventKind.Review, AgentRole.SecurityReviewer, "Журнал агентов не относится к правам на документы", "Эндпоинты читались под document.view. Это разные области: кладовщику журнал разработки не нужен, а право писать в него не должно достаться никому, кроме рантайма.", taskId: r3t4.Id),
            Ev(r3, 149, AgentEventKind.Implementation, AgentRole.BackendDev, "Введены agent-office.view и agent-office.write", "Запись событий доступна только под правом на запись; страница обходится чтением."),
            Ev(r3, 150, AgentEventKind.TaskCompleted, AgentRole.SecurityReviewer, "TASK-4 завершена", r3t4.Result, taskId: r3t4.Id),
            Ev(r3, 151, AgentEventKind.RequirementCompleted, AgentRole.ReleaseValidator, "REQ-OSN-003 выполнено", "Страница открывается, офис наполняется по мере проигрывания реальной истории, обращения и совещание видны движением, карточка требования показывает дословный запрос и итог."));

        db.DecisionRecords.AddRange(
            new DecisionRecord
            {
                RequirementId = r3.Id, At = t0.AddMinutes(108),
                Question = "Откуда Pixel Office берёт события, если у агентов нет собственного рантайма с шиной?",
                Options = "A — генерировать правдоподобные события на стороне страницы; B — оркестратор записывает фактические события в хранилище, страница их читает",
                Decision = "B — хранилище фактических событий",
                Reason = "Агенты здесь — подпроцессы сессии, они не работают как демон и не публикуют события сами. Генерация на стороне страницы дала бы именно то, что владелец запретил: красивую картинку с выдуманной логикой. Запись оркестратором даёт настоящие события ценой того, что они появляются не потоком, а по мере работы.",
                Impact = "Страница отображает только то, что действительно произошло. Режим симуляции существует отдельно и только для отладки интерфейса.",
                Agents = "Orchestrator, Architect"
            },
            new DecisionRecord
            {
                RequirementId = r3.Id, At = t0.AddMinutes(122),
                Question = "Кому разрешено пополнять журнал работы агентов?",
                Options = "A — страница отмечает прогресс сама; B — пишет только рантайм агентов через отдельный эндпоинт под собственным правом",
                Decision = "B — запись только рантаймом под agent-office.write",
                Reason = "Визуализация, которой разрешено писать, перестаёт быть визуализацией: становится невозможно отличить работу агентов от того, что дорисовал интерфейс. Узкое право сохраняет это различие проверяемым, а не устным.",
                Impact = "Pixel Office можно выключить или переписать целиком, не затронув процесс работы агентов. Обратное неверно: без рантайма показывать нечего.",
                Agents = "FrontendDev, SecurityReviewer, Architect"
            });

        // ================================================================ REQ-OSN-004
        // Это требование владелец поставил, уже глядя на работающую страницу, и оно
        // заводилось не здесь, а рантаймом через API — по ходу работы. Здесь оно
        // сохранено, чтобы история переживала пересоздание базы.
        var r4 = new Requirement
        {
            Code = "REQ-OSN-004",
            Title = "Часовой пояс организации и заведение требований в реальном времени",
            OriginalRequest =
                "В журане событий время не верно отображется у агентов, часовой пояс должен быть алматы\n\n" +
                "В требованиях я не вижу задачу которую я сейчас дал тебе, я в реальном времени хочу видеть",
            FormalizedStatement =
                "Два требования в одном обращении. Первое: время в интерфейсе показывать в часовом " +
                "поясе организации (Алматы), а не в поясе устройства, с которого открыли страницу. " +
                "Второе: задача, которую владелец ставит сейчас, должна появляться в Agent Office " +
                "в реальном времени — значит, рантайму нужен вход для заведения требований и задач, " +
                "а странице — подхват новых требований, а не только новых событий.",
            Status = RequirementStatus.Done,
            CreatedAt = t0.AddMinutes(152),
            CompletedAt = t0.AddMinutes(201),
            Result =
                "Время в интерфейсе показывается в часовом поясе организации (Алматы), а не в поясе " +
                "устройства. Форматирование вынесено в общий format.js и применяется и в журнале " +
                "агентов, и в учётной части — включая даты документов и аудит, где расхождение было " +
                "опаснее всего. В журнале подписано «время — Алматы».\n\n" +
                "Найдено расхождение, которого не было видно из кода: .NET на этой машине считает " +
                "Asia/Almaty как UTC+6, а Asia/Qyzylorda — как UTC+5, хотя Казахстан с 2024 года " +
                "живёт в едином поясе. Браузер даёт +5 для обеих зон. Серверный пересчёт в местное " +
                "время убран: на устаревших данных он молча сдвинул бы дату проведения и в " +
                "пограничных случаях перенёс документ в соседний период.\n\n" +
                "Требования теперь заводятся рантаймом, а не только seed. Само это требование " +
                "заведено через API и наполнялось событиями по ходу работы — на открытой странице " +
                "оно появилось без перезагрузки.",
            Remaining =
                "Серверу пока нельзя вычислять календарный день организации: для закрытия периода " +
                "понадобится актуальная база часовых поясов (пакет TimeZoneConverter или переход на " +
                "PostgreSQL). Пояс задан одной константой в format.js — при мультитенантности он " +
                "станет настройкой тенанта. Опрос страницы раз в 5 секунд; push-канала нет."
        };
        db.Requirements.Add(r4);

        var r4t1 = new AgentTask { RequirementId = r4.Id, Code = "TASK-1", AgentRole = AgentRole.Architect, Title = "Разобраться, где именно теряется часовой пояс", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(153), CompletedAt = t0.AddMinutes(160), Result = "Хранение оказалось верным — моменты лежат в UTC. Дефект был в отображении: обе страницы форматировали время в поясе устройства." };
        var r4t2 = new AgentTask { RequirementId = r4.Id, Code = "TASK-2", AgentRole = AgentRole.FrontendDev, Title = "Единое форматирование времени в поясе организации", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(161), CompletedAt = t0.AddMinutes(178), Result = "Форматирование вынесено в общий format.js: пояс организации задан именем Asia/Almaty в единственном месте, обе страницы используют его." };
        var r4t3 = new AgentTask { RequirementId = r4.Id, Code = "TASK-3", AgentRole = AgentRole.BackendDev, Title = "Вход рантайма для требований и задач", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(179), CompletedAt = t0.AddMinutes(192), Result = "Рантайм может заводить требования и задачи и закрывать их с итогом. Страница подхватывает новые требования в опросе и не сбрасывает фильтр." };
        var r4t4 = new AgentTask { RequirementId = r4.Id, Code = "TASK-4", AgentRole = AgentRole.TestEngineer, Title = "Проверка расхождения баз часовых поясов", Status = RequirementStatus.Done, StartedAt = t0.AddMinutes(170), CompletedAt = t0.AddMinutes(198), Result = "Найдено расхождение баз часовых поясов сервера и браузера. Проверка зафиксирована в наборе, включая запуск с подменённым TZ." };
        db.AgentTasks.AddRange(r4t1, r4t2, r4t3, r4t4);

        db.AgentEvents.AddRange(
            Ev(r4, 152, AgentEventKind.RequirementCreated, AgentRole.Orchestrator, "REQ-OSN-004 принято в работу", "Владелец смотрит на работающую страницу и указывает на неверное время и на отсутствие своей текущей задачи."),
            Ev(r4, 153, AgentEventKind.TaskAssigned, AgentRole.Orchestrator, "Разобраться, где именно теряется часовой пояс", target: AgentRole.Architect, taskId: r4t1.Id),
            Ev(r4, 155, AgentEventKind.Research, AgentRole.Architect, "Смотрю, где формируется время", "Хранение верное: моменты лежат в UTC. Форматирование в обеих страницах шло через toLocaleString без указания пояса — то есть в поясе устройства.", taskId: r4t1.Id),
            Ev(r4, 158, AgentEventKind.Decision, AgentRole.Architect, "Пояс организации, а не пояс устройства", "Дата проведения документа — учётный факт, привязанный к календарному дню организации. Документ, проведённый 30 сентября в 23:40 по Алматы, обязан остаться в сентябре и при просмотре из другого пояса.", taskId: r4t1.Id),
            Ev(r4, 160, AgentEventKind.TaskCompleted, AgentRole.Architect, "TASK-1 завершена", r4t1.Result, taskId: r4t1.Id),

            Ev(r4, 163, AgentEventKind.Question, AgentRole.FrontendDev, "Задавать смещение числом или именем пояса?", "Если зашить +6 или +5, значение устареет молча при очередной реформе.", target: AgentRole.DomainResearcher, taskId: r4t2.Id),
            Ev(r4, 166, AgentEventKind.Answer, AgentRole.DomainResearcher, "Именем по базе IANA", "Казахстан в 2024 году перешёл на единый пояс UTC+5, Алматы сменил смещение. Имя зоны переживает такие изменения, число — нет.", target: AgentRole.FrontendDev, taskId: r4t2.Id),
            Ev(r4, 170, AgentEventKind.Implementation, AgentRole.FrontendDev, "Общий format.js для обеих страниц", "Форматирование вынесено из app.js и agent-office.js в один файл. В журнале подписано «время — Алматы».", taskId: r4t2.Id),

            Ev(r4, 172, AgentEventKind.TestRun, AgentRole.TestEngineer, "Сверяю пояс на сервере и в браузере", "Проверка одной и той же зоны Asia/Almaty в обеих средах.", taskId: r4t4.Id),
            Ev(r4, 174, AgentEventKind.DefectFound, AgentRole.TestEngineer, "Сервер и браузер расходятся на час", ".NET на этой машине отдаёт для Asia/Almaty UTC+6, а для Asia/Qyzylorda — UTC+5, хотя Казахстан живёт в едином поясе и значения обязаны совпадать. Браузер даёт +5 для обеих зон. База часовых поясов Windows устарела.", taskId: r4t4.Id),
            Ev(r4, 176, AgentEventKind.Question, AgentRole.TestEngineer, "Чьим данным верить?", "Нужно решить, какая сторона считает местное время.", target: AgentRole.Architect, taskId: r4t4.Id),
            Ev(r4, 179, AgentEventKind.Answer, AgentRole.Architect, "Прав браузер, серверу пересчёт запрещён", "Внутренняя противоречивость серверных данных доказывает их устарелость: Алматы и Кызылорда не могут иметь разное смещение. Пересчёт на сервере молча сдвинул бы дату проведения на час и в пограничных случаях перенёс документ в соседний период.", target: AgentRole.TestEngineer, taskId: r4t4.Id),
            Ev(r4, 181, AgentEventKind.Implementation, AgentRole.BackendDev, "Серверный пересчёт убран", "OrgCalendar оставлен как объявление о намерении и точка правки для мультитенантности, но местное время больше не вычисляет.", taskId: r4t3.Id),
            Ev(r4, 178, AgentEventKind.TaskCompleted, AgentRole.FrontendDev, "TASK-2 завершена", r4t2.Result, taskId: r4t2.Id),

            Ev(r4, 184, AgentEventKind.DefectFound, AgentRole.TestEngineer, "История начиналась в 05:00 утра", "Якорь времени в демонстрационных данных относился к середине истории, а не к её началу.", taskId: r4t4.Id),
            Ev(r4, 186, AgentEventKind.Implementation, AgentRole.BackendDev, "История уложена в рабочий день", "Теперь с 09:00 до 15:31 по Алматы.", taskId: r4t3.Id),
            Ev(r4, 188, AgentEventKind.Implementation, AgentRole.BackendDev, "Вход рантайма для требований и задач", "POST на требования, задачи и их завершение под правом agent-office.write. Дословный запрос обязателен, итог задачи обязателен, требование не закрывается как выполненное при незавершённых задачах.", taskId: r4t3.Id),
            Ev(r4, 190, AgentEventKind.Review, AgentRole.Reviewer, "Новое требование не появлялось бы на открытой странице", "Опрос дочитывал только события. Требование, заведённое во время просмотра, попало бы в журнал, но не в панель справа и не в фильтр.", taskId: r4t3.Id),
            Ev(r4, 192, AgentEventKind.Implementation, AgentRole.FrontendDev, "Подхват новых требований в опросе", "Если пришло событие по неизвестному требованию, список перечитывается. Выбранный фильтр при этом не сбрасывается. Опрос ускорен до 5 секунд.", taskId: r4t3.Id),

            Ev(r4, 195, AgentEventKind.TestRun, AgentRole.TestEngineer, "Проверка часового пояса добавлена в набор", "04:00 UTC показывается как 09:00, граница суток 30.09 19:40 UTC даёт 1 октября, а устройство в поясе Pacific/Auckland видит то же время.", taskId: r4t4.Id),
            Ev(r4, 197, AgentEventKind.DefectFound, AgentRole.TestEngineer, "Проверка поведения офиса перестала запускаться", "Форматирование переехало в отдельный файл, а harness грузил только agent-office.js. Следствие правки, а не старый дефект — исправлено загрузкой format.js в том же порядке, что на странице.", taskId: r4t4.Id),
            Ev(r4, 198, AgentEventKind.TaskCompleted, AgentRole.TestEngineer, "TASK-4 завершена", r4t4.Result, taskId: r4t4.Id),
            Ev(r4, 199, AgentEventKind.TaskCompleted, AgentRole.BackendDev, "TASK-3 завершена", r4t3.Result, taskId: r4t3.Id),
            Ev(r4, 201, AgentEventKind.RequirementCompleted, AgentRole.ReleaseValidator, "REQ-OSN-004 — выполнено", "Время показывается в поясе организации, требование заведено рантаймом и появилось на открытой странице без перезагрузки."));

        db.DecisionRecords.AddRange(
            new DecisionRecord
            {
                RequirementId = r4.Id, At = t0.AddMinutes(159),
                Question = "В каком часовом поясе показывать время: устройства или организации?",
                Options = "A — пояс устройства (по умолчанию в браузере); B — пояс организации, единый для всех зрителей",
                Decision = "B — пояс организации",
                Reason = "Дата проведения документа — учётный факт, привязанный к календарному дню организации, а не к тому, откуда на него смотрят. При поясе устройства документ, проведённый 30 сентября в 23:40 по Алматы, при просмотре из Москвы уехал бы в 18:40 того же дня, а из Лондона — мог бы показаться другим числом и попасть в уже закрытый период.",
                Impact = "Пояс задан в одном месте (format.js) именем по базе IANA. При мультитенантности станет настройкой тенанта.",
                Agents = "Architect, FrontendDev, DomainResearcher"
            },
            new DecisionRecord
            {
                RequirementId = r4.Id, At = t0.AddMinutes(180),
                Question = "Сервер и браузер дают для Asia/Almaty разное смещение. Кто считает местное время?",
                Options = "A — сервер отдаёт уже пересчитанное местное время; B — сервер отдаёт только UTC, пересчёт делает браузер",
                Decision = "B — пересчёт только на клиенте",
                Reason = "Серверные данные противоречат сами себе: Алматы даёт UTC+6, Кызылорда — UTC+5, хотя Казахстан с 2024 года в едином поясе. Внутренняя противоречивость доказывает устарелость базы. Браузерная база согласована и совпадает с реформой. Пересчёт на устаревших данных не упал бы, а молча ошибся на час — худший вид дефекта в учёте.",
                Impact = "Серверный OrgCalendar больше не вычисляет местное время и содержит описание ловушки. Для закрытия периода на сервере понадобится актуальная база поясов.",
                Agents = "TestEngineer, Architect, BackendDev"
            });

        await db.SaveChangesAsync();
    }
}
