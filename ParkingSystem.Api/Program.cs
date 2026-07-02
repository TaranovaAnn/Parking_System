using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ParkingSystem.Api.Application;
using ParkingSystem.Api.Domain;
using ParkingSystem.Api.Infrastructure;
using ParkingSystem.Api.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:4200", "http://localhost:4300"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs/parking"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSignalR().AddJsonProtocol(options =>
{
    options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<JwtTokenService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    await DbSeeder.SeedAsync(dbContext);
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseStaticFiles();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api");

api.MapPost("/auth/login", async (
    LoginRequest request,
    AppDbContext dbContext,
    JwtTokenService tokenService,
    CancellationToken cancellationToken) =>
{
    var username = request.Username.Trim().ToLowerInvariant();
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Username == username, cancellationToken);
    if (user is null)
    {
        return Results.Json(
            new ApiErrorResponse("Пользователь с таким логином не найден."),
            statusCode: StatusCodes.Status404NotFound);
    }

    if (!PasswordHelper.Verify(user, request.Password))
    {
        return Results.Json(
            new ApiErrorResponse("Неверный пароль."),
            statusCode: StatusCodes.Status401Unauthorized);
    }

    var token = tokenService.CreateToken(user);
    return Results.Ok(new AuthResponse(token, user.ToDto()));
});

api.MapGet("/auth/me", [Authorize] async (ClaimsPrincipal claimsPrincipal, AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    var user = await dbContext.Users.FindAsync([userId], cancellationToken);
    return user is null ? Results.NotFound() : Results.Ok(user.ToDto());
});

api.MapGet("/dashboard/summary", [Authorize(Roles = "Admin,Guard")] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    await AccessLogic.RefreshPassStatusesAsync(dbContext, cancellationToken);
    var totalCapacity = await dbContext.ParkingZones.SumAsync(x => x.Capacity, cancellationToken);
    var vehiclesInside = await AccessLogic.GetVehiclesInsideCountAsync(dbContext, cancellationToken);
    var todayStart = DateTimeOffset.UtcNow.Date;
    var todayEvents = await dbContext.AccessEvents.CountAsync(x => x.Timestamp >= todayStart, cancellationToken);

    return Results.Ok(new DashboardSummaryDto(vehiclesInside, Math.Max(0, totalCapacity - vehiclesInside), totalCapacity, todayEvents));
});

api.MapGet("/passes", [Authorize] async (ClaimsPrincipal claimsPrincipal, AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    await AccessLogic.RefreshPassStatusesAsync(dbContext, cancellationToken);
    var userId = GetUserId(claimsPrincipal);
    var role = GetRole(claimsPrincipal);

    var query = dbContext.Passes.AsQueryable();
    if (role == UserRole.Employee)
    {
        query = query.Where(x => x.OwnerUserId == userId);
    }

    var passes = await query
        .OrderByDescending(x => x.ValidFrom)
        .ThenByDescending(x => x.ValidTo)
        .ToListAsync(cancellationToken);
    return Results.Ok(passes.Select(x => x.ToDto()));
});

api.MapPost("/passes/guest", [Authorize(Roles = "Admin")] async (
    ClaimsPrincipal claimsPrincipal,
    CreateGuestPassRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.VehiclePlate))
    {
        return Results.BadRequest(new ApiErrorResponse("Укажите госномер."));
    }

    if (!AccessLogic.TryGetNormalizedPlate(request.VehiclePlate, out var normalizedPlate))
    {
        return Results.BadRequest(new ApiErrorResponse(AccessLogic.PlateFormatErrorMessage));
    }

    var zone = await dbContext.ParkingZones.FindAsync([request.ZoneId], cancellationToken);
    if (zone is null)
    {
        return Results.BadRequest(new ApiErrorResponse("Выбранная зона не найдена."));
    }

    var userId = GetUserId(claimsPrincipal);
    var pass = new VehiclePass
    {
        Id = Guid.NewGuid(),
        VehiclePlate = normalizedPlate,
        Type = PassType.Guest,
        Status = PassStatus.Active,
        ValidFrom = DateTimeOffset.UtcNow,
        ValidTo = DateTimeOffset.UtcNow.AddHours(request.DurationHours),
        ZoneId = request.ZoneId,
        OwnerUserId = userId,
        CreatedByUserId = userId,
        Notes = request.Notes
    };

    dbContext.Passes.Add(pass);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(pass.ToDto());
});

