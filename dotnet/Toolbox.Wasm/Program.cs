namespace Toolbox.Wasm;

/// <summary>
/// The WebAssembly SDK requires an executable entry point, but this one is never
/// invoked: the loader calls <c>dotnet.create()</c> and <c>getAssemblyExports()</c>
/// without <c>runMain()</c>, because the browser only ever needs the
/// <c>[JSExport]</c> surface in <see cref="RegexInterop"/>.
/// </summary>
internal static class Program
{
    internal static void Main()
    {
    }
}
