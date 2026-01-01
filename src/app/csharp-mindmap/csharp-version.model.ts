/**
 * Represents a C# language feature with its documentation link.
 * This interface follows the Interface Segregation Principle (ISP) - 
 * it contains only the essential properties needed for a feature.
 */
export interface CSharpFeature {
  readonly name: string;
  readonly description?: string;
  readonly documentationUrl: string;
  readonly category?: FeatureCategory;
}

/**
 * Categories for C# features to help organize and filter them.
 * Extensible - new categories can be added as needed.
 */
export type FeatureCategory =
  | 'syntax'
  | 'types'
  | 'patterns'
  | 'async'
  | 'performance'
  | 'other';

/**
 * Represents a C# language version with its features.
 * This interface follows the Open/Closed Principle (OCP) -
 * new versions can be added without modifying existing code.
 */
export interface CSharpVersion {
  readonly version: string;
  readonly releaseYear?: number;
  readonly dotNetVersion?: string;
  readonly features: readonly CSharpFeature[];
  readonly color: VersionColor;
}

/**
 * Color theme for version nodes in the mindmap.
 * Each version can have its own color scheme for visual distinction.
 */
export interface VersionColor {
  readonly background: string;
  readonly border: string;
  readonly text: string;
}

/**
 * Represents foundational C# concepts that exist since version 1.0.
 * These are the building blocks of the language.
 */
export interface CSharpFoundation {
  readonly concepts: readonly CSharpFeature[];
}

/**
 * Complete C# language data model including all versions and foundations.
 * This is the root interface for the mindmap data structure.
 */
export interface CSharpLanguageData {
  readonly foundation: CSharpFoundation;
  readonly versions: readonly CSharpVersion[];
}