api.MapPost("/guest-requests", [Authorize(Roles = "Employee")] async (
    ClaimsPrincipal claimsPrincipal,
    CreateGuestPassRequestSubmission request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.VehiclePlate))
    {
        return Results.BadRequest(new ApiErrorResponse("Укажите госномер."));
    }

    if (!AccessLogic.TryGetNormalizedPlate(request.VehiclePlate, out var normalizedPlate))
    {
        return Results.BadRequest(new ApiErrorResponse(AccessLogic.PlateFormatErrorMessage));
    }

    if (request.DurationHours <= 0)
    {
        return Results.BadRequest(new ApiErrorResponse("Укажите срок действия заявки."));
    }

    var zone = await dbContext.ParkingZones.FindAsync([request.ZoneId], cancellationToken);
    if (zone is null)
    {
        return Results.BadRequest(new ApiErrorResponse("Выбранная зона не найдена."));
    }

    var userId = GetUserId(claimsPrincipal);
    var guestRequest = new GuestPassRequest
    {
        Id = Guid.NewGuid(),
        VehiclePlate = normalizedPlate,
        ZoneId = request.ZoneId,
        DurationHours = request.DurationHours,
        GuestFullName = string.IsNullOrWhiteSpace(request.GuestFullName) ? null : request.GuestFullName.Trim(),
        Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        Status = GuestRequestStatus.Pending,
        CreatedAt = DateTimeOffset.UtcNow,
        RequestedByUserId = userId
    };

    dbContext.GuestPassRequests.Add(guestRequest);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(guestRequest.ToDto());
});

api.MapGet("/guest-requests", [Authorize(Roles = "Admin,Guard,Employee")] async (
    ClaimsPrincipal claimsPrincipal,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    var role = GetRole(claimsPrincipal);

    var query = dbContext.GuestPassRequests.AsQueryable();
    if (role == UserRole.Employee)
    {
        query = query.Where(x => x.RequestedByUserId == userId);
    }

    var requests = await query
        .OrderByDescending(x => x.CreatedAt)
        .ToListAsync(cancellationToken);

    return Results.Ok(requests.Select(x => x.ToDto()));
});

api.MapPost("/guest-requests/{id:guid}/approve", [Authorize(Roles = "Admin,Guard")] async (
    Guid id,
    ClaimsPrincipal claimsPrincipal,
    ReviewGuestPassRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var guestRequest = await dbContext.GuestPassRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    if (guestRequest is null)
    {
        return Results.NotFound();
    }

    if (guestRequest.Status != GuestRequestStatus.Pending)
    {
        return Results.BadRequest(new ApiErrorResponse("Заявка уже обработана."));
    }

    var zone = await dbContext.ParkingZones.FindAsync([guestRequest.ZoneId], cancellationToken);
    if (zone is null)
    {
        return Results.BadRequest(new ApiErrorResponse("Выбранная зона не найдена."));
    }

    if (await dbContext.Passes.AnyAsync(x => x.VehiclePlate == guestRequest.VehiclePlate && x.Status == PassStatus.Active, cancellationToken))
    {
        return Results.BadRequest(new ApiErrorResponse("Уже есть активный пропуск на этот госномер."));
    }

    var reviewerId = GetUserId(claimsPrincipal);
    var pass = new VehiclePass
    {
        Id = Guid.NewGuid(),
        VehiclePlate = guestRequest.VehiclePlate,
        Type = PassType.Guest,
        Status = PassStatus.Active,
        ValidFrom = DateTimeOffset.UtcNow,
        ValidTo = DateTimeOffset.UtcNow.AddHours(guestRequest.DurationHours),
        ZoneId = guestRequest.ZoneId,
        OwnerUserId = guestRequest.RequestedByUserId,
        CreatedByUserId = reviewerId,
        Notes = guestRequest.Notes
    };

    guestRequest.Status = GuestRequestStatus.Approved;
    guestRequest.ReviewedByUserId = reviewerId;
    guestRequest.ReviewedAt = DateTimeOffset.UtcNow;
    guestRequest.ReviewComment = string.IsNullOrWhiteSpace(request.ReviewComment) ? null : request.ReviewComment.Trim();
    guestRequest.CreatedPassId = pass.Id;

    dbContext.Passes.Add(pass);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(guestRequest.ToDto());
});

