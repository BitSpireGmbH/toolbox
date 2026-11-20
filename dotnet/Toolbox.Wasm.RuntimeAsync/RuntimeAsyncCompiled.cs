using System.Diagnostics.CodeAnalysis;

namespace Toolbox.Wasm.Core.Async;

public static class RuntimeAsyncCompiled
{
    [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicMethods)]
    public static Type Shapes => typeof(Shapes);

    public static Task<string> CaptureStackAsync() => StackProbe.OuterAsync();
}
