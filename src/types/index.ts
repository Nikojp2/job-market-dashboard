// Statistics Finland PxWeb API types

export interface PxWebVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
}

export interface PxWebMetadata {
  title: string;
  variables: PxWebVariable[];
}

// PxWeb table list response types
export interface PxWebTableInfo {
  id: string;
  type: 't' | 'l'; // 't' = table, 'l' = folder/link
  text: string;
  updated?: string;
}

export type PxWebTableListResponse = PxWebTableInfo[];

export interface PxWebQuery {
  code: string;
  selection: {
    filter: string;
    values: string[];
  };
}

export interface PxWebRequest {
  query: PxWebQuery[];
  response: {
    format: string;
  };
}

// JSON-stat format types
export interface JsonStatDimension {
  label: string;
  category: {
    index: Record<string, number>;
    label: Record<string, string>;
  };
}

export interface JsonStatResponse {
  version: string;
  class: string;
  label: string;
  source: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStatDimension>;
  value: number[];
}

// Application data types
export interface EmploymentDataPoint {
  period: string;
  employed: number;
  unemployed: number;
  laborForce: number;
  unemploymentRate: number;
}

export interface UnemploymentByAge {
  ageGroup: string;
  count: number;
  rate: number;
}

export interface RegionalEmployment {
  region: string;
  employed: number;
  unemployed: number;
  rate: number;
}