api.MapPost("/guest-requests/{id:guid}/reject", [Authorize(Roles = "Admin,Guard")] async (
    Guid id,
    ClaimsPrincipal claimsPrincipal,
    ReviewGuestPassRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var guestRequest = await dbContext.GuestPassRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    if (guestRequest is null)
    {
        return Results.NotFound();
    }

    if (guestRequest.Status != GuestRequestStatus.Pending)
    {
        return Results.BadRequest(new ApiErrorResponse("Заявка уже обработана."));
    }

    guestRequest.Status = GuestRequestStatus.Rejected;
    guestRequest.ReviewedByUserId = GetUserId(claimsPrincipal);
    guestRequest.ReviewedAt = DateTimeOffset.UtcNow;
    guestRequest.ReviewComment = string.IsNullOrWhiteSpace(request.ReviewComment) ? null : request.ReviewComment.Trim();

    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(guestRequest.ToDto());
});

api.MapPost("/passes/permanent", [Authorize(Roles = "Admin")] async (
    ClaimsPrincipal claimsPrincipal,
    CreatePermanentPassRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.VehiclePlate))
    {
        return Results.BadRequest(new ApiErrorResponse("Укажите госномер."));
    }

    if (!AccessLogic.TryGetNormalizedPlate(request.VehiclePlate, out var normalizedPlate))
    {
        return Results.BadRequest(new ApiErrorResponse(AccessLogic.PlateFormatErrorMessage));
    }

    var zone = await dbContext.ParkingZones.FindAsync([request.ZoneId], cancellationToken);
    if (zone is null)
    {
        return Results.BadRequest(new ApiErrorResponse("Выбранная зона не найдена."));
    }

    var owner = await dbContext.Users.FindAsync([request.OwnerUserId], cancellationToken);
    if (owner is null)
    {
        return Results.BadRequest(new ApiErrorResponse("Сотрудник не найден."));
    }

    if (owner.Role != UserRole.Employee)
    {
        return Results.BadRequest(new ApiErrorResponse("Постоянный пропуск можно выдать только сотруднику."));
    }

    if (request.ValidTo <= DateTimeOffset.UtcNow)
    {
        return Results.BadRequest(new ApiErrorResponse("Дата окончания должна быть в будущем."));
    }

    var adminId = GetUserId(claimsPrincipal);
    if (await dbContext.Passes.AnyAsync(x => x.VehiclePlate == normalizedPlate && x.Status == PassStatus.Active, cancellationToken))
    {
        return Results.BadRequest(new ApiErrorResponse("Уже есть активный пропуск на этот госномер."));
    }

    var pass = new VehiclePass
    {
        Id = Guid.NewGuid(),
        VehiclePlate = normalizedPlate,
        Type = PassType.Permanent,
        Status = PassStatus.Active,
        ValidFrom = DateTimeOffset.UtcNow,
        ValidTo = request.ValidTo,
        ZoneId = request.ZoneId,
        OwnerUserId = owner.Id,
        CreatedByUserId = adminId,
        Notes = request.Notes
    };

    dbContext.Passes.Add(pass);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(pass.ToDto());
});

api.MapPost("/passes/{id:guid}/block", [Authorize(Roles = "Admin")] async (
    Guid id,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var pass = await dbContext.Passes.FindAsync([id], cancellationToken);
    if (pass is null)
    {
        return Results.NotFound();
    }

    pass.Status = PassStatus.Blocked;
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(pass.ToDto());
});

api.MapGet("/access/validate/{plate}", [Authorize(Roles = "Admin,Guard")] async (
    string plate,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    await AccessLogic.RefreshPassStatusesAsync(dbContext, cancellationToken);
    if (!AccessLogic.TryGetNormalizedPlate(plate, out var normalized))
    {
        return Results.Ok(new ValidatePassResponse(false, null, AccessLogic.PlateFormatErrorMessage));
    }

    var pass = await dbContext.Passes.FirstOrDefaultAsync(x => x.VehiclePlate == normalized, cancellationToken);
    if (pass is null)
    {
        return Results.Ok(new ValidatePassResponse(false, null, "Пропуск не найден"));
    }

    var error = pass.Status switch
    {
        PassStatus.Expired => "Пропуск истёк",
        PassStatus.Blocked => "Пропуск заблокирован",
        PassStatus.Draft => "Пропуск не активирован",
        _ => null
    };

    return Results.Ok(new ValidatePassResponse(true, pass.ToDto(), error));
});

api.MapPost("/access/entry", [Authorize(Roles = "Admin,Guard")] async (
    ClaimsPrincipal claimsPrincipal,
    AccessCommand command,
    AppDbContext dbContext,
    IHubContext<ParkingHub> hubContext,
    CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    if (!AccessLogic.TryGetNormalizedPlate(command.VehiclePlate, out var normalized))
    {
        return Results.Ok(await CreateFailedAccessResult(
            dbContext,
            hubContext,
            AccessLogic.NormalizePlate(command.VehiclePlate),
            userId,
            null,
            AccessLogic.PlateFormatErrorMessage,
            cancellationToken));
    }

    await AccessLogic.RefreshPassStatusesAsync(dbContext, cancellationToken);
    var pass = await dbContext.Passes.FirstOrDefaultAsync(x => x.VehiclePlate == normalized, cancellationToken);

    if (pass is null)
    {
        return Results.Ok(await CreateFailedAccessResult(dbContext, hubContext, normalized, userId, null, "Пропуск не найден", cancellationToken));
    }

    var validationError = pass.Status switch
    {
        PassStatus.Expired => "Пропуск истёк",
        PassStatus.Blocked => "Пропуск заблокирован",
        PassStatus.Draft => "Пропуск не активирован",
        _ => null
    };

    if (validationError is not null)
    {
        return Results.Ok(await CreateFailedAccessResult(dbContext, hubContext, normalized, userId, pass, validationError, cancellationToken));
    }

    if (await AccessLogic.IsVehicleInsideAsync(dbContext, normalized, cancellationToken))
    {
        return Results.Ok(await CreateFailedAccessResult(dbContext, hubContext, normalized, userId, pass, "Автомобиль уже на территории", cancellationToken));
    }

    var totalCapacity = await dbContext.ParkingZones.SumAsync(x => x.Capacity, cancellationToken);
    var vehiclesInside = await AccessLogic.GetVehiclesInsideCountAsync(dbContext, cancellationToken);
    if (vehiclesInside >= totalCapacity)
    {
        return Results.Ok(await CreateFailedAccessResult(dbContext, hubContext, normalized, userId, pass, "Парковка заполнена", cancellationToken));
    }

    var accessEvent = new AccessEvent
    {
        Id = Guid.NewGuid(),
        VehiclePlate = normalized,
        Direction = AccessDirection.Entry,
        Timestamp = DateTimeOffset.UtcNow,
        OperatorUserId = userId,
        ZoneId = pass.ZoneId ?? await dbContext.ParkingZones.Select(x => x.Id).FirstAsync(cancellationToken),
        PassId = pass.Id,
        Success = true
    };

    dbContext.AccessEvents.Add(accessEvent);
    await dbContext.SaveChangesAsync(cancellationToken);
    await BroadcastLiveUpdates(dbContext, hubContext, accessEvent, cancellationToken);
    return Results.Ok(new AccessResultDto(true, "Въезд разрешён", accessEvent.ToDto()));
});

