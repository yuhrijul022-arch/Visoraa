// ── App User ──
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ── Design System Types ──
export interface StyleProfile {
  palette: string[];
  typography_mood: string;
  layout_density: string;
  composition_patterns: string[];
  background_style: string;
  motifs: string[];
  cta_style: string;
  do_not_do: string[];
}

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  align: string;
  enabled?: boolean;
}

export interface ReferenceLocks {
  pose_lock: boolean;
  crop_lock: boolean;
  element_lock: boolean;
  color_lighting_lock: boolean;
}

export interface LayoutBlueprint {
  canvas: {
    ratio: "1:1" | "9:16" | "16:9" | "4:5";
    safe_margin_percent: number;
  };
  product_placement: {
    anchor: string;
    scale_percent: number;
    y_offset_percent: number;
    shadow: string;
    cutout_needed: boolean;
  };
  text_mode?: "ON" | "OFF";
  output_language?: "id" | "en";
  text_zones: {
    headline: Zone;
    benefit: Zone;
    price: Zone;
    cta: Zone;
  };
  style: Partial<StyleProfile>;
  elements: {
    badge: { enabled: boolean; position?: string };
    shapes: { enabled: boolean; count?: number };
    frame: { enabled: boolean };
  };
  reference_locks?: ReferenceLocks;
  copy_policy: {
    keep_short: boolean;
    avoid_claims: boolean;
  };
  product_category?: "beauty" | "fashion" | "food" | "packaging" | "general";
}

export interface DesignInputs {
  brandName: string;
  headline: string;
  benefit: string;
  price: string;
  cta: string;
  ratio: "1:1" | "9:16" | "16:9" | "4:5";
  matchStrength: number;
  customPrompt: string;
  textMode: 'auto' | 'on' | 'off';
  quantity: number;
  mode: 'standard' | 'pro';
}

export interface FileData {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface DesignPlanResult {
  style_profile: StyleProfile | null;
  layout_blueprint: LayoutBlueprint;
}