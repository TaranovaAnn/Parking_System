using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGuestPassRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GuestPassRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VehiclePlate = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ZoneId = table.Column<Guid>(type: "uuid", nullable: false),
                    DurationHours = table.Column<int>(type: "integer", nullable: false),
                    GuestFullName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Notes = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReviewComment = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedPassId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestPassRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuestPassRequests_ParkingZones_ZoneId",
                        column: x => x.ZoneId,
                        principalTable: "ParkingZones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GuestPassRequests_Passes_CreatedPassId",
                        column: x => x.CreatedPassId,
                        principalTable: "Passes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_GuestPassRequests_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GuestPassRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_CreatedAt",
                table: "GuestPassRequests",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_CreatedPassId",
                table: "GuestPassRequests",
                column: "CreatedPassId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_RequestedByUserId",
                table: "GuestPassRequests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_ReviewedByUserId",
                table: "GuestPassRequests",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_Status",
                table: "GuestPassRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPassRequests_ZoneId",
                table: "GuestPassRequests",
                column: "ZoneId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GuestPassRequests");
        }
    }
}
