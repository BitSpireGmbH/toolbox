using System.Globalization;
using Toolbox.Wasm.Core.Regex;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// Pins exactly which Regex Tester behaviour depends on ICU being shipped.
///
/// Toolbox.Wasm.csproj carries ICU (~141KB brotli of the EFIGS shard, and the
/// runtime picks one shard per browser culture) on the stated grounds that the
/// tester exposes RegexOptions.CultureInvariant as a toggle. ICU is the single
/// largest line item we control, so the claim is worth holding to evidence
/// rather than repeating.
///
/// Run these under both modes to see the difference:
///   dotnet test dotnet/Toolbox.Wasm.Tests
///   DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 dotnet test dotnet/Toolbox.Wasm.Tests
///
/// The tests that keep passing in invariant mode are behaviour ICU does *not*
/// buy us. Only the ones that flip are paying for the download.
/// </summary>
public class GlobalizationDependencyTests
{
    private static RegexOptionsModel IgnoreCase(bool cultureInvariant = false) =>
        new() { IgnoreCase = true, CultureInvariant = cultureInvariant };

    /// <summary>
    /// True when the runtime has no ICU data. Probed by behaviour rather than by
    /// AppContext, because the switch only reads back when invariant mode was set
    /// through runtimeconfig - setting DOTNET_SYSTEM_GLOBALIZATION_INVARIANT in the
    /// environment, which is how these tests are run both ways, leaves it unset.
    /// </summary>
    private static readonly bool IsInvariantMode = ProbeInvariantMode();

    private static bool ProbeInvariantMode()
    {
        try
        {
            CultureInfo.GetCultureInfo("tr-TR");
            return false;
        }
        catch (CultureNotFoundException)
        {
            return true;
        }
    }

    // --- case-insensitive matching outside ASCII -----------------------------
    // The csproj's open question is whether IgnoreCase still behaves for
    // non-ASCII without ICU. Since .NET 5 the simple Unicode case-mapping table
    // lives in CoreLib rather than ICU, so these are expected to hold either way.

    [Theory]
    [InlineData("é", "É")]           // Latin-1 supplement
    [InlineData("ü", "Ü")]           // German umlaut
    [InlineData("ß", "ß")]           // sharp s has no single-char uppercase
    [InlineData("а", "А")]           // Cyrillic
    [InlineData("σ", "Σ")]           // Greek sigma
    [InlineData("ą", "Ą")]           // Latin extended-A
    public void IgnoreCase_MatchesNonAsciiPairs_WithoutIcu(string pattern, string input)
    {
        var result = RegexEvaluator.Evaluate(pattern, input, IgnoreCase());

        Assert.Null(result.Error);
        Assert.Single(result.Matches);
    }

    [Fact]
    public void IgnoreCase_GreekFinalSigma_DoesNotMatchCapitalSigma_InEitherMode()
    {
        // Σ lowercases to σ, never to ς, so simple case mapping gives no route
        // from final sigma back to the capital. Shipping ICU does not change it -
        // recorded so the gap is not mistaken for something ICU would fix.
        var result = RegexEvaluator.Evaluate("ς", "Σ", IgnoreCase());

        Assert.Empty(result.Matches);
    }

    [Fact]
    public void IgnoreCase_SharpS_DoesNotMatchSs_InEitherMode()
    {
        // Regex uses simple (1:1) case mapping, so ß never matches "SS" even with
        // ICU present. Documented here so nobody cites it as a reason to keep ICU.
        var result = RegexEvaluator.Evaluate("ß", "SS", IgnoreCase());

        Assert.Empty(result.Matches);
    }

    // --- what ICU actually buys ---------------------------------------------

    [Fact]
    public void NamedCultures_AreTheOneThingIcuBuys()
    {
        // This is the whole ICU dependency, isolated: without the data files a
        // named culture cannot be constructed at all - it throws rather than
        // quietly degrading to invariant.
        if (IsInvariantMode)
        {
            Assert.Throws<CultureNotFoundException>(() => CultureInfo.GetCultureInfo("tr-TR"));
            return;
        }

        Assert.Equal("\u0131", "I".ToLower(CultureInfo.GetCultureInfo("tr-TR")));
    }

    [Fact]
    public void CultureInvariantToggle_OnlyChangesAnything_WhenIcuIsShipped()
    {
        // The toggle the csproj protects only earns its place while a non-invariant
        // CurrentCulture is reachable. In the browser CurrentCulture comes from the
        // visitor's locale, so without ICU every visitor gets invariant casing and
        // the toggle silently does nothing.
        if (IsInvariantMode)
        {
            var withToggle = RegexEvaluator.Evaluate("i", "I", IgnoreCase(cultureInvariant: true));
            var without = RegexEvaluator.Evaluate("i", "I", IgnoreCase());

            Assert.Single(withToggle.Matches);
            Assert.Single(without.Matches);
            return;
        }

        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("tr-TR");

            // Turkish dotless-i rules: "i" and "I" stop being a case pair...
            Assert.Empty(RegexEvaluator.Evaluate("i", "I", IgnoreCase()).Matches);
            // ...unless the user ticks the toggle, which is what it is for.
            Assert.Single(RegexEvaluator.Evaluate("i", "I", IgnoreCase(cultureInvariant: true)).Matches);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }
}
