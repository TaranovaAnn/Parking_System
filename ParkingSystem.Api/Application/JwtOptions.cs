namespace ParkingSystem.Api.Application;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "ParkingSystem.Api";
    public string Audience { get; set; } = "ParkingSystem.Web";
    public string Key { get; set; } = "super-secret-development-key-change-me-123456";
    public int ExpirationMinutes { get; set; } = 480;
}
