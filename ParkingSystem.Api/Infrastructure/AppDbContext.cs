using Microsoft.EntityFrameworkCore;
using ParkingSystem.Api.Domain;

namespace ParkingSystem.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<ParkingZone> ParkingZones => Set<ParkingZone>();
    public DbSet<VehiclePass> Passes => Set<VehiclePass>();
    public DbSet<AccessEvent> AccessEvents => Set<AccessEvent>();
    public DbSet<PassDocument> Documents => Set<PassDocument>();
    public DbSet<GuestPassRequest> GuestPassRequests => Set<GuestPassRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(x => x.Username).IsUnique();
            entity.Property(x => x.Username).HasMaxLength(64);
            entity.Property(x => x.FullName).HasMaxLength(128);
            entity.Property(x => x.Email).HasMaxLength(128);
        });

        modelBuilder.Entity<ParkingZone>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(128);
            entity.Property(x => x.Description).HasMaxLength(256);
        });

        modelBuilder.Entity<VehiclePass>(entity =>
        {
            entity.HasIndex(x => x.VehiclePlate);
            entity.Property(x => x.VehiclePlate).HasMaxLength(16);
            entity.Property(x => x.Notes).HasMaxLength(256);
            entity.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AccessEvent>(entity =>
        {
            entity.HasIndex(x => x.Timestamp);
            entity.Property(x => x.VehiclePlate).HasMaxLength(16);
            entity.Property(x => x.Message).HasMaxLength(256);
            entity.HasOne(x => x.OperatorUser).WithMany().HasForeignKey(x => x.OperatorUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Pass).WithMany().HasForeignKey(x => x.PassId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PassDocument>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(256);
            entity.Property(x => x.StoredPath).HasMaxLength(512);
            entity.HasOne(x => x.Pass).WithMany().HasForeignKey(x => x.PassId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.UploadedByUser).WithMany().HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GuestPassRequest>(entity =>
        {
            entity.HasIndex(x => x.CreatedAt);
            entity.HasIndex(x => x.Status);
            entity.Property(x => x.VehiclePlate).HasMaxLength(16);
            entity.Property(x => x.GuestFullName).HasMaxLength(128);
            entity.Property(x => x.Notes).HasMaxLength(256);
            entity.Property(x => x.ReviewComment).HasMaxLength(256);
            entity.HasOne(x => x.Zone).WithMany().HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.RequestedByUser).WithMany().HasForeignKey(x => x.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReviewedByUser).WithMany().HasForeignKey(x => x.ReviewedByUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.CreatedPass).WithMany().HasForeignKey(x => x.CreatedPassId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
