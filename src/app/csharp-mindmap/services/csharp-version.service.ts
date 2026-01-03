import { Injectable } from '@angular/core';
import { CsharpVersion, CsharpFeature } from '../models/csharp-version.models';

interface VersionData {
  year: number;
  features: CsharpFeature[];
}

@Injectable({
  providedIn: 'root'
})
export class CsharpVersionService {
  private readonly data: { versions: Record<string, VersionData> } = {
    "versions": {
      "1.0": {
        "year": 2002,
        "features": [
          { "name": "classes", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/classes" },
          { "name": "structs", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct" },
          { "name": "interfaces", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces" },
          { "name": "properties", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/properties" },
          { "name": "events", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/events-overview" },
          { "name": "delegates", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/delegates-overview" },
          { "name": "Operators and expressions", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/" }
        ]
      },
      "2.0": {
        "year": 2005,
        "features": [
          { "name": "generics", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics" },
          { "name": "partial types", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/partial-classes-and-methods#partial-classes" },
          { "name": "anonymous lambdas", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/delegate-operator" },
          { "name": "Nullable value types", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-value-types" },
          { "name": "Iterators", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/iterators" },
          { "name": "Covariance / Contravariance", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/covariance-contravariance/" }
        ]
      },
      "3.0": {
        "year": 2007,
        "features": [
          { "name": "Auto-implemented properties", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/auto-implemented-properties" },
          { "name": "Anonymous types", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/anonymous-types" },
          { "name": "Lambda expressions", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/lambda-expressions" },
          { "name": "Expression trees", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/expression-trees" },
          { "name": "Extension methods", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/extension-methods" },
          { "name": "Partial methods", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/partial-method" },
          { "name": "Object and collection initializers", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/object-and-collection-initializers" }
        ]
      },
      "4.0": {
        "year": 2010,
        "features": [
          { "name": "Dynamic binding", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/reference-types" },
          { "name": "Named/optional parameters", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/named-and-optional-arguments" },
          { "name": "Generic covariant/contravariant", "url": "https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance" }
        ]
      },
      "5.0": {
        "year": 2012,
        "features": [
          { "name": "Asynchronous members", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/async" },
          { "name": "Caller info attributes", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/attributes/caller-information" }
        ]
      },
      "6.0": {
        "year": 2015,
        "features": [
          { "name": "Static imports", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/using-directive" },
          { "name": "Exception filters", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/when" },
          { "name": "nameof operator", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/nameof" },
          { "name": "string interpolation", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/tokens/interpolated" },
          { "name": "Null propagator", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/member-access-operators#null-conditional-operators--and-" },
          { "name": "Auto-property initializers", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/properties" }
        ]
      },
      "7.0": {
        "year": 2017,
        "features": [
          { "name": "out variables", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/out-parameter-modifier" },
          { "name": "Tuples and deconstruction", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-tuples" },
          { "name": "Pattern matching", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching" }
        ]
      },
      "8.0": {
        "year": 2019,
        "features": [
           { "name": "readonly members", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct#readonly-instance-members" },
           { "name": "default interface methods", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface#default-interface-members" },
           { "name": "Nullable reference types", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-reference-types" },
           { "name": "Asynchronous streams", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/iteration-statements#await-foreach" },
           { "name": "Indices and Ranges", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/member-access-operators#range-operator-" },
           { "name": "Null-coalescing assignment", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/assignment-operator#null-coalescing-assignment" }
        ]
      },
      "9.0": {
        "year": 2020,
        "features": [
          { "name": "Records", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#record-types" },
          { "name": "Init-only setters", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#init-only-setters" },
          { "name": "Top-level statements", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#top-level-statements" },
          { "name": "Pattern matching enhancements", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#pattern-matching-enhancements" }
        ]
      },
      "10": {
        "year": 2021,
        "features": [
          { "name": "Record structs", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#record-structs" },
          { "name": "Interpolated string handlers", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#interpolated-string-handler" },
          { "name": "global using directive", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#global-using-directives" },
          { "name": "File-scoped namespace declaration", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#file-scoped-namespace-declaration" },
          { "name": "Const interpolated strings", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#constant-interpolated-strings" },
          { "name": "CallerArgumentExpression attribute", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#callerargumentexpression-attribute-diagnostics" },
          { "name": "Extended property patterns", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#extended-property-patterns" }
        ]
      },
      "11": {
        "year": 2022,
        "features": [
          { "name": "Generic Math", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#generic-math-support" },
          { "name": "Auto-default structs", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#auto-default-struct" },
          { "name": "Required members", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#required-members" },
          { "name": "Newlines in string interpolation expressions", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#newlines-in-string-interpolations" },
          { "name": "List patterns", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#list-patterns" }
        ]
      },
      "12": {
        "year": 2023,
        "features": [
          { "name": "Primary constructors", "url": "https://github.com/dotnet/csharplang/blob/main/proposals/non-record-primary-constructors.md" },
          { "name": "Collection expressions", "url": "https://github.com/dotnet/csharplang/blob/main/proposals/collection-literals.md" },
          { "name": "Default parameters in lambdas", "url": "https://github.com/dotnet/csharplang/blob/main/proposals/lambda-method-group-defaults.md" },
          { "name": "ref readonly parameters", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-12#ref-readonly-parameters" }
        ]
      },
      "13": {
        "year": 2024,
        "features": [
          { "name": "params collections", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#params-collections" },
          { "name": "New lock object", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#new-lock-object" },
          { "name": "Overload resolution priority", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#overload-resolution-priority" }
        ]
      },
      "14": {
        "year": 2025,
        "features": [
          { "name": "The field keyword", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#the-field-keyword" },
          { "name": "Implicit span conversions", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#implicit-span-conversions" },
          { "name": "nameof with unbound generic types", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#unbound-generic-types-and-nameof" },
          { "name": "Null conditional assignment", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#null-conditional-assignment" },
          { "name": "partial events and constructors", "url": "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#more-partial-members" }
        ]
      }
    }
  };

  getVersions(): CsharpVersion[] {
    return Object.entries(this.data.versions)
      .map(([version, data]) => ({
        version,
        year: data.year,
        features: data.features
      }))
      .sort((a, b) => {
         return parseFloat(a.version) - parseFloat(b.version);
      });
  }
}