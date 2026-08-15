using System.Text.RegularExpressions;
using RegexOptions = System.Text.RegularExpressions.RegexOptions;
using SysRegex = System.Text.RegularExpressions.Regex;

namespace Toolbox.Wasm.Core.Regex;

/// <summary>
/// The real <see cref="SysRegex"/> engine behind the Regex Tester.
///
/// This deliberately mirrors the shape of the TypeScript implementation it
/// replaces (same caps, same group ordering, same empty-pattern short circuit) so
/// that swapping engines changes *results* - which is the point - without also
/// reshuffling the UI underneath the user.
///
/// Deliberately free of any WebAssembly or interop dependency: it targets plain
/// net10.0 so it can be unit tested without a browser.
/// </summary>
public static class RegexEvaluator
{
    /// <summary>Safety cap so a pattern matching at (almost) every position cannot stall the UI.</summary>
    public const int MaxMatches = 1000;

    /// <summary>Upper bound on the caller-supplied timeout; also the fallback when one isn't given.</summary>
    private const int MaxTimeoutMs = 10_000;

    public static RegexEvaluation Evaluate(string pattern, string testInput, RegexOptionsModel options)
    {
        if (string.IsNullOrEmpty(pattern))
        {
            return new RegexEvaluation([]);
        }

        SysRegex regex;
        try
        {
            regex = Build(pattern, options);
        }
        catch (Exception ex) when (IsPatternError(ex))
        {
            return new RegexEvaluation([], ex.Message);
        }

        var matches = new List<RegexMatchResult>();
        var truncated = false;

        try
        {
            foreach (Match match in regex.Matches(testInput))
            {
                matches.Add(ToMatchResult(regex, match));
                if (matches.Count >= MaxMatches)
                {
                    truncated = true;
                    break;
                }
            }
        }
        catch (RegexMatchTimeoutException)
        {
            // Catastrophic backtracking. Report it as a result rather than letting it
            // hang: in the browser there is no other thread to rescue the UI.
            return new RegexEvaluation(
                matches,
                $"Match timed out after {ResolveTimeout(options).TotalMilliseconds:0}ms. "
                    + "This pattern backtracks catastrophically on this input.");
        }

        return new RegexEvaluation(matches, Truncated: truncated);
    }

    public static RegexReplaceResult Replace(
        string pattern,
        string testInput,
        string replacement,
        RegexOptionsModel options)
    {
        if (string.IsNullOrEmpty(pattern))
        {
            return new RegexReplaceResult(testInput);
        }

        try
        {
            return new RegexReplaceResult(Build(pattern, options).Replace(testInput, replacement));
        }
        catch (RegexMatchTimeoutException)
        {
            return new RegexReplaceResult(testInput, "Replace timed out - the pattern backtracks catastrophically.");
        }
        catch (Exception ex) when (IsPatternError(ex))
        {
            return new RegexReplaceResult(testInput, ex.Message);
        }
    }

    private static SysRegex Build(string pattern, RegexOptionsModel options) =>
        new(pattern, ToRegexOptions(options), ResolveTimeout(options));

    private static TimeSpan ResolveTimeout(RegexOptionsModel options)
    {
        var ms = options.MatchTimeoutMs is > 0 and <= MaxTimeoutMs ? options.MatchTimeoutMs : 1000;
        return TimeSpan.FromMilliseconds(ms);
    }

    internal static RegexOptions ToRegexOptions(RegexOptionsModel options)
    {
        var result = RegexOptions.None;
        if (options.IgnoreCase) result |= RegexOptions.IgnoreCase;
        if (options.Multiline) result |= RegexOptions.Multiline;
        if (options.Singleline) result |= RegexOptions.Singleline;
        if (options.IgnorePatternWhitespace) result |= RegexOptions.IgnorePatternWhitespace;
        if (options.ExplicitCapture) result |= RegexOptions.ExplicitCapture;
        if (options.CultureInvariant) result |= RegexOptions.CultureInvariant;
        if (options.RightToLeft) result |= RegexOptions.RightToLeft;
        if (options.NonBacktracking) result |= RegexOptions.NonBacktracking;
        return result;
    }

    /// <summary>
    /// A bad pattern, or an unsupported combination of options, is user error - it
    /// belongs in the <c>error</c> field. Anything else is a bug and should surface
    /// as a crash rather than being quietly swallowed.
    /// </summary>
    private static bool IsPatternError(Exception ex) =>
        // RegexParseException derives from ArgumentException.
        ex is ArgumentException
            // e.g. NonBacktracking combined with RightToLeft.
            or NotSupportedException;

    /// <summary>
    /// Named groups first, then every numbered group - matching the order the
    /// existing match-details panel already renders. A named group legitimately
    /// appears in both lists, exactly as it did under the JavaScript engine, because
    /// in .NET a named group carries a number too.
    /// </summary>
    private static RegexMatchResult ToMatchResult(SysRegex regex, Match match)
    {
        var groups = new List<RegexGroupResult>();

        foreach (var name in regex.GetGroupNames())
        {
            // GetGroupNames returns numbers as strings alongside real names; the
            // numeric ones are handled by the pass below.
            if (int.TryParse(name, out _)) continue;

            var group = match.Groups[name];
            if (group.Success)
            {
                groups.Add(new RegexGroupResult(name, group.Value, group.Index));
            }
        }

        foreach (var number in regex.GetGroupNumbers())
        {
            if (number == 0) continue; // group 0 is the match itself

            var group = match.Groups[number];
            if (group.Success)
            {
                groups.Add(new RegexGroupResult(
                    number.ToString(System.Globalization.CultureInfo.InvariantCulture),
                    group.Value,
                    group.Index));
            }
        }

        return new RegexMatchResult(match.Value, match.Index, match.Length, groups);
    }
}
