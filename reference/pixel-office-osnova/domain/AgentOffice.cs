namespace Osnova.Domain;

/// <summary>
/// Состояние требования. Требование не считается выполненным только потому, что
/// написан код: нужен работающий сценарий, тесты и проверяемый результат.
/// </summary>
public enum RequirementStatus
{
    Draft = 0,
    InProgress = 1,
    /// <summary>Сделано и проверено запуском.</summary>
    Done = 2,
    /// <summary>Часть работает, часть осталась — честный статус вместо круглого «готово».</summary>
    PartiallyDone = 3,
    Rejected = 4
}

/// <summary>
/// Роль агента. Соответствует ростеру `.claude/agents/`, принятому из Letflow,
/// плюс предметные специалисты, которых оркестратор привлекает под конкретную
/// задачу (бухгалтер, специалист по ERP) — они существуют ровно столько, сколько
/// нужно задаче, и заводить их «на всякий случай» незачем.
/// </summary>
public enum AgentRole
{
    Orchestrator = 1,
    BusinessAnalyst = 2,
    Architect = 3,
    BackendDev = 4,
    FrontendDev = 5,
    SecurityReviewer = 6,
    Reviewer = 7,
    TestEngineer = 8,
    DomainResearcher = 9,
    Accountant = 10,
    ErpSpecialist = 11,
    ReleaseValidator = 12
}

/// <summary>Вид события. Одна модель обслуживает и офис, и журнал, и отчёт по
/// требованию — два независимых источника истории неизбежно разошлись бы.</summary>
public enum AgentEventKind
{
    RequirementCreated = 1,
    TaskAssigned = 2,
    WorkStarted = 3,
    Research = 4,
    /// <summary>Один агент обращается к другому: в офисе это переход к его столу.</summary>
    Question = 5,
    Answer = 6,
    /// <summary>Несколько агентов собираются в переговорной.</summary>
    Meeting = 7,
    Decision = 8,
    Implementation = 9,
    Review = 10,
    TestRun = 11,
    DefectFound = 12,
    TaskCompleted = 13,
    RequirementCompleted = 14
}

/// <summary>
/// Требование. Хранит и дословный запрос пользователя, и формализованную
/// постановку: через месяц должно быть видно, что именно было сказано, а не только
/// как система это поняла.
/// </summary>
public class Requirement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    /// <summary>Код в формате проекта: REQ-OSN-NNN (соглашение взято из ASCOA).</summary>
    public string Code { get; set; } = null!;
    public string Title { get; set; } = null!;

    /// <summary>Дословный текст пользователя. Не заменяется формализованным.</summary>
    public string OriginalRequest { get; set; } = null!;
    /// <summary>Как система поняла запрос и что на самом деле делала.</summary>
    public string FormalizedStatement { get; set; } = null!;

    public RequirementStatus Status { get; set; } = RequirementStatus.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>Что теперь реально работает — описанное поведением, а не списком файлов.</summary>
    public string? Result { get; set; }
    public string? Remaining { get; set; }

    public List<AgentTask> Tasks { get; set; } = new();
    public List<AgentEvent> Events { get; set; } = new();
    public List<DecisionRecord> Decisions { get; set; } = new();
}

public class AgentTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequirementId { get; set; }
    public Requirement Requirement { get; set; } = null!;

    public string Code { get; set; } = null!;   // TASK-1
    public AgentRole AgentRole { get; set; }
    public string Title { get; set; } = null!;
    public RequirementStatus Status { get; set; } = RequirementStatus.InProgress;
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    /// <summary>Итог работы агента — вывод, а не пересказ процесса.</summary>
    public string? Result { get; set; }
}

public class AgentEvent
{
    public long Id { get; set; }
    public Guid? RequirementId { get; set; }
    public Requirement? Requirement { get; set; }
    public Guid? TaskId { get; set; }

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public AgentEventKind Kind { get; set; }

    public AgentRole ActorRole { get; set; }
    /// <summary>Адресат обращения — для вопроса и ответа.</summary>
    public AgentRole? TargetRole { get; set; }
    /// <summary>Участники встречи, перечисленные через запятую.</summary>
    public string? Participants { get; set; }

    /// <summary>Короткая тема: то, что помещается в облачко над персонажем.</summary>
    public string Topic { get; set; } = null!;
    /// <summary>Подробность для журнала и карточки. Не внутренние рассуждения модели,
    /// а рабочий артефакт: вопрос, вывод, найденный дефект, итог проверки.</summary>
    public string? Detail { get; set; }
}

/// <summary>
/// Запись о принятом решении. Сохраняется инженерный результат развилки, а не
/// скрытый ход рассуждений: вопрос, рассмотренные варианты, выбор и его причина.
/// </summary>
public class DecisionRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequirementId { get; set; }
    public Requirement Requirement { get; set; } = null!;

    public string Question { get; set; } = null!;
    public string Options { get; set; } = null!;
    public string Decision { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public string? Impact { get; set; }
    /// <summary>Роли, участвовавшие в решении.</summary>
    public string Agents { get; set; } = null!;
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}
