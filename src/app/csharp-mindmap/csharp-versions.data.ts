import type { CSharpFoundation, CSharpVersion } from './csharp-version.model';

/**
 * Foundational C# concepts that have existed since version 1.0.
 * These represent the core building blocks of the language.
 */
export const CSHARP_FOUNDATION: CSharpFoundation = {
  concepts: [
    {
      name: 'Classes',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/classes',
      category: 'types'
    },
    {
      name: 'Structs',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct',
      category: 'types'
    },
    {
      name: 'Interfaces',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces',
      category: 'types'
    },
    {
      name: 'Properties',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/properties',
      category: 'syntax'
    },
    {
      name: 'Events',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/events-overview',
      category: 'syntax'
    },
    {
      name: 'Delegates',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/delegates-overview',
      category: 'types'
    },
    {
      name: 'Operators',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/',
      category: 'syntax'
    }
  ]
};

/**
 * C# 2.0 features - Generics era
 */
export const CSHARP_2: CSharpVersion = {
  version: '2.0',
  releaseYear: 2005,
  dotNetVersion: '.NET Framework 2.0',
  color: { background: '#dae8fc', border: '#6c8ebf', text: '#1a365d' },
  features: [
    {
      name: 'Generics',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics',
      category: 'types'
    },
    {
      name: 'Partial Classes',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/partial-classes-and-methods#partial-classes',
      category: 'types'
    },
    {
      name: 'Anonymous Methods',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/delegate-operator',
      category: 'syntax'
    },
    {
      name: 'Nullable Types',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-value-types',
      category: 'types'
    },
    {
      name: 'Iterators',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/iterators',
      category: 'syntax'
    },
    {
      name: 'Covariance & Contravariance',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/covariance-contravariance/',
      category: 'types'
    }
  ]
};

/**
 * C# 3.0 features - LINQ era
 */
export const CSHARP_3: CSharpVersion = {
  version: '3.0',
  releaseYear: 2007,
  dotNetVersion: '.NET Framework 3.5',
  color: { background: '#dae8fc', border: '#6c8ebf', text: '#1a365d' },
  features: [
    {
      name: 'Auto-Implemented Properties',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/auto-implemented-properties',
      category: 'syntax'
    },
    {
      name: 'Anonymous Types',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/anonymous-types',
      category: 'types'
    },
    {
      name: 'Lambda Expressions',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/lambda-expressions',
      category: 'syntax'
    },
    {
      name: 'Expression Trees',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/expression-trees',
      category: 'syntax'
    },
    {
      name: 'Extension Methods',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/extension-methods',
      category: 'syntax'
    },
    {
      name: 'Partial Methods',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/partial-method',
      category: 'syntax'
    },
    {
      name: 'Object & Collection Initializers',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/object-and-collection-initializers',
      category: 'syntax'
    },
    {
      name: 'Implicitly Typed Variables (var)',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/reference-types',
      category: 'syntax'
    }
  ]
};

/**
 * C# 4.0 features - Dynamic era
 */
export const CSHARP_4: CSharpVersion = {
  version: '4.0',
  releaseYear: 2010,
  dotNetVersion: '.NET Framework 4.0',
  color: { background: '#dae8fc', border: '#6c8ebf', text: '#1a365d' },
  features: [
    {
      name: 'Named & Optional Arguments',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/named-and-optional-arguments',
      category: 'syntax'
    },
    {
      name: 'Generic Covariance & Contravariance',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance',
      category: 'types'
    }
  ]
};

/**
 * C# 5.0 features - Async era
 */
export const CSHARP_5: CSharpVersion = {
  version: '5.0',
  releaseYear: 2012,
  dotNetVersion: '.NET Framework 4.5',
  color: { background: '#dae8fc', border: '#6c8ebf', text: '#1a365d' },
  features: [
    {
      name: 'Async/Await',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/async',
      category: 'async'
    },
    {
      name: 'Caller Information Attributes',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/attributes/caller-information',
      category: 'other'
    }
  ]
};

/**
 * C# 6.0 features - Roslyn era
 */
export const CSHARP_6: CSharpVersion = {
  version: '6.0',
  releaseYear: 2015,
  dotNetVersion: '.NET Framework 4.6',
  color: { background: '#d5e8d4', border: '#82b366', text: '#274e13' },
  features: [
    {
      name: 'Static Using',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/using-directive',
      category: 'syntax'
    },
    {
      name: 'Exception Filters',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/when',
      category: 'syntax'
    },
    {
      name: 'nameof Operator',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/nameof',
      category: 'syntax'
    },
    {
      name: 'String Interpolation',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/tokens/interpolated',
      category: 'syntax'
    },
    {
      name: 'Null-Conditional Operators',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/member-access-operators#null-conditional-operators--and-',
      category: 'syntax'
    },
    {
      name: 'Expression-Bodied Members',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/properties',
      category: 'syntax'
    }
  ]
};

/**
 * C# 7.0 features - Tuples and patterns era
 */