api.MapPost("/access/exit", [Authorize(Roles = "Admin,Guard")] async (
    ClaimsPrincipal claimsPrincipal,
    AccessCommand command,
    AppDbContext dbContext,
    IHubContext<ParkingHub> hubContext,
    CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    if (!AccessLogic.TryGetNormalizedPlate(command.VehiclePlate, out var normalized))
    {
        return Results.Ok(await CreateFailedAccessResult(
            dbContext,
            hubContext,
            AccessLogic.NormalizePlate(command.VehiclePlate),
            userId,
            null,
            AccessLogic.PlateFormatErrorMessage,
            cancellationToken,
            AccessDirection.Exit));
    }

    var pass = await dbContext.Passes.FirstOrDefaultAsync(x => x.VehiclePlate == normalized, cancellationToken);
    var isInside = await AccessLogic.IsVehicleInsideAsync(dbContext, normalized, cancellationToken);

    if (!isInside)
    {
        return Results.Ok(await CreateFailedAccessResult(dbContext, hubContext, normalized, userId, pass, "Автомобиль не на территории", cancellationToken, AccessDirection.Exit));
    }

    var accessEvent = new AccessEvent
    {
        Id = Guid.NewGuid(),
        VehiclePlate = normalized,
        Direction = AccessDirection.Exit,
        Timestamp = DateTimeOffset.UtcNow,
        OperatorUserId = userId,
        ZoneId = pass?.ZoneId ?? await dbContext.ParkingZones.Select(x => x.Id).FirstAsync(cancellationToken),
        PassId = pass?.Id,
        Success = true
    };

    dbContext.AccessEvents.Add(accessEvent);
    await dbContext.SaveChangesAsync(cancellationToken);
    await BroadcastLiveUpdates(dbContext, hubContext, accessEvent, cancellationToken);
    return Results.Ok(new AccessResultDto(true, "Выезд зарегистрирован", accessEvent.ToDto()));
});

api.MapGet("/access-events", [Authorize(Roles = "Admin,Guard")] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var events = await dbContext.AccessEvents.OrderByDescending(x => x.Timestamp).ToListAsync(cancellationToken);
    return Results.Ok(events.Select(x => x.ToDto()));
});

api.MapGet("/zones", [Authorize(Roles = "Admin")] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var zones = await dbContext.ParkingZones.OrderBy(x => x.Name).ToListAsync(cancellationToken);
    var result = new List<ZoneDto>();
    foreach (var zone in zones)
    {
        var occupied = await AccessLogic.GetZoneOccupiedCountAsync(dbContext, zone.Id, cancellationToken);
        var free = Math.Max(0, zone.Capacity - occupied);
        var percent = zone.Capacity == 0 ? 0 : (int)Math.Round((double)occupied / zone.Capacity * 100);
        result.Add(new ZoneDto(zone.Id, zone.Name, zone.Capacity, zone.Description, occupied, free, percent));
    }

    return Results.Ok(result);
});

api.MapPut("/zones/{id:guid}", [Authorize(Roles = "Admin")] async (
    Guid id,
    UpdateZoneRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var zone = await dbContext.ParkingZones.FindAsync([id], cancellationToken);
    if (zone is null)
    {
        return Results.NotFound();
    }

    zone.Name = request.Name.Trim();
    zone.Capacity = request.Capacity;
    zone.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(zone);
});

api.MapGet("/users", [Authorize(Roles = "Admin")] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var users = await dbContext.Users.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
    return Results.Ok(users.Select(x => x.ToDto()));
});

api.MapPost("/users", [Authorize(Roles = "Admin")] async (
    CreateUserRequest request,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var username = request.Username.Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(username)
        || string.IsNullOrWhiteSpace(request.FullName)
        || string.IsNullOrWhiteSpace(request.Email)
        || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new ApiErrorResponse("Заполните все обязательные поля."));
    }

    if (request.Password.Length < 6)
    {
        return Results.BadRequest(new ApiErrorResponse("Пароль должен содержать минимум 6 символов."));
    }

    if (await dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
    {
        return Results.BadRequest(new ApiErrorResponse("Пользователь с таким логином уже существует."));
    }

    var user = new AppUser
    {
        Id = Guid.NewGuid(),
        Username = username,
        FullName = request.FullName.Trim(),
        Email = request.Email.Trim(),
        Role = request.Role,
    };
    user.PasswordHash = PasswordHelper.HashPassword(user, request.Password);

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(user.ToDto());
});

api.MapGet("/lookups/users", [Authorize] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var users = await dbContext.Users.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
    return Results.Ok(users.Select(x => x.ToDto()));
});

api.MapGet("/lookups/zones", [Authorize] async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var zones = await dbContext.ParkingZones.OrderBy(x => x.Name).ToListAsync(cancellationToken);
    return Results.Ok(zones);
});

api.MapGet("/documents", [Authorize(Roles = "Admin,Employee")] async (ClaimsPrincipal claimsPrincipal, AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    var role = GetRole(claimsPrincipal);

    IQueryable<PassDocument> query = dbContext.Documents;
    if (role == UserRole.Employee)
    {
        query = query.Where(x => x.Pass!.OwnerUserId == userId);
    }

    var documents = await query.OrderByDescending(x => x.UploadedAt).ToListAsync(cancellationToken);
    return Results.Ok(documents.Select(x => x.ToDto()));
});

