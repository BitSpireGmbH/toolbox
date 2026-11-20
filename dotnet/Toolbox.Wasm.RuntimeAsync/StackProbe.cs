using System.Diagnostics;

namespace Toolbox.Wasm.Core.Async;

internal static class StackProbe
{
    public static async Task<string> OuterAsync() => await MiddleAsync();

    private static async Task<string> MiddleAsync() => await InnerAsync();

    private static async Task<string> InnerAsync()
    {
        await Task.CompletedTask;
        return new StackTrace().ToString();
    }

    public static string ThrowingStackTrace()
    {
        try
        {
            ThrowOuterAsync().GetAwaiter().GetResult();
            return string.Empty;
        }
        catch (InvalidOperationException exception)
        {
            return exception.StackTrace ?? string.Empty;
        }
    }

    private static async Task ThrowOuterAsync() => await ThrowInnerAsync();

    private static async Task ThrowInnerAsync()
    {
        await Task.CompletedTask;
        throw new InvalidOperationException("thrown two awaits deep");
    }
}
