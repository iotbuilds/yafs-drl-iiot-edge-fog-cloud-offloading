using System.Text.Json;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Dashboard", policy => policy
        .AllowAnyHeader()
        .AllowAnyMethod()
        .SetIsOriginAllowed(origin =>
            origin.StartsWith("http://127.0.0.1") || origin.StartsWith("http://localhost")));
});


var app = builder.Build();

app.UseCors("Dashboard");
app.MapGet("/openapi/v1.json", () => Results.Json(BuildOpenApiDocument()));
app.MapGet("/swagger", () => Results.Content(BuildSwaggerPage(), "text/html"));

var dataRoot = ResolveDataRoot(app.Configuration);
var dashboardExports = Dir(dataRoot, "dashboard_exports");
var graphs = Dir(dataRoot, "graphs");
var localCloudStorage = Dir(dataRoot, "local_cloud_storage");
var localLatest = Dir(localCloudStorage, "latest");
var localExports = Dir(localCloudStorage, "exports");

app.MapGet("/", () => Results.Json(new
{
    status = "ok",
    model = "DQN",
    docs = "/swagger",
    dataRoot = dataRoot.FullName,
    confirmed = "700 sensors, 220 edge, 79 fog, 1 cloud; 7S; 3L; 7F; 10P; 10B"
}));

app.MapGet("/api/health", () => Results.Json(new
{
    status = dashboardExports.Exists ? "ok" : "missing-data",
    model = "DQN",
    dataRoot = dataRoot.FullName,
    dashboardExports = dashboardExports.Exists,
    results = Dir(dataRoot, "results").Exists,
    topology = Dir(dataRoot, "topology").Exists,
    localCloudLatest = localLatest.Exists
}));

MapJson(app, "/api/kpis", JsonFile(dashboardExports, "kpis.json"));
MapJson(app, "/api/topology", JsonFile(dashboardExports, "topology.json"));
MapJson(app, "/api/status-metrics", JsonFile(dashboardExports, "status_metrics.json"));
MapJson(app, "/api/comparison", JsonFile(dashboardExports, "comparison.json"));
MapJson(app, "/api/paths", JsonFile(dashboardExports, "paths.json"));
MapJson(app, "/api/summary", JsonFile(dashboardExports, "baseline_validation_summary.json"));
MapJson(app, "/api/scenarios", JsonFile(dashboardExports, "scenario_validation.json"));
MapJson(app, "/api/scalability", JsonFile(dashboardExports, "scalability_validation.json"));
MapJson(app, "/api/drl-efficiency", JsonFile(dashboardExports, "drl_efficiency.json"));
MapJson(app, "/api/final-demo-readiness", JsonFile(dashboardExports, "final_demo_readiness.json"));
MapJson(app, "/api/requirements-validation", JsonFile(dashboardExports, "requirements_validation.json"));
MapJson(app, "/api/shift-report", JsonFile(dashboardExports, "shift_report.json"));
MapJson(app, "/api/report", JsonFile(dashboardExports, "shift_report.json"));
MapJson(app, "/api/cloud-latest", JsonFile(localLatest, "latest.json"));

MapList(app, "/api/events", JsonFile(dashboardExports, "events.json"));
MapList(app, "/api/decisions", JsonFile(dashboardExports, "offloading_decisions.json"));
MapList(app, "/api/nodes", JsonFile(dashboardExports, "nodes.json"));
MapList(app, "/api/cloud-records", JsonFile(dashboardExports, "cloud_records.json"));
MapList(app, "/api/status-trace", JsonFile(dashboardExports, "status_condition_trace.json"));

app.MapGet("/api/exports", () =>
{
    var items = localExports.Exists
        ? localExports.GetFiles("*.json").OrderByDescending(file => file.LastWriteTimeUtc).Select(file => new
        {
            name = file.Name,
            sizeBytes = file.Length,
            updatedUtc = file.LastWriteTimeUtc
        })
        : [];
    return Results.Json(new { count = items.Count(), items });
});

app.MapGet("/api/graphs", () =>
{
    var items = graphs.Exists
        ? graphs.GetFiles("*.png").OrderBy(file => file.Name).Select(file => new
        {
            name = file.Name,
            url = $"/api/graphs/{file.Name}",
            sizeBytes = file.Length
        })
        : [];
    return Results.Json(new { count = items.Count(), items });
});

