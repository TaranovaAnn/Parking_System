using Microsoft.AspNetCore.Identity;

namespace ParkingSystem.Api.Domain;

public enum UserRole
{
    Admin = 1,
    Guard = 2,
    Employee = 3
}

public enum PassType
{
    Permanent = 1,
    Temporary = 2,
    Guest = 3
}

public enum PassStatus
{
    Draft = 1,
    Active = 2,
    Expired = 3,
    Blocked = 4
}

public enum AccessDirection
{
    Entry = 1,
    Exit = 2
}

public enum GuestRequestStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public sealed class AppUser
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
}

public sealed class ParkingZone
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string? Description { get; set; }
}

public sealed class VehiclePass
{
    public Guid Id { get; set; }
    public string VehiclePlate { get; set; } = string.Empty;
    public PassType Type { get; set; }
    public PassStatus Status { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset ValidTo { get; set; }
    public Guid? ZoneId { get; set; }
    public ParkingZone? Zone { get; set; }
    public Guid OwnerUserId { get; set; }
    public AppUser? OwnerUser { get; set; }
    public Guid CreatedByUserId { get; set; }
    public AppUser? CreatedByUser { get; set; }
    public string? Notes { get; set; }
}

public sealed class AccessEvent
{
    public Guid Id { get; set; }
    public string VehiclePlate { get; set; } = string.Empty;
    public AccessDirection Direction { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public Guid OperatorUserId { get; set; }
    public AppUser? OperatorUser { get; set; }
    public Guid ZoneId { get; set; }
    public ParkingZone? Zone { get; set; }
    public Guid? PassId { get; set; }
    public VehiclePass? Pass { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
}

public sealed class PassDocument
{
    public Guid Id { get; set; }
    public Guid PassId { get; set; }
    public VehiclePass? Pass { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public DateTimeOffset UploadedAt { get; set; }
    public Guid UploadedByUserId { get; set; }
    public AppUser? UploadedByUser { get; set; }
    public long FileSizeBytes { get; set; }
}

public sealed class GuestPassRequest
{
    public Guid Id { get; set; }
    public string VehiclePlate { get; set; } = string.Empty;
    public Guid ZoneId { get; set; }
    public ParkingZone? Zone { get; set; }
    public int DurationHours { get; set; }
    public string? GuestFullName { get; set; }
    public string? Notes { get; set; }
    public GuestRequestStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid RequestedByUserId { get; set; }
    public AppUser? RequestedByUser { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public AppUser? ReviewedByUser { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewComment { get; set; }
    public Guid? CreatedPassId { get; set; }
    public VehiclePass? CreatedPass { get; set; }
}

public static class PasswordHelper
{
    private static readonly PasswordHasher<AppUser> Hasher = new();

    public static string HashPassword(AppUser user, string password) => Hasher.HashPassword(user, password);

    public static bool Verify(AppUser user, string password)
    {
        var result = Hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
