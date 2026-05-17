export type SocialEventType =
  | 'captura_confirmata'
  | 'captura_mare'
  | 'popularitate_ridicata'
  | 'partida_ratata'
  | 'conditii_proaste'
  | 'informatie_balta'
  | 'irelevant';

export interface SocialPost {
  id: string;
  platform: 'tiktok' | string;
  source_url: string;
  lake_id: string | null;
  author_handle: string | null;
  caption: string | null;
  posted_at: string | null;
  view_count: number | null;
  like_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPostAnalysis {
  id: string;
  post_id: string;
  event_type: SocialEventType;
  lake_guess: string | null;
  fish_type: string | null;
  estimated_weight_kg: number | null;
  confidence: number;
  popularity_score: number;
  sentiment: string | null;
  mentions_bad_weather: boolean;
  mentions_no_bites: boolean;
  mentions_rain: boolean;
  mentions_wind: boolean;
  summary: string | null;
  raw_result: Record<string, unknown>;
  analyzed_at: string;
}

export interface SocialPostWithAnalysis extends SocialPost {
  analysis: SocialPostAnalysis | null;
  lake_name: string | null;
}

export interface SocialLakeOption {
  id: string;
  name: string;
  county: string;
}

export interface SocialPostInput {
  source_url: string;
  lake_id: string | null;
  author_handle: string | null;
  caption: string | null;
  view_count: number | null;
  like_count: number | null;
}