api.MapPost("/documents/upload", [Authorize(Roles = "Admin,Employee")] async (
    ClaimsPrincipal claimsPrincipal,
    HttpRequest request,
    IWebHostEnvironment environment,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var form = await request.ReadFormAsync(cancellationToken);
    var file = form.Files["file"];
    var passIdText = form["passId"].ToString();
    if (file is null || !Guid.TryParse(passIdText, out var passId))
    {
        return Results.BadRequest("Некорректные данные файла.");
    }

    var pass = await dbContext.Passes.FindAsync([passId], cancellationToken);
    if (pass is null)
    {
        return Results.NotFound("Пропуск не найден.");
    }

    var uploadsPath = Path.Combine(environment.ContentRootPath, "uploads");
    Directory.CreateDirectory(uploadsPath);

    var storedName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
    var fullPath = Path.Combine(uploadsPath, storedName);
    await using (var stream = File.Create(fullPath))
    {
        await file.CopyToAsync(stream, cancellationToken);
    }

    var document = new PassDocument
    {
        Id = Guid.NewGuid(),
        PassId = pass.Id,
        FileName = file.FileName,
        StoredPath = $"uploads/{storedName}",
        UploadedAt = DateTimeOffset.UtcNow,
        UploadedByUserId = GetUserId(claimsPrincipal),
        FileSizeBytes = file.Length
    };

    dbContext.Documents.Add(document);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.Ok(document.ToDto());
}).DisableAntiforgery();

api.MapGet("/documents/{id:guid}/download", [Authorize(Roles = "Admin,Employee")] async (
    Guid id,
    ClaimsPrincipal claimsPrincipal,
    IWebHostEnvironment environment,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    var role = GetRole(claimsPrincipal);

    var document = await dbContext.Documents
        .Include(x => x.Pass)
        .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    if (document is null)
    {
        return Results.NotFound();
    }

    if (role == UserRole.Employee && document.Pass?.OwnerUserId != userId)
    {
        return Results.Forbid();
    }

    var uploadsRoot = DocumentFileHelper.GetUploadsRoot(environment);
    var fullPath = DocumentFileHelper.ResolveStoredFilePath(environment, document.StoredPath);

    if (!DocumentFileHelper.IsInsideUploads(uploadsRoot, fullPath) || !File.Exists(fullPath))
    {
        return Results.NotFound("Файл не найден.");
    }

    return Results.File(fullPath, "application/octet-stream", document.FileName);
});

api.MapDelete("/documents/{id:guid}", [Authorize(Roles = "Admin,Employee")] async (
    Guid id,
    ClaimsPrincipal claimsPrincipal,
    IWebHostEnvironment environment,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var userId = GetUserId(claimsPrincipal);
    var role = GetRole(claimsPrincipal);

    var document = await dbContext.Documents
        .Include(x => x.Pass)
        .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    if (document is null)
    {
        return Results.NotFound();
    }

    if (role == UserRole.Employee && document.Pass?.OwnerUserId != userId)
    {
        return Results.Forbid();
    }

    DocumentFileHelper.TryDeleteStoredFile(environment, document.StoredPath);
    dbContext.Documents.Remove(document);
    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
});

api.MapPost("/documents/cleanup", [Authorize(Roles = "Admin")] async (
    IWebHostEnvironment environment,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var result = await DocumentFileHelper.CleanupAsync(dbContext, environment, cancellationToken);
    return Results.Ok(result);
});

api.MapGet("/reports/summary", [Authorize(Roles = "Admin")] async (
    DateTimeOffset? from,
    DateTimeOffset? to,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var rangeStart = from ?? DateTimeOffset.UtcNow.Date;
    var rangeEnd = to ?? DateTimeOffset.UtcNow;

    var events = dbContext.AccessEvents.Where(x => x.Timestamp >= rangeStart && x.Timestamp <= rangeEnd);
    var totalEvents = await events.CountAsync(cancellationToken);
    var deniedEvents = await events.CountAsync(x => !x.Success, cancellationToken);
    await AccessLogic.RefreshPassStatusesAsync(dbContext, cancellationToken);
    var activePasses = await dbContext.Passes.CountAsync(x => x.Status == PassStatus.Active, cancellationToken);
    return Results.Ok(new ReportSummaryDto(totalEvents, deniedEvents, activePasses));
});

