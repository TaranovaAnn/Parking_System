using Microsoft.EntityFrameworkCore;
using ParkingSystem.Api.Infrastructure;

namespace ParkingSystem.Api.Application;

public sealed record DocumentCleanupResultDto(
    int OrphanedFilesDeleted,
    int MissingFileRecordsDeleted,
    long BytesFreed);

public static class DocumentFileHelper
{
    public static string GetUploadsRoot(IWebHostEnvironment environment) =>
        Path.GetFullPath(Path.Combine(environment.ContentRootPath, "uploads"));

    public static string ResolveStoredFilePath(IWebHostEnvironment environment, string storedPath) =>
        Path.GetFullPath(Path.Combine(environment.ContentRootPath, storedPath));

    public static bool IsInsideUploads(string uploadsRoot, string fullPath)
    {
        var relativePath = Path.GetRelativePath(uploadsRoot, fullPath);
        return !relativePath.StartsWith("..", StringComparison.Ordinal) && !Path.IsPathRooted(relativePath);
    }

    public static void TryDeleteStoredFile(IWebHostEnvironment environment, string storedPath)
    {
        var uploadsRoot = GetUploadsRoot(environment);
        var fullPath = ResolveStoredFilePath(environment, storedPath);
        if (IsInsideUploads(uploadsRoot, fullPath) && File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    public static async Task<DocumentCleanupResultDto> CleanupAsync(
        AppDbContext dbContext,
        IWebHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        var uploadsRoot = GetUploadsRoot(environment);
        Directory.CreateDirectory(uploadsRoot);

        var documents = await dbContext.Documents.ToListAsync(cancellationToken);
        var referencedFileNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var document in documents)
        {
            var fullPath = ResolveStoredFilePath(environment, document.StoredPath);
            if (IsInsideUploads(uploadsRoot, fullPath) && File.Exists(fullPath))
            {
                referencedFileNames.Add(Path.GetFileName(fullPath));
            }
        }

        long bytesFreed = 0;
        var orphanedFilesDeleted = 0;

        foreach (var filePath in Directory.EnumerateFiles(uploadsRoot))
        {
            var fileName = Path.GetFileName(filePath);
            if (referencedFileNames.Contains(fileName))
            {
                continue;
            }

            bytesFreed += new FileInfo(filePath).Length;
            File.Delete(filePath);
            orphanedFilesDeleted++;
        }

        var missingFileRecordsDeleted = 0;
        foreach (var document in documents)
        {
            var fullPath = ResolveStoredFilePath(environment, document.StoredPath);
            if (IsInsideUploads(uploadsRoot, fullPath) && File.Exists(fullPath))
            {
                continue;
            }

            dbContext.Documents.Remove(document);
            missingFileRecordsDeleted++;
        }

        if (missingFileRecordsDeleted > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new DocumentCleanupResultDto(orphanedFilesDeleted, missingFileRecordsDeleted, bytesFreed);
    }
}