export const CSHARP_7: CSharpVersion = {
  version: '7.0',
  releaseYear: 2017,
  dotNetVersion: '.NET Framework 4.7',
  color: { background: '#d5e8d4', border: '#82b366', text: '#274e13' },
  features: [
    {
      name: 'Async Main',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/program-structure/main-command-line',
      category: 'async'
    },
    {
      name: 'Out Variables',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/out-parameter-modifier',
      category: 'syntax'
    },
    {
      name: 'Tuples',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-tuples',
      category: 'types'
    },
    {
      name: 'Pattern Matching',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching',
      category: 'patterns'
    },
    {
      name: 'Local Functions',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/local-functions',
      category: 'syntax'
    },
    {
      name: 'Ref Locals',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/declarations#ref-locals',
      category: 'performance'
    },
    {
      name: 'Ref Returns',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/jump-statements#ref-returns',
      category: 'performance'
    },
    {
      name: 'Discards',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/discards',
      category: 'syntax'
    },
    {
      name: 'Binary Literals & Digit Separators',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/lexical-structure#6453-integer-literals',
      category: 'syntax'
    }
  ]
};

/**
 * C# 7.1 features
 */
export const CSHARP_7_1: CSharpVersion = {
  version: '7.1',
  releaseYear: 2017,
  dotNetVersion: '.NET Framework 4.7',
  color: { background: '#d5e8d4', border: '#82b366', text: '#274e13' },
  features: [
    {
      name: 'Default Literal Expressions',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/default#default-literal',
      category: 'syntax'
    },
    {
      name: 'Inferred Tuple Names',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-7.1/generics-pattern-match',
      category: 'types'
    }
  ]
};

/**
 * C# 7.2 features
 */
export const CSHARP_7_2: CSharpVersion = {
  version: '7.2',
  releaseYear: 2017,
  dotNetVersion: '.NET Framework 4.7.1',
  color: { background: '#d5e8d4', border: '#82b366', text: '#274e13' },
  features: [
    {
      name: 'Span<T> and stackalloc',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/stackalloc',
      category: 'performance'
    },
    {
      name: 'Ref Readonly',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/declarations#ref-locals',
      category: 'performance'
    },
    {
      name: 'Readonly Struct',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct#readonly-struct',
      category: 'types'
    },
    {
      name: 'In Parameters',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-7.2/readonly-ref#passing-arguments-as-readonly-references',
      category: 'performance'
    },
    {
      name: 'Ref Readonly Returns',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-7.2/readonly-ref#returning-by-readonly-reference',
      category: 'performance'
    },
    {
      name: 'Private Protected',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/private-protected',
      category: 'syntax'
    }
  ]
};

/**
 * C# 7.3 features
 */
export const CSHARP_7_3: CSharpVersion = {
  version: '7.3',
  releaseYear: 2018,
  dotNetVersion: '.NET Framework 4.7.2',
  color: { background: '#d5e8d4', border: '#82b366', text: '#274e13' },
  features: [
    {
      name: 'Fixed Pattern',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/fixed',
      category: 'performance'
    },
    {
      name: 'Stackalloc Array Initializers',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-7.3/stackalloc-array-initializers',
      category: 'performance'
    },
    {
      name: 'Reassign Ref Variables',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-7.3/ref-local-reassignment',
      category: 'performance'
    }
  ]
};

/**
 * C# 8.0 features
 */
export const CSHARP_8: CSharpVersion = {
  version: '8.0',
  releaseYear: 2019,
  dotNetVersion: '.NET Core 3.0',
  color: { background: '#fff2cc', border: '#d6b656', text: '#7f6000' },
  features: [
    {
      name: 'Readonly Instance Members',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct#readonly-instance-members',
      category: 'types'
    },
    {
      name: 'Default Interface Members',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface#default-interface-members',
      category: 'types'
    },
    {
      name: 'Pattern Matching Enhancements',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/patterns',
      category: 'patterns'
    },
    {
      name: 'Using Declarations',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/using-directive',
      category: 'syntax'
    },
    {
      name: 'Static Local Functions',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/local-functions',
      category: 'syntax'
    },
    {
      name: 'Disposable Ref Structs',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct',
      category: 'types'
    },
    {
      name: 'Nullable Reference Types',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-reference-types',
      category: 'types'
    },
    {
      name: 'Async Streams',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/iteration-statements#await-foreach',
      category: 'async'
    },
    {
      name: 'Indices and Ranges',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/member-access-operators#range-operator-',
      category: 'syntax'
    },
    {
      name: 'Null-Coalescing Assignment',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/assignment-operator#null-coalescing-assignment',
      category: 'syntax'
    }
  ]
};

/**
 * C# 9.0 features
 */
export const CSHARP_9: CSharpVersion = {
  version: '9.0',
  releaseYear: 2020,
  dotNetVersion: '.NET 5',
  color: { background: '#fff2cc', border: '#d6b656', text: '#7f6000' },
  features: [
    {
      name: 'Records',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#record-types',
      category: 'types'
    },
    {
      name: 'Init-Only Setters',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#init-only-setters',
      category: 'syntax'
    },
    {
      name: 'Top-Level Statements',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#top-level-statements',
      category: 'syntax'
    },
    {
      name: 'Pattern Matching Enhancements',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-9#pattern-matching-enhancements',
      category: 'patterns'
    },
    {
      name: 'Target-Typed new',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/target-typed-new',
      category: 'syntax'
    },
    {
      name: 'Lambda Discard Parameters',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/lambda-discard-parameters',
      category: 'syntax'
    },
    {
      name: 'Covariant Returns',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/covariant-returns',
      category: 'types'
    },
    {
      name: 'GetEnumerator Extension',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/extension-getenumerator',
      category: 'syntax'
    }
  ]
};

