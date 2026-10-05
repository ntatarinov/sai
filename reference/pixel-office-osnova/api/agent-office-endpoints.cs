// Excerpt from osnova/backend/src/Osnova.Api/Program.cs (lines 745-1021 endpoints, 1037-1043 request records)
app.MapGet("/api/agent-office/requirements", async (HttpContext ctx, AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeView);
    var reqs = await db.Requirements.Include(r => r.Tasks).ToListAsync();
    return Results.Ok(reqs.OrderByDescending(r => r.CreatedAt).Select(r => new
    {
        r.Id, r.Code, r.Title, status = r.Status.ToString(), r.CreatedAt, r.CompletedAt,
        tasks = r.Tasks.Count,
        tasksDone = r.Tasks.Count(t => t.Status == RequirementStatus.Done),
        agents = r.Tasks.Select(t => t.AgentRole.ToString()).Distinct()
    }));
});

app.MapGet("/api/agent-office/requirements/{code}", async (string code, HttpContext ctx,
    AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeView);
    var r = await db.Requirements
        .Include(x => x.Tasks).Include(x => x.Events).Include(x => x.Decisions)
        .FirstOrDefaultAsync(x => x.Code == code);
    if (r is null) return Results.NotFound();

    return Results.Ok(new
    {
        r.Id, r.Code, r.Title, r.OriginalRequest, r.FormalizedStatement,
        status = r.Status.ToString(), r.CreatedAt, r.CompletedAt, r.Result, r.Remaining,
        tasks = r.Tasks.OrderBy(t => t.Code).Select(t => new
        {
            t.Id, t.Code, agent = t.AgentRole.ToString(), t.Title,
            status = t.Status.ToString(), t.StartedAt, t.CompletedAt, t.Result
        }),
        decisions = r.Decisions.OrderBy(d => d.At).Select(d => new
        {
            d.Question, d.Options, d.Decision, d.Reason, d.Impact, d.Agents, d.At
        }),
        timeline = r.Events.OrderBy(e => e.Id).Select(e => new
        {
            e.Id, e.At, kind = e.Kind.ToString(), actor = e.ActorRole.ToString(),
            target = e.TargetRole != null ? e.TargetRole.ToString() : null,
            e.Participants, e.Topic, e.Detail, e.TaskId
        })
    });
});

/// Поток событий для офиса. `after` позволяет дочитывать только новое — страница
/// опрашивает этот эндпоинт и не перерисовывает уже показанное.
app.MapGet("/api/agent-office/events", async (HttpContext ctx, AuthService auth,
    OsnovaDbContext db, long? after, string? requirement) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeView);
    var q = db.AgentEvents.AsQueryable();
    if (after is long a) q = q.Where(e => e.Id > a);
    if (!string.IsNullOrWhiteSpace(requirement))
        q = q.Where(e => e.Requirement != null && e.Requirement.Code == requirement);

    var events = await q.OrderBy(e => e.Id).Take(500)
        .Join(db.Requirements, e => e.RequirementId, r => r.Id, (e, r) => new { e, r })
        .ToListAsync();

    return Results.Ok(events.Select(x => new
    {
        x.e.Id, x.e.At, kind = x.e.Kind.ToString(),
        actor = x.e.ActorRole.ToString(),
        target = x.e.TargetRole != null ? x.e.TargetRole.ToString() : null,
        x.e.Participants, x.e.Topic, x.e.Detail,
        requirement = x.r.Code, requirementTitle = x.r.Title
    }));
});

/// Состав офиса: роли, которые реально участвовали в работе, и их текущая занятость.
app.MapGet("/api/agent-office/agents", async (HttpContext ctx, AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeView);
    var tasks = await db.AgentTasks.Include(t => t.Requirement).ToListAsync();
    var events = await db.AgentEvents.ToListAsync();

    return Results.Ok(Enum.GetValues<AgentRole>().Select(role => new
    {
        role = role.ToString(),
        tasksTotal = tasks.Count(t => t.AgentRole == role),
        tasksDone = tasks.Count(t => t.AgentRole == role && t.Status == RequirementStatus.Done),
        eventsCount = events.Count(e => e.ActorRole == role),
        current = tasks.Where(t => t.AgentRole == role && t.Status == RequirementStatus.InProgress)
            .Select(t => new { t.Code, t.Title, requirement = t.Requirement.Code })
            .FirstOrDefault()
    }).Where(x => x.tasksTotal > 0 || x.eventsCount > 0));
});