app.MapGet("/api/graphs/{filename}", (string filename) =>
{
    var safeName = Path.GetFileName(filename);
    var file = JsonFile(graphs, safeName);
    if (!file.Exists) return Results.NotFound(new { status = "missing", filename = safeName });

    var provider = new FileExtensionContentTypeProvider();
    if (!provider.TryGetContentType(file.FullName, out var contentType)) contentType = "application/octet-stream";
    return Results.File(file.FullName, contentType);
});

app.Run("http://127.0.0.1:8002");

static DirectoryInfo Dir(DirectoryInfo parent, string child) => new(Path.Combine(parent.FullName, child));

static FileInfo JsonFile(DirectoryInfo parent, string child) => new(Path.Combine(parent.FullName, child));

static DirectoryInfo ResolveDataRoot(IConfiguration configuration)
{
    var configured = Environment.GetEnvironmentVariable("YAFS_DATA_ROOT")
        ?? configuration["Yafs:DataRoot"]
        ?? "../../DRL";

    var path = Path.IsPathRooted(configured)
        ? configured
        : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), configured));

    return new DirectoryInfo(path);
}

static void MapJson(WebApplication app, string route, FileInfo file)
{
    app.MapGet(route, () => ReadJson(file));
}

static void MapList(WebApplication app, string route, FileInfo file)
{
    app.MapGet(route, (int? limit) =>
    {
        if (!file.Exists) return Results.Json(new { status = "missing", path = file.FullName, count = 0, items = Array.Empty<object>() });

        using var doc = JsonDocument.Parse(File.ReadAllText(file.FullName));
        if (doc.RootElement.ValueKind != JsonValueKind.Array) return Results.Json(doc.RootElement.Clone());

        var max = Math.Max(0, limit ?? 500);
        var items = doc.RootElement.EnumerateArray().Take(max).Select(item => item.Clone()).ToArray();
        return Results.Json(new { count = doc.RootElement.GetArrayLength(), items });
    });
}

static IResult ReadJson(FileInfo file)
{
    if (!file.Exists) return Results.Json(new { status = "missing", path = file.FullName });
    return Results.Text(File.ReadAllText(file.FullName), "application/json");
}

static object BuildOpenApiDocument()
{
    string[] routes =
    [
        "/api/health", "/api/kpis", "/api/events", "/api/decisions", "/api/nodes",
        "/api/topology", "/api/status-metrics", "/api/comparison", "/api/paths",
        "/api/summary", "/api/scenarios", "/api/scalability", "/api/drl-efficiency",
        "/api/final-demo-readiness", "/api/requirements-validation", "/api/shift-report",
        "/api/report", "/api/cloud-records", "/api/status-trace", "/api/exports",
        "/api/graphs", "/api/graphs/{filename}"
    ];

    return new
    {
        openapi = "3.0.1",
        info = new { title = "YAFS IIoT DQN Dashboard and Cloud API", version = "1.0.0" },
        paths = routes.ToDictionary(route => route, route => new
        {
            get = new
            {
                summary = $"Read {route}",
                responses = new Dictionary<string, object>
                {
                    ["200"] = new { description = "OK" },
                    ["404"] = new { description = "Missing file" }
                }
            }
        })
    };
}

static string BuildSwaggerPage() =>
    """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>YAFS IIoT DQN API</title>
        <style>body{font-family:system-ui;margin:2rem;background:#0f1024;color:#f8fafc}a{color:#60a5fa}code{background:#1f2142;padding:.15rem .35rem;border-radius:.3rem}li{margin:.35rem 0}</style>
      </head>
      <body>
        <h1>YAFS IIoT DQN Dashboard and Cloud API</h1>
        <p>OpenAPI JSON: <a href="/openapi/v1.json">/openapi/v1.json</a></p>
        <h2>Common endpoints</h2>
        <ul>
          <li><a href="/api/health">/api/health</a></li>
          <li><a href="/api/kpis">/api/kpis</a></li>
          <li><a href="/api/events">/api/events</a></li>
          <li><a href="/api/decisions">/api/decisions</a></li>
          <li><a href="/api/nodes">/api/nodes</a></li>
          <li><a href="/api/graphs">/api/graphs</a></li>
        </ul>
      </body>
    </html>
    """;