/**
 * C# 10.0 features
 */
export const CSHARP_10: CSharpVersion = {
  version: '10.0',
  releaseYear: 2021,
  dotNetVersion: '.NET 6',
  color: { background: '#f8cecc', border: '#b85450', text: '#7f2a27' },
  features: [
    {
      name: 'Record Structs',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#record-structs',
      category: 'types'
    },
    {
      name: 'Interpolated String Handlers',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#interpolated-string-handler',
      category: 'performance'
    },
    {
      name: 'Global Usings',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#global-using-directives',
      category: 'syntax'
    },
    {
      name: 'File-Scoped Namespaces',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#file-scoped-namespace-declaration',
      category: 'syntax'
    },
    {
      name: 'Constant Interpolated Strings',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#constant-interpolated-strings',
      category: 'syntax'
    },
    {
      name: 'CallerArgumentExpression',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#callerargumentexpression-attribute-diagnostics',
      category: 'other'
    },
    {
      name: 'Extended Property Patterns',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-10#extended-property-patterns',
      category: 'patterns'
    }
  ]
};

/**
 * C# 11.0 features
 */
export const CSHARP_11: CSharpVersion = {
  version: '11.0',
  releaseYear: 2022,
  dotNetVersion: '.NET 7',
  color: { background: '#f8cecc', border: '#b85450', text: '#7f2a27' },
  features: [
    {
      name: 'Generic Math / Static Abstract Members',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#generic-math-support',
      category: 'types'
    },
    {
      name: 'Auto-Default Structs',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#auto-default-struct',
      category: 'types'
    },
    {
      name: 'Required Members',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#required-members',
      category: 'types'
    },
    {
      name: 'Newlines in String Interpolations',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#newlines-in-string-interpolations',
      category: 'syntax'
    },
    {
      name: 'List Patterns',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#list-patterns',
      category: 'patterns'
    },
    {
      name: 'Raw String Literals',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#raw-string-literals',
      category: 'syntax'
    },
    {
      name: 'File-Local Types',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#file-local-types',
      category: 'types'
    },
    {
      name: 'Ref Fields & Scoped Ref',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-11#ref-fields-and-ref-scoped-variables',
      category: 'performance'
    }
  ]
};

/**
 * C# 12.0 features
 */
export const CSHARP_12: CSharpVersion = {
  version: '12.0',
  releaseYear: 2023,
  dotNetVersion: '.NET 8',
  color: { background: '#e1d5e7', border: '#9673a6', text: '#5c3d6e' },
  features: [
    {
      name: 'Ref Readonly Parameters',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-12#ref-readonly-parameters',
      category: 'performance'
    }
  ]
};

/**
 * C# 13.0 features
 */
export const CSHARP_13: CSharpVersion = {
  version: '13.0',
  releaseYear: 2024,
  dotNetVersion: '.NET 9',
  color: { background: '#6d8764', border: '#3a5431', text: '#ffffff' },
  features: [
    {
      name: 'Params Collections',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#params-collections',
      category: 'syntax'
    },
    {
      name: 'New Lock Object',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#new-lock-object',
      category: 'async'
    },
    {
      name: 'Overload Resolution Priority',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#overload-resolution-priority',
      category: 'other'
    },
    {
      name: 'Ref & Unsafe Improvements',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13#overload-resolution-priority',
      category: 'performance'
    }
  ]
};

/**
 * C# 14.0 features (Preview)
 */
export const CSHARP_14: CSharpVersion = {
  version: '14.0',
  releaseYear: 2025,
  dotNetVersion: '.NET 10',
  color: { background: '#bac8d3', border: '#23445d', text: '#1a365d' },
  features: [
    {
      name: 'Field Keyword',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#the-field-keyword',
      category: 'syntax'
    },
    {
      name: 'Implicit Span Conversions',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#implicit-span-conversions',
      category: 'performance'
    },
    {
      name: 'Unbound Generic nameof',
      documentationUrl: 'https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#unbound-generic-types-and-nameof',
      category: 'syntax'
    }
  ]
};

/**
 * All C# versions in chronological order.
 * This array is extensible - simply add new versions to include them in the mindmap.
 */
export const ALL_CSHARP_VERSIONS: readonly CSharpVersion[] = [
  CSHARP_2,
  CSHARP_3,
  CSHARP_4,
  CSHARP_5,
  CSHARP_6,
  CSHARP_7,
  CSHARP_7_1,
  CSHARP_7_2,
  CSHARP_7_3,
  CSHARP_8,
  CSHARP_9,
  CSHARP_10,
  CSHARP_11,
  CSHARP_12,
  CSHARP_13,
  CSHARP_14
];