/// Вход рантайма агентов. Это единственный способ пополнить журнал: страница
/// Agent Office пишущим правом не обладает и ничего сюда не отправляет — она
/// только читает. Так визуализация остаётся следствием работы агентов, а не её
/// источником, и её можно снять, не затронув сам процесс.
app.MapPost("/api/agent-office/events", async (AgentEventRequest req, HttpContext ctx,
    AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeWrite);

    var requirement = await db.Requirements.FirstOrDefaultAsync(r => r.Code == req.Requirement)
        ?? throw new DomainException("REQUIREMENT_UNKNOWN",
            $"Требование {req.Requirement} не заведено — событие некуда отнести.");

    if (!Enum.TryParse<AgentEventKind>(req.Kind, out var kind))
        throw new DomainException("EVENT_KIND_UNKNOWN", $"Неизвестный вид события: {req.Kind}.");
    if (!Enum.TryParse<AgentRole>(req.Actor, out var actor))
        throw new DomainException("AGENT_ROLE_UNKNOWN", $"Неизвестная роль агента: {req.Actor}.");

    AgentRole? target = null;
    if (!string.IsNullOrWhiteSpace(req.Target))
    {
        if (!Enum.TryParse<AgentRole>(req.Target, out var t))
            throw new DomainException("AGENT_ROLE_UNKNOWN", $"Неизвестная роль адресата: {req.Target}.");
        target = t;
    }

    // Обращение без адресата нечем показать в офисе и нечего разбирать в отчёте.
    if (kind is AgentEventKind.Question or AgentEventKind.Answer && target is null)
        throw new DomainException("EVENT_TARGET_REQUIRED",
            "Обращение и ответ требуют указания второго агента.");
    if (kind is AgentEventKind.Meeting && string.IsNullOrWhiteSpace(req.Participants))
        throw new DomainException("EVENT_PARTICIPANTS_REQUIRED",
            "Совещание требует перечисления участников.");

    var ev = new AgentEvent
    {
        RequirementId = requirement.Id,
        Kind = kind,
        ActorRole = actor,
        TargetRole = target,
        Participants = req.Participants,
        Topic = req.Topic,
        Detail = req.Detail,
        At = DateTimeOffset.UtcNow
    };
    db.AgentEvents.Add(ev);
    await db.SaveChangesAsync();
    return Results.Ok(new { ev.Id, ev.At });
});