api.MapGet("/reports/events", [Authorize(Roles = "Admin")] async (
    DateTimeOffset? from,
    DateTimeOffset? to,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var rangeStart = from ?? DateTimeOffset.UtcNow.Date;
    var rangeEnd = to ?? DateTimeOffset.UtcNow;
    var events = await dbContext.AccessEvents
        .Where(x => x.Timestamp >= rangeStart && x.Timestamp <= rangeEnd)
        .OrderByDescending(x => x.Timestamp)
        .ToListAsync(cancellationToken);
    return Results.Ok(events.Select(x => x.ToDto()));
});

api.MapGet("/reports/export/csv", [Authorize(Roles = "Admin")] async (
    DateTimeOffset? from,
    DateTimeOffset? to,
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var rangeStart = from ?? DateTimeOffset.UtcNow.Date;
    var rangeEnd = to ?? DateTimeOffset.UtcNow;

    var events = await dbContext.AccessEvents
        .Include(x => x.Zone)
        .Include(x => x.OperatorUser)
        .Where(x => x.Timestamp >= rangeStart && x.Timestamp <= rangeEnd)
        .OrderByDescending(x => x.Timestamp)
        .ToListAsync(cancellationToken);

    var lines = new List<string> { "Дата;Госномер;Направление;Зона;Оператор;Результат" };
    lines.AddRange(events.Select(x =>
        $"{x.Timestamp:dd.MM.yyyy HH:mm:ss};{x.VehiclePlate};{(x.Direction == AccessDirection.Entry ? "Въезд" : "Выезд")};{x.Zone?.Name};{x.OperatorUser?.FullName};{(x.Success ? "Успешно" : x.Message)}"));

    return Results.File(Encoding.UTF8.GetBytes(string.Join(Environment.NewLine, lines)), "text/csv", "parking-report.csv");
});

app.MapHub<ParkingHub>("/hubs/parking");
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();

static Guid GetUserId(ClaimsPrincipal claimsPrincipal) =>
    Guid.Parse(claimsPrincipal.FindFirstValue(ClaimTypes.NameIdentifier)!);

static UserRole GetRole(ClaimsPrincipal claimsPrincipal) =>
    Enum.Parse<UserRole>(claimsPrincipal.FindFirstValue(ClaimTypes.Role)!);

static async Task<AccessResultDto> CreateFailedAccessResult(
    AppDbContext dbContext,
    IHubContext<ParkingHub> hubContext,
    string vehiclePlate,
    Guid userId,
    VehiclePass? pass,
    string message,
    CancellationToken cancellationToken,
    AccessDirection direction = AccessDirection.Entry)
{
    var zoneId = pass?.ZoneId ?? await dbContext.ParkingZones.Select(x => x.Id).FirstAsync(cancellationToken);
    var accessEvent = new AccessEvent
    {
        Id = Guid.NewGuid(),
        VehiclePlate = vehiclePlate,
        Direction = direction,
        Timestamp = DateTimeOffset.UtcNow,
        OperatorUserId = userId,
        ZoneId = zoneId,
        PassId = pass?.Id,
        Success = false,
        Message = message
    };

    dbContext.AccessEvents.Add(accessEvent);
    await dbContext.SaveChangesAsync(cancellationToken);
    await BroadcastLiveUpdates(dbContext, hubContext, accessEvent, cancellationToken);
    return new AccessResultDto(false, message, accessEvent.ToDto());
}

static async Task BroadcastLiveUpdates(
    AppDbContext dbContext,
    IHubContext<ParkingHub> hubContext,
    AccessEvent accessEvent,
    CancellationToken cancellationToken)
{
    var vehiclesInside = await AccessLogic.GetVehiclesInsideCountAsync(dbContext, cancellationToken);
    await hubContext.Clients.All.SendAsync("VehicleCountChanged", vehiclesInside, cancellationToken);
    await hubContext.Clients.All.SendAsync("AccessEvent", accessEvent.ToDto(), cancellationToken);
}
