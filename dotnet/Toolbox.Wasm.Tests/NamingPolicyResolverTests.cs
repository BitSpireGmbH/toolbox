using Toolbox.Wasm.Core.Serialization;
using Xunit;

namespace Toolbox.Wasm.Tests;

/// <summary>
/// These are the cases the TypeScript generator used to get wrong, and the only reason
/// the .NET runtime is involved in naming at all. If <c>IPAddress</c> ever comes back as
/// <c>iPAddress</c> here, the real policy has stopped being consulted.
/// </summary>
public class NamingPolicyResolverTests
{
    [Theory]
    [InlineData("IPAddress", "ipAddress")]
    [InlineData("ID", "id")]
    [InlineData("IOStream", "ioStream")]
    [InlineData("XMLHttpRequest", "xmlHttpRequest")]
    [InlineData("FirstName", "firstName")]
    [InlineData("A", "a")]
    public void CamelCase_LowercasesTheWholeLeadingCapitalRun(string property, string expected)
    {
        // The naive "lowercase the first character" gives iPAddress / iD / iOStream here.
        Assert.Equal(expected, Apply("CamelCase", property));
    }

    [Theory]
    [InlineData("SnakeCaseLower", "IPAddress", "ip_address")]
    [InlineData("SnakeCaseUpper", "IPAddress", "IP_ADDRESS")]
    [InlineData("KebabCaseLower", "IPAddress", "ip-address")]
    [InlineData("KebabCaseUpper", "IPAddress", "IP-ADDRESS")]
    [InlineData("SnakeCaseLower", "FirstName", "first_name")]
    public void EveryShippedPolicyIsReachable(string policy, string property, string expected)
    {
        Assert.Equal(expected, Apply(policy, property));
    }

    [Theory]
    [InlineData(NamingPolicyResolver.None)]
    [InlineData("PascalCase")] // never existed
    [InlineData(null)]
    public void UnknownOrAbsentPolicy_LeavesTheNameAlone(string? policy)
    {
        Assert.Null(NamingPolicyResolver.Resolve(policy));
        Assert.Equal("IPAddress", Apply(policy, "IPAddress"));
    }

    [Fact]
    public void Normalize_ReportsUnrecognisedPoliciesAsNone()
    {
        // So the caller can tell "applied verbatim on purpose" from "this runtime is
        // older than the dropdown that asked".
        Assert.Equal(NamingPolicyResolver.None, NamingPolicyResolver.Normalize("PascalCase"));
        Assert.Equal("CamelCase", NamingPolicyResolver.Normalize("CamelCase"));
    }

    [Fact]
    public void Apply_CollapsesDuplicatesRatherThanThrowing()
    {
        var result = NamingPolicyResolver.Apply("CamelCase", ["Id", "Id"]);

        Assert.Equal("id", Assert.Single(result).Value);
    }

    [Fact]
    public void Catalog_ExposesEveryPolicyResolveKnows()
    {
        foreach (var entry in NamingPolicyResolver.Catalog)
        {
            if (entry.Id == NamingPolicyResolver.None)
            {
                continue;
            }

            Assert.NotNull(NamingPolicyResolver.Resolve(entry.Id));
        }
    }

    private static string Apply(string? policy, string name) =>
        NamingPolicyResolver.Apply(policy, [name])[name];
}
