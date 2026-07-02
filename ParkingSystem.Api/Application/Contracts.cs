using ParkingSystem.Api.Domain;

namespace ParkingSystem.Api.Application;

public sealed record LoginRequest(string Username, string Password);
public sealed record ApiErrorResponse(string Message);
public sealed record AuthResponse(string Token, UserDto User);
public sealed record UserDto(Guid Id, string Username, string FullName, UserRole Role, string Email);
public sealed record CreateUserRequest(string Username, string FullName, string Email, UserRole Role, string Password);
public sealed record DashboardSummaryDto(int VehiclesInside, int FreeSpots, int TotalCapacity, int TodayEvents);
public sealed record ZoneDto(Guid Id, string Name, int Capacity, string? Description, int Occupied, int Free, int Percent);
public sealed record UpdateZoneRequest(string Name, int Capacity, string? Description);
public sealed record PassDto(
    Guid Id,
    string VehiclePlate,
    PassType Type,
    PassStatus Status,
    DateTimeOffset ValidFrom,
    DateTimeOffset ValidTo,
    Guid? ZoneId,
    Guid OwnerUserId,
    Guid CreatedByUserId,
    string? Notes);
public sealed record CreateGuestPassRequest(string VehiclePlate, Guid ZoneId, int DurationHours, string? Notes);
public sealed record CreatePermanentPassRequest(string VehiclePlate, Guid ZoneId, Guid OwnerUserId, DateTimeOffset ValidTo, string? Notes);
public sealed record GuestPassRequestDto(
    Guid Id,
    string VehiclePlate,
    Guid ZoneId,
    int DurationHours,
    string? GuestFullName,
    string? Notes,
    GuestRequestStatus Status,
    DateTimeOffset CreatedAt,
    Guid RequestedByUserId,
    Guid? ReviewedByUserId,
    DateTimeOffset? ReviewedAt,
    string? ReviewComment,
    Guid? CreatedPassId);
public sealed record CreateGuestPassRequestSubmission(string VehiclePlate, Guid ZoneId, int DurationHours, string? GuestFullName, string? Notes);
public sealed record ReviewGuestPassRequest(string? ReviewComment);
public sealed record AccessEventDto(
    Guid Id,
    string VehiclePlate,
    AccessDirection Direction,
    DateTimeOffset Timestamp,
    Guid OperatorUserId,
    Guid ZoneId,
    Guid? PassId,
    bool Success,
    string? Message);
public sealed record AccessCommand(string VehiclePlate);
public sealed record ValidatePassResponse(bool Found, PassDto? Pass, string? Error);
public sealed record AccessResultDto(bool Success, string Message, AccessEventDto Event);
public sealed record DocumentDto(
    Guid Id,
    Guid PassId,
    string FileName,
    string StoredPath,
    DateTimeOffset UploadedAt,
    Guid UploadedByUserId,
    long FileSizeBytes);
public sealed record ReportSummaryDto(int TotalEvents, int DeniedEvents, int ActivePasses);

public static class MappingExtensions
{
    public static UserDto ToDto(this AppUser user) =>
        new(user.Id, user.Username, user.FullName, user.Role, user.Email);

    public static PassDto ToDto(this VehiclePass pass) =>
        new(
            pass.Id,
            pass.VehiclePlate,
            pass.Type,
            pass.Status,
            pass.ValidFrom,
            pass.ValidTo,
            pass.ZoneId,
            pass.OwnerUserId,
            pass.CreatedByUserId,
            pass.Notes);

    public static AccessEventDto ToDto(this AccessEvent accessEvent) =>
        new(
            accessEvent.Id,
            accessEvent.VehiclePlate,
            accessEvent.Direction,
            accessEvent.Timestamp,
            accessEvent.OperatorUserId,
            accessEvent.ZoneId,
            accessEvent.PassId,
            accessEvent.Success,
            accessEvent.Message);

    public static DocumentDto ToDto(this PassDocument document) =>
        new(
            document.Id,
            document.PassId,
            document.FileName,
            document.StoredPath,
            document.UploadedAt,
            document.UploadedByUserId,
            document.FileSizeBytes);

    public static GuestPassRequestDto ToDto(this GuestPassRequest request) =>
        new(
            request.Id,
            request.VehiclePlate,
            request.ZoneId,
            request.DurationHours,
            request.GuestFullName,
            request.Notes,
            request.Status,
            request.CreatedAt,
            request.RequestedByUserId,
            request.ReviewedByUserId,
            request.ReviewedAt,
            request.ReviewComment,
            request.CreatedPassId);
}
