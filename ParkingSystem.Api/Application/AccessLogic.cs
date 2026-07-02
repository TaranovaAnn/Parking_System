using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Api.Domain;
using ParkingSystem.Api.Infrastructure;

namespace ParkingSystem.Api.Application;

public static class AccessLogic
{
    public const string PlateFormatErrorMessage = "Некорректный формат госномера. Пример: А111АА111";

    private static readonly Regex PlateRegex = new(
        @"^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$",
        RegexOptions.CultureInvariant);

    private static readonly Dictionary<char, char> LatinToCyrillic = new()
    {
        ['A'] = 'А',
        ['B'] = 'В',
        ['E'] = 'Е',
        ['K'] = 'К',
        ['M'] = 'М',
        ['H'] = 'Н',
        ['O'] = 'О',
        ['P'] = 'Р',
        ['C'] = 'С',
        ['T'] = 'Т',
        ['Y'] = 'У',
        ['X'] = 'Х',
    };

    public static string NormalizePlate(string plate)
    {
        var builder = new StringBuilder(plate.Length);
        foreach (var ch in plate.Trim().ToUpperInvariant())
        {
            if (ch is ' ' or '-' or '\t')
            {
                continue;
            }

            builder.Append(LatinToCyrillic.TryGetValue(ch, out var cyrillic) ? cyrillic : ch);
        }

        return builder.ToString();
    }

    public static bool IsValidPlate(string plate) => PlateRegex.IsMatch(NormalizePlate(plate));

    public static bool TryGetNormalizedPlate(string plate, out string normalized)
    {
        normalized = NormalizePlate(plate);
        return PlateRegex.IsMatch(normalized);
    }

    public static PassStatus ResolveStatus(VehiclePass pass, DateTimeOffset now)
    {
        if (pass.Status == PassStatus.Blocked || pass.Status == PassStatus.Draft)
        {
            return pass.Status;
        }

        if (now < pass.ValidFrom)
        {
            return PassStatus.Draft;
        }

        if (now > pass.ValidTo)
        {
            return PassStatus.Expired;
        }

        return PassStatus.Active;
    }

    public static async Task RefreshPassStatusesAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var passes = await dbContext.Passes.ToListAsync(cancellationToken);
        var changed = false;

        foreach (var pass in passes)
        {
            var resolved = ResolveStatus(pass, now);
            if (resolved != pass.Status)
            {
                pass.Status = resolved;
                changed = true;
            }
        }

        if (changed)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public static async Task<bool> IsVehicleInsideAsync(AppDbContext dbContext, string vehiclePlate, CancellationToken cancellationToken)
    {
        var normalized = NormalizePlate(vehiclePlate);

        var lastEvent = await dbContext.AccessEvents
            .Where(x => x.VehiclePlate == normalized && x.Success)
            .OrderByDescending(x => x.Timestamp)
            .FirstOrDefaultAsync(cancellationToken);

        return lastEvent?.Direction == AccessDirection.Entry;
    }

    public static async Task<int> GetVehiclesInsideCountAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var successfulEvents = await dbContext.AccessEvents
            .Where(x => x.Success)
            .OrderBy(x => x.Timestamp)
            .Select(x => new { x.VehiclePlate, x.Direction })
            .ToListAsync(cancellationToken);

        var inside = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in successfulEvents)
        {
            if (item.Direction == AccessDirection.Entry)
            {
                inside.Add(item.VehiclePlate);
            }
            else
            {
                inside.Remove(item.VehiclePlate);
            }
        }

        return inside.Count;
    }

    public static async Task<int> GetZoneOccupiedCountAsync(AppDbContext dbContext, Guid zoneId, CancellationToken cancellationToken)
    {
        var events = await dbContext.AccessEvents
            .Where(x => x.Success && x.ZoneId == zoneId)
            .OrderBy(x => x.Timestamp)
            .Select(x => new { x.VehiclePlate, x.Direction })
            .ToListAsync(cancellationToken);

        var inside = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in events)
        {
            if (item.Direction == AccessDirection.Entry)
            {
                inside.Add(item.VehiclePlate);
            }
            else
            {
                inside.Remove(item.VehiclePlate);
            }
        }

        return inside.Count;
    }
}
