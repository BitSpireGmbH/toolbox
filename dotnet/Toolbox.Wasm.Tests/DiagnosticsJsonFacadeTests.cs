using System.Text.Json;
using Toolbox.Wasm.Core.Diagnostics;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// Pins the wire format the browser depends on. The TypeScript interfaces are written by
/// hand against these shapes, so a rename here without one there fails at the call rather
/// than at build time - these tests are what make that a test failure instead.
/// </summary>
public class DiagnosticsJsonFacadeTests
{
    private static JsonElement Measure(string requestJson) =>
        JsonDocument.Parse(DiagnosticsJsonFacade.MeasureSlice(requestJson)).RootElement;

    [Fact]
    public void Result_UsesCamelCaseFieldNames()
    {
        var json = Measure("""{"input":"hello world","start":0,"length":5,"iterations":50}""");

        Assert.True(json.TryGetProperty("samples", out var samples));
        Assert.True(json.TryGetProperty("iterations", out _));
        Assert.True(json.TryGetProperty("runtimeNote", out _));
        Assert.True(samples[0].TryGetProperty("bytesPerOperation", out _));
        Assert.True(samples[0].TryGetProperty("totalBytes", out _));
    }

    [Fact]
    public void Error_IsOmittedOnSuccess()
    {
        // JsonIgnoreCondition.WhenWritingNull - the TypeScript side declares it optional,
        // so it must genuinely be absent rather than present-and-null.
        var json = Measure("""{"input":"hello","start":0,"length":2,"iterations":50}""");

        Assert.False(json.TryGetProperty("error", out _));
    }

    [Fact]
    public void OutOfRangeSlice_ReportsErrorAcrossTheWire()
    {
        var json = Measure("""{"input":"hi","start":0,"length":99,"iterations":50}""");

        Assert.True(json.TryGetProperty("error", out var error));
        Assert.False(string.IsNullOrWhiteSpace(error.GetString()));
    }

    [Fact]
    public void MalformedRequestJson_ReportsAResultRatherThanThrowing()
    {
        // Falls back to an empty request, which measures an empty slice rather than
        // throwing across the interop boundary.
        var json = Measure("{ not json at all");

        Assert.True(json.TryGetProperty("samples", out _));
    }

    [Fact]
    public void SpanSlice_ReportsZeroAcrossTheWire()
    {
        // The end-to-end version of the headline claim: it has to survive serialization,
        // not just be true in memory.
        var json = Measure("""{"input":"hello world","start":2,"length":4,"iterations":200}""");

        var spanSlice = json.GetProperty("samples")
            .EnumerateArray()
            .Single(s => s.GetProperty("id").GetString() == "span-slice");

        Assert.Equal(0, spanSlice.GetProperty("bytesPerOperation").GetInt64());
    }
}
