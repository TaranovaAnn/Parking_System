using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ParkingSystem.Api.Realtime;

[Authorize]
public sealed class ParkingHub : Hub
{
}
