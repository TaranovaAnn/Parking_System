using Microsoft.EntityFrameworkCore;
using ParkingSystem.Api.Domain;

namespace ParkingSystem.Api.Infrastructure;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            Username = "admin",
            FullName = "Иванов А.А.",
            Email = "admin@parking.local",
            Role = UserRole.Admin
        };
        admin.PasswordHash = PasswordHelper.HashPassword(admin, "admin123");

        var guard = new AppUser
        {
            Id = Guid.NewGuid(),
            Username = "guard",
            FullName = "Петров С.В.",
            Email = "guard@parking.local",
            Role = UserRole.Guard
        };
        guard.PasswordHash = PasswordHelper.HashPassword(guard, "guard123");

        var employee = new AppUser
        {
            Id = Guid.NewGuid(),
            Username = "employee",
            FullName = "Сидорова М.И.",
            Email = "employee@parking.local",
            Role = UserRole.Employee
        };
        employee.PasswordHash = PasswordHelper.HashPassword(employee, "employee123");

        var zoneA = new ParkingZone
        {
            Id = Guid.NewGuid(),
            Name = "Зона A — сотрудники",
            Capacity = 50,
            Description = "Основная парковка"
        };
        var zoneB = new ParkingZone
        {
            Id = Guid.NewGuid(),
            Name = "Зона B — гости",
            Capacity = 20,
            Description = "Гостевая парковка"
        };
        var zoneC = new ParkingZone
        {
            Id = Guid.NewGuid(),
            Name = "Зона C — служебная",
            Capacity = 10,
            Description = "Служебный транспорт"
        };

        var pass1 = new VehiclePass
        {
            Id = Guid.NewGuid(),
            VehiclePlate = "А123ВЕ777",
            Type = PassType.Permanent,
            Status = PassStatus.Active,
            ValidFrom = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero),
            ValidTo = new DateTimeOffset(2026, 12, 31, 23, 59, 59, TimeSpan.Zero),
            ZoneId = zoneA.Id,
            OwnerUserId = employee.Id,
            CreatedByUserId = admin.Id
        };

        var pass2 = new VehiclePass
        {
            Id = Guid.NewGuid(),
            VehiclePlate = "В456КМ199",
            Type = PassType.Guest,
            Status = PassStatus.Active,
            ValidFrom = DateTimeOffset.UtcNow.AddMinutes(-30),
            ValidTo = DateTimeOffset.UtcNow.AddHours(2),
            ZoneId = zoneB.Id,
            OwnerUserId = employee.Id,
            CreatedByUserId = employee.Id,
            Notes = "Гость — совещание"
        };

        var pass3 = new VehiclePass
        {
            Id = Guid.NewGuid(),
            VehiclePlate = "К999МН750",
            Type = PassType.Temporary,
            Status = PassStatus.Expired,
            ValidFrom = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
            ValidTo = new DateTimeOffset(2025, 6, 15, 23, 59, 59, TimeSpan.Zero),
            ZoneId = zoneA.Id,
            OwnerUserId = employee.Id,
            CreatedByUserId = admin.Id
        };

        var pass4 = new VehiclePass
        {
            Id = Guid.NewGuid(),
            VehiclePlate = "О111ОО777",
            Type = PassType.Guest,
            Status = PassStatus.Blocked,
            ValidFrom = new DateTimeOffset(2025, 5, 1, 0, 0, 0, TimeSpan.Zero),
            ValidTo = new DateTimeOffset(2026, 12, 31, 23, 59, 59, TimeSpan.Zero),
            ZoneId = zoneB.Id,
            OwnerUserId = employee.Id,
            CreatedByUserId = admin.Id,
            Notes = "Заблокирован администратором"
        };

        var entry1 = new AccessEvent
        {
            Id = Guid.NewGuid(),
            VehiclePlate = pass1.VehiclePlate,
            Direction = AccessDirection.Entry,
            Timestamp = DateTimeOffset.UtcNow.AddHours(-3),
            OperatorUserId = guard.Id,
            ZoneId = zoneA.Id,
            PassId = pass1.Id,
            Success = true
        };

        var entry2 = new AccessEvent
        {
            Id = Guid.NewGuid(),
            VehiclePlate = pass2.VehiclePlate,
            Direction = AccessDirection.Entry,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(-45),
            OperatorUserId = guard.Id,
            ZoneId = zoneB.Id,
            PassId = pass2.Id,
            Success = true
        };

        var failEntry = new AccessEvent
        {
            Id = Guid.NewGuid(),
            VehiclePlate = "Х000ХХ000",
            Direction = AccessDirection.Entry,
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(-20),
            OperatorUserId = guard.Id,
            ZoneId = zoneA.Id,
            Success = false,
            Message = "Пропуск не найден"
        };

        var document = new PassDocument
        {
            Id = Guid.NewGuid(),
            PassId = pass2.Id,
            FileName = "доверенность_гость.pdf",
            StoredPath = "seed/доверенность_гость.pdf",
            UploadedAt = DateTimeOffset.UtcNow.AddHours(-1),
            UploadedByUserId = employee.Id,
            FileSizeBytes = 245760
        };

        dbContext.Users.AddRange(admin, guard, employee);
        dbContext.ParkingZones.AddRange(zoneA, zoneB, zoneC);
        dbContext.Passes.AddRange(pass1, pass2, pass3, pass4);
        dbContext.AccessEvents.AddRange(entry1, entry2, failEntry);
        dbContext.Documents.Add(document);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
