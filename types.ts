
export interface ProcessingStatus {
  total: number;
  current: number;
  isProcessing: boolean;
  currentStage: string;
}

export interface PageResult {
  pageNumber: number;
  htmlContent: string;
}

export enum AppState {
  LOGIN = 'LOGIN',
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ReportRecord {
  id: string;
  fileName: string;
  timestamp: number;
  totalProcessed: number;
  successCount: number;
  results: string[]; // Stores the HTML fragments
  pageOffset: number;
}

// 'google' reserved for official Google API. 'openai' is now the catch-all for custom/oneapi.
export type AiProvider = 'google' | 'openai' | 'anthropic';

export interface ApiSettings {
  apiKey: string;
  baseUrl: string;
  provider: AiProvider;
}
