declare module "*.png" {
  const source: string;
  export default source;
}

declare module "*.webp" {
  const source: string;
  export default source;
}

declare module "*.svg" {
  const source: string;
  export default source;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
