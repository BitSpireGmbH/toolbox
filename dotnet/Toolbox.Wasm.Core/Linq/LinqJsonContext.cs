using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Linq;

/// <summary>
/// Source-generated serialization. The reflection-based serializer is trim-unsafe, and
/// trimming is what keeps the WebAssembly payload down, so every type that crosses the
/// JavaScript boundary is registered here explicitly.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(LinqPipelineSpec))]
[JsonSerializable(typeof(LinqRunResult))]
[JsonSerializable(typeof(LinqCatalog))]
public sealed partial class LinqJsonContext : JsonSerializerContext;
