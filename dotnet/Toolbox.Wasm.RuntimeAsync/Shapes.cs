namespace Toolbox.Wasm.Core.Async;

/// <summary>One of each async return type, read back through reflection - never called.</summary>
internal static class Shapes
{
    public static async Task SaveAsync() => await Task.Yield();

    public static async Task<int> CountAsync()
    {
        await Task.Yield();
        return 1;
    }

    public static async ValueTask FlushAsync() => await Task.Yield();

    public static async void OnClick()
    {
        await Task.Yield();
    }

    public static async IAsyncEnumerable<int> ReadAllAsync()
    {
        await Task.Yield();
        yield return 1;
    }
}
