using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Layout;

/// <summary>
/// Source-generated serialization. The reflection-based serializer is trim-unsafe,
/// and trimming is what keeps the WebAssembly payload down, so every type that
/// crosses the JavaScript boundary is registered here explicitly.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(LayoutRequest))]
[JsonSerializable(typeof(LayoutResult))]
public sealed partial class LayoutJsonContext : JsonSerializerContext;
