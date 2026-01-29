import axios from 'axios';
import type { PxWebMetadata, PxWebRequest, JsonStatResponse } from '../types';

// Use proxy in development to avoid CORS issues
const BASE_URL = '/api/statfin';

// Dataset paths
export const DATASETS = {
  // Työvoimatutkimus (Labour Force Survey)
  TYTI: 'tyti',
  // Työnvälitystilasto (Employment Service Statistics)
  TYONV: 'tyonv',
} as const;

// Commonly used tables
export const TABLES = {
  // Labour force by status, gender, age (monthly)
  LABOUR_FORCE_MONTHLY: 'statfin_tyti_pxt_135y.px',
  // Key indicators with trends and seasonal adjustment
  KEY_INDICATORS_TREND: 'statfin_tyti_pxt_135z.px',
  // Population by labour market status
  LABOUR_MARKET_STATUS: 'statfin_tyti_pxt_13aj.px',
  // Unemployed job seekers
  UNEMPLOYED_SEEKERS: 'statfin_tyonv_pxt_12r5.px',
  // Unemployment rate
  UNEMPLOYMENT_RATE: 'statfin_tyonv_pxt_12tf.px',
  // Regional quarterly data by maakunta
  REGIONAL_QUARTERLY: 'statfin_tyti_pxt_13lx.px',
  // Employment by industry (annual)
  INDUSTRY_EMPLOYMENT: 'statfin_tyti_pxt_13aq.px',
  // Employment by industry (quarterly)
  INDUSTRY_QUARTERLY: 'statfin_tyti_pxt_137l.px',
  // Open positions by region
  OPEN_POSITIONS_REGION: 'statfin_tyonv_pxt_12tv.px',
  // Unemployed and positions by occupation
  OCCUPATION_DATA: 'statfin_tyonv_pxt_12ti.px',
} as const;

// Filter options
export const GENDER_OPTIONS = [
  { value: 'SSS', label: 'Yhteensä' },
  { value: '1', label: 'Miehet' },
  { value: '2', label: 'Naiset' },
] as const;

export const AGE_GROUP_OPTIONS = [
  { value: '15-74', label: '15-74 vuotiaat' },
  { value: '15-64', label: '15-64 vuotiaat' },
  { value: '15-24', label: '15-24 vuotiaat (nuoret)' },
  { value: '25-34', label: '25-34 vuotiaat' },
  { value: '35-44', label: '35-44 vuotiaat' },
  { value: '45-54', label: '45-54 vuotiaat' },
  { value: '55-64', label: '55-64 vuotiaat' },
] as const;

/**
 * Fetch table metadata (available variables and values)
 */
export async function getTableMetadata(
  dataset: string,
  tableId: string
): Promise<PxWebMetadata> {
  const url = `${BASE_URL}/${dataset}/${tableId}`;
  const response = await axios.get<PxWebMetadata>(url);
  return response.data;
}

/**
 * Fetch data from a table with specific query
 */
export async function queryTable(
  dataset: string,
  tableId: string,
  query: PxWebRequest
): Promise<JsonStatResponse> {
  const url = `${BASE_URL}/${dataset}/${tableId}`;
  const response = await axios.post<JsonStatResponse>(url, query);
  return response.data;
}

/**
 * Helper to parse JSON-stat response into a more usable format
 */
export function parseJsonStat(data: JsonStatResponse): {
  dimensions: Record<string, string[]>;
  values: number[];
  labels: Record<string, Record<string, string>>;
} {
  const dimensions: Record<string, string[]> = {};
  const labels: Record<string, Record<string, string>> = {};

  for (const dimId of data.id) {
    const dim = data.dimension[dimId];
    dimensions[dimId] = Object.keys(dim.category.index).sort(
      (a, b) => dim.category.index[a] - dim.category.index[b]
    );
    labels[dimId] = dim.category.label;
  }

  return {
    dimensions,
    values: data.value,
    labels,
  };
}

export interface LabourForceParams {
  gender?: string;
  ageGroup?: string;
}

/**
 * Fetch monthly labour force data
 */
