using System.Text.Json;
using Toolbox.Wasm.Core.Collections;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// The wire format the browser actually depends on. `ListBenchmarkService` in TypeScript
/// declares these property names by hand, and a rename on this side would not break the build
/// on that side - it would silently deliver undefined into the benchmark cards. These pin the
/// contract where it can fail loudly instead.
/// </summary>
public class CollectionsJsonFacadeTests
{
    private static JsonElement Run(string requestJson) =>
        JsonDocument.Parse(CollectionsJsonFacade.RunListBenchmark(requestJson)).RootElement;

    private static string Request(int adds, int capacity, int rounds = 1) =>
        $$"""{"adds":{{adds}},"capacity":{{capacity}},"rounds":{{rounds}}}""";

    [Fact]
    public void Emits_camel_case_property_names()
    {
        var root = Run(Request(adds: 100, capacity: 100));

        Assert.True(root.TryGetProperty("runs", out var runs));
        Assert.True(root.TryGetProperty("adds", out _));
        Assert.True(root.TryGetProperty("capacity", out _));
        Assert.True(root.TryGetProperty("rounds", out _));
        Assert.True(root.TryGetProperty("runtimeNote", out _));

        var first = runs[0];
        foreach (var property in new[]
                 {
                     "id",
                     "label",
                     "code",
                     "bestElapsedMs",
                     "medianElapsedMs",
                     "allocatedBytes",
                     "resizeCount",
                     "finalCapacity",
                     "growth",
                 })
        {
            Assert.True(first.TryGetProperty(property, out _), $"Missing '{property}'.");
        }
    }

    [Fact]
    public void Emits_camel_case_growth_steps()
    {
        var growth = Run(Request(adds: 100, capacity: 0))
            .GetProperty("runs")[0]
            .GetProperty("growth")[0];

        Assert.True(growth.TryGetProperty("atCount", out _));
        Assert.True(growth.TryGetProperty("fromCapacity", out _));
        Assert.True(growth.TryGetProperty("toCapacity", out _));
    }

    [Fact]
    public void Omits_the_error_property_when_there_is_nothing_wrong()
    {
        // The TypeScript side treats `error` as optional and branches on its presence, so
        // emitting an explicit null would read as a failure.
        Assert.False(Run(Request(adds: 100, capacity: 100)).TryGetProperty("error", out _));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json")]
    [InlineData("{\"adds\":")]
    public void A_malformed_payload_runs_the_defaults_rather_than_throwing(string requestJson)
    {
        // A JsonException escaping here would surface in the browser as an opaque interop
        // failure rather than as anything the page could render.
        var root = Run(requestJson);

        Assert.Equal(2, root.GetProperty("runs").GetArrayLength());
        Assert.True(root.GetProperty("adds").GetInt32() > 0);
    }

    [Fact]
    public void Reports_the_counts_it_actually_ran()
    {
        var root = Run(Request(adds: 512, capacity: 256));

        Assert.Equal(512, root.GetProperty("adds").GetInt32());
        Assert.Equal(256, root.GetProperty("capacity").GetInt32());
    }
}
