export interface CsharpFeature {
  name: string;
  url: string;
}

export interface CsharpVersion {
  version: string;
  year: number;
  features: CsharpFeature[];
  isPreview?: boolean;
}