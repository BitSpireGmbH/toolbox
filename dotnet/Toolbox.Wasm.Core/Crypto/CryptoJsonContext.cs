using System.Text.Json.Serialization;

namespace Toolbox.Wasm.Core.Crypto;

/// <summary>
/// Source-generated serialization. The reflection-based serializer is trim-unsafe, and
/// trimming is what keeps the WebAssembly payload down, so every type that crosses the
/// JavaScript boundary is registered here explicitly.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(JwtVerifyRequest))]
[JsonSerializable(typeof(JwtVerifyResult))]
public sealed partial class CryptoJsonContext : JsonSerializerContext;