export async function getMonthlyLabourForceData(
  params: LabourForceParams = {}
): Promise<JsonStatResponse> {
  const { gender = 'SSS', ageGroup = '15-74' } = params;

  const query: PxWebRequest = {
    query: [
      {
        code: 'Kuukausi',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Sukupuoli',
        selection: {
          filter: 'item',
          values: [gender],
        },
      },
      {
        code: 'Ikäluokka',
        selection: {
          filter: 'item',
          values: [ageGroup],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: [
            'Tyovoima',        // Labour force
            'Tyolliset',       // Employed
            'Tyottomat',       // Unemployed
            'Tyottomyysaste',  // Unemployment rate
            'Tyollisyysaste',  // Employment rate
          ],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYTI, TABLES.LABOUR_FORCE_MONTHLY, query);
}

/**
 * Fetch key indicators with trend and seasonally adjusted series
 * Table 135z has no gender/age filters — it provides aggregate figures
 */
export async function getKeyIndicatorsWithTrend(): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Kuukausi',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: [
            'Tyolliset',              // Employed (original)
            'tyolliset_trendi',       // Employed (trend)
            'Tyottomat',              // Unemployed (original)
            'tyottomat_trendi',       // Unemployed (trend)
            'Tyottomyysaste',         // Unemployment rate (original)
            'tyottaste_trendi',       // Unemployment rate (trend)
            'Tyollisyysaste_15_64',   // Employment rate 15-64 (original)
            'tyollaste_15_64_trendi', // Employment rate 15-64 (trend)
          ],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYTI, TABLES.KEY_INDICATORS_TREND, query);
}

// Regional codes (Maakunnat)
export const REGIONS = [
  { value: 'MK01', label: 'Uusimaa' },
  { value: 'MK02', label: 'Varsinais-Suomi' },
  { value: 'MK04', label: 'Satakunta' },
  { value: 'MK05', label: 'Kanta-Häme' },
  { value: 'MK06', label: 'Pirkanmaa' },
  { value: 'MK07', label: 'Päijät-Häme' },
  { value: 'MK08', label: 'Kymenlaakso' },
  { value: 'MK09', label: 'Etelä-Karjala' },
  { value: 'MK10', label: 'Etelä-Savo' },
  { value: 'MK11', label: 'Pohjois-Savo' },
  { value: 'MK12', label: 'Pohjois-Karjala' },
  { value: 'MK13', label: 'Keski-Suomi' },
  { value: 'MK14', label: 'Etelä-Pohjanmaa' },
  { value: 'MK15', label: 'Pohjanmaa' },
  { value: 'MK16', label: 'Keski-Pohjanmaa' },
  { value: 'MK17', label: 'Pohjois-Pohjanmaa' },
  { value: 'MK18', label: 'Kainuu' },
  { value: 'MK19', label: 'Lappi' },
  { value: 'MK21', label: 'Ahvenanmaa' },
] as const;

/**
 * Fetch job seeker data by region (Työnvälitystilasto)
 */
export async function getJobSeekersByRegion(
  month?: string
): Promise<JsonStatResponse> {
  // Get the latest month if not specified
  const monthSelection = month
    ? { filter: 'item' as const, values: [month] }
    : { filter: 'top' as const, values: ['1'] };

  const query: PxWebRequest = {
    query: [
      {
        code: 'Alue',
        selection: {
          filter: 'item',
          values: REGIONS.map((r) => r.value),
        },
      },
      {
        code: 'Kuukausi',
        selection: monthSelection,
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: [
            'TYOTTOMATLOPUSSA',  // Unemployed job seekers
            'TYOTOSUUS',         // Unemployment rate %
            'AVPAIKATLOPUSSA',   // Open job positions
          ],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYONV, TABLES.UNEMPLOYED_SEEKERS, query);
}

// Region options with "Koko maa" (whole country)
export const REGION_OPTIONS = [
  { value: 'SSS', label: 'Koko maa' },
  ...REGIONS,
] as const;

/**
 * Fetch quarterly regional labour market data
 */
export async function getRegionalQuarterlyData(
  region: string = 'SSS'
): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Vuosineljännes',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Maakunta',
        selection: {
          filter: 'item',
          values: [region],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: [
            'Tyolliset',           // Employed
            'Tyovoima',            // Labour force
            'Tyottomyysaste',      // Unemployment rate
            'Tyollisyysaste_15_64', // Employment rate
          ],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYTI, TABLES.REGIONAL_QUARTERLY, query);
}

/**
 * Fetch quarterly regional labour market data for multiple regions
 */
export async function getMultiRegionQuarterlyData(
  regions: string[]
): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Vuosineljännes',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Maakunta',
        selection: {
          filter: 'item',
          values: regions,
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: [
            'Tyolliset',           // Employed
            'Tyovoima',            // Labour force
            'Tyottomyysaste',      // Unemployment rate
            'Tyollisyysaste_15_64', // Employment rate
          ],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYTI, TABLES.REGIONAL_QUARTERLY, query);
}

