declare module '@neon/config/v1' {
  export interface NeonConfig {
    preview?: {
      aiGateway?: boolean;
      buckets?: Record<string, { access: 'private' | 'public' }>;
    };
  }
  export function defineConfig(config: NeonConfig): NeonConfig;
}
