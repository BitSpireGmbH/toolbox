using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Serialization;

/// <summary>
/// Source-generated serialization. The reflection-based serializer is trim-unsafe,
/// and trimming is what keeps the WebAssembly payload down, so every type that
/// crosses the JavaScript boundary is registered here explicitly.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(NamingRequest))]
[JsonSerializable(typeof(NamingResult))]
[JsonSerializable(typeof(IReadOnlyList<NamingPolicyInfo>))]
[JsonSerializable(typeof(RoundTripOptions))]
[JsonSerializable(typeof(RoundTripResult))]
public sealed partial class SerializationJsonContext : JsonSerializerContext;