/**
 * Fetch open positions trend for multiple regions
 */
export async function getMultiRegionOpenPositionsTrend(
  regions: string[]
): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Alue',
        selection: {
          filter: 'item',
          values: regions,
        },
      },
      {
        code: 'Kuukausi',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: ['AVPAIKATLOPUSSA'],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYONV, TABLES.OPEN_POSITIONS_REGION, query);
}

// Industry codes (main sectors)
export const INDUSTRIES = [
  { value: 'A_B', label: 'Maa-, metsä- ja kalatalous' },
  { value: 'C', label: 'Teollisuus' },
  { value: 'D_E', label: 'Energia- ja vesihuolto' },
  { value: 'F', label: 'Rakentaminen' },
  { value: 'G', label: 'Kauppa' },
  { value: 'H', label: 'Kuljetus ja varastointi' },
  { value: 'I', label: 'Majoitus- ja ravitsemistoiminta' },
  { value: 'J', label: 'Informaatio ja viestintä' },
  { value: 'K_L', label: 'Rahoitus- ja vakuutustoiminta' },
  { value: 'M', label: 'Ammatillinen toiminta' },
  { value: 'N', label: 'Hallinto- ja tukipalvelut' },
  { value: 'O', label: 'Julkinen hallinto' },
  { value: 'P', label: 'Koulutus' },
  { value: 'Q', label: 'Terveys- ja sosiaalipalvelut' },
  { value: 'R', label: 'Taiteet ja virkistys' },
  { value: 'STU', label: 'Muu palvelutoiminta' },
] as const;

/**
 * Fetch employment by industry (annual data)
 */
export async function getIndustryEmployment(): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Vuosi',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Toimiala',
        selection: {
          filter: 'item',
          values: INDUSTRIES.map((i) => i.value),
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: ['Tyolliset', 'tyotunnit'],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYTI, TABLES.INDUSTRY_EMPLOYMENT, query);
}

/**
 * Fetch open positions trend by region
 */
export async function getOpenPositionsTrend(
  region: string = 'SSS'
): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Alue',
        selection: {
          filter: 'item',
          values: [region],
        },
      },
      {
        code: 'Kuukausi',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: ['AVPAIKATLOPUSSA'],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYONV, TABLES.OPEN_POSITIONS_REGION, query);
}

/**
 * Fetch unemployed and open positions by occupation group
 */
export async function getOccupationData(): Promise<JsonStatResponse> {
  const query: PxWebRequest = {
    query: [
      {
        code: 'Kuukausi',
        selection: {
          filter: 'top',
          values: ['1'],
        },
      },
      {
        code: 'Ammattiryhmä',
        selection: {
          filter: 'all',
          values: ['*'],
        },
      },
      {
        code: 'Tiedot',
        selection: {
          filter: 'item',
          values: ['TYOTTOMATLOPUSSA', 'AVPAIKATLOPUSSA'],
        },
      },
    ],
    response: {
      format: 'json-stat2',
    },
  };

  return queryTable(DATASETS.TYONV, TABLES.OCCUPATION_DATA, query);
}