/// Заведение требования рантаймом. Дословный запрос обязателен и не подменяется
/// формализованным: через месяц должно быть видно, что именно было сказано, —
/// в том числе если сказано было неточно и система поняла это иначе.
app.MapPost("/api/agent-office/requirements", async (RequirementRequest req, HttpContext ctx,
    AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeWrite);

    if (string.IsNullOrWhiteSpace(req.OriginalRequest))
        throw new DomainException("ORIGINAL_REQUEST_REQUIRED",
            "Дословный запрос обязателен: без него требование нельзя сверить с тем, что просили.");
    if (await db.Requirements.AnyAsync(r => r.Code == req.Code))
        throw new DomainException("REQUIREMENT_DUPLICATE", $"Требование {req.Code} уже заведено.");

    var r = new Requirement
    {
        Code = req.Code,
        Title = req.Title,
        OriginalRequest = req.OriginalRequest,
        FormalizedStatement = req.FormalizedStatement,
        Status = RequirementStatus.InProgress,
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.Requirements.Add(r);
    db.AgentEvents.Add(new AgentEvent
    {
        RequirementId = r.Id,
        Kind = AgentEventKind.RequirementCreated,
        ActorRole = AgentRole.Orchestrator,
        Topic = $"{r.Code} принято в работу",
        Detail = req.FormalizedStatement,
        At = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { r.Id, r.Code, r.CreatedAt });
});

/// Назначение задачи агенту. Отдельное событие, а не молчаливая запись: в офисе
/// это момент, когда исполнитель узнаёт, что делать.
app.MapPost("/api/agent-office/tasks", async (AgentTaskRequest req, HttpContext ctx,
    AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeWrite);

    var r = await db.Requirements.FirstOrDefaultAsync(x => x.Code == req.Requirement)
        ?? throw new DomainException("REQUIREMENT_UNKNOWN", $"Требование {req.Requirement} не заведено.");
    if (!Enum.TryParse<AgentRole>(req.Agent, out var role))
        throw new DomainException("AGENT_ROLE_UNKNOWN", $"Неизвестная роль агента: {req.Agent}.");

    var task = new AgentTask
    {
        RequirementId = r.Id, Code = req.Code, AgentRole = role, Title = req.Title,
        Status = RequirementStatus.InProgress, StartedAt = DateTimeOffset.UtcNow
    };
    db.AgentTasks.Add(task);
    db.AgentEvents.Add(new AgentEvent
    {
        RequirementId = r.Id, TaskId = task.Id,
        Kind = AgentEventKind.TaskAssigned,
        ActorRole = AgentRole.Orchestrator, TargetRole = role,
        Topic = req.Title, At = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { task.Id, task.Code });
});

/// Завершение задачи. Итог обязателен — «готово» без вывода не даёт понять,
/// что именно теперь работает.
app.MapPost("/api/agent-office/tasks/{code}/complete", async (string code, TaskResultRequest req,
    HttpContext ctx, AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeWrite);

    var task = await db.AgentTasks.Include(t => t.Requirement)
        .FirstOrDefaultAsync(t => t.Code == code && t.Requirement.Code == req.Requirement)
        ?? throw new DomainException("TASK_UNKNOWN", $"Задача {code} в {req.Requirement} не найдена.");
    if (string.IsNullOrWhiteSpace(req.Result))
        throw new DomainException("TASK_RESULT_REQUIRED", "Итог задачи обязателен.");

    task.Status = RequirementStatus.Done;
    task.CompletedAt = DateTimeOffset.UtcNow;
    task.Result = req.Result;
    db.AgentEvents.Add(new AgentEvent
    {
        RequirementId = task.RequirementId, TaskId = task.Id,
        Kind = AgentEventKind.TaskCompleted, ActorRole = task.AgentRole,
        Topic = $"{task.Code} завершена", Detail = req.Result, At = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { task.Code, task.Status, task.CompletedAt });
});

/// Закрытие требования. Статус «частично» — допустимый и честный исход;
/// поле «осталось» существует именно для того, чтобы им пользовались.
app.MapPost("/api/agent-office/requirements/{code}/complete", async (string code,
    RequirementResultRequest req, HttpContext ctx, AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.AgentOfficeWrite);

    var r = await db.Requirements.Include(x => x.Tasks).FirstOrDefaultAsync(x => x.Code == code)
        ?? throw new DomainException("REQUIREMENT_UNKNOWN", $"Требование {code} не заведено.");
    if (string.IsNullOrWhiteSpace(req.Result))
        throw new DomainException("REQUIREMENT_RESULT_REQUIRED",
            "Итог обязателен: требование не закрывается словом «готово».");

    var status = Enum.TryParse<RequirementStatus>(req.Status, out var s) ? s : RequirementStatus.Done;
    var unfinished = r.Tasks.Count(t => t.Status != RequirementStatus.Done);
    if (status == RequirementStatus.Done && unfinished > 0)
        throw new DomainException("REQUIREMENT_TASKS_OPEN",
            $"Незавершённых задач: {unfinished}. Требование закрывается как «частично» либо после их завершения.");

    r.Status = status;
    r.CompletedAt = DateTimeOffset.UtcNow;
    r.Result = req.Result;
    r.Remaining = req.Remaining;
    db.AgentEvents.Add(new AgentEvent
    {
        RequirementId = r.Id, Kind = AgentEventKind.RequirementCompleted,
        ActorRole = AgentRole.ReleaseValidator,
        Topic = $"{r.Code} — {(status == RequirementStatus.Done ? "выполнено" : "частично")}",
        Detail = req.Result, At = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(new { r.Code, status = r.Status.ToString(), r.CompletedAt });
});

app.MapGet("/api/audit", async (HttpContext ctx, AuthService auth, OsnovaDbContext db) =>
{
    (await Caller(ctx, auth)).Require(Permissions.DocumentView);
    return Results.Ok(await db.AuditEntries.OrderByDescending(a => a.At).Take(50)
        .Select(a => new
        {
            a.At, a.Action, a.EntityType, a.EntityId, a.BeforeState, a.AfterState,
            actor = db.Users.Where(u => u.Id == a.ActorUserId).Select(u => u.Login).FirstOrDefault()
        }).ToListAsync());
});

app.Run();


record AgentEventRequest(string Requirement, string Kind, string Actor, string Topic,
    string? Target, string? Participants, string? Detail);
record RequirementRequest(string Code, string Title, string OriginalRequest,
    string FormalizedStatement);
record AgentTaskRequest(string Requirement, string Code, string Agent, string Title);
record TaskResultRequest(string Requirement, string Result);
record RequirementResultRequest(string Result, string? Remaining, string? Status);
