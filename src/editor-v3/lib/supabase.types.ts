/** Day 20 — typed schema for the Supabase client. Mirrors the
 * `v3_projects` table created in
 * supabase/migrations/20260427180000_v3_projects.sql. Hand-written
 * for now; once the schema settles we can swap to generated types
 * via `supabase gen types typescript`.
 *
 * v1 still owns public.projects (different schema); v3 lives in
 * public.v3_projects so the two editors don't collide. */

export type Database = {
  public: {
    Tables: {
      v3_projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          doc: ProjectDoc;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          doc: ProjectDoc;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          doc?: ProjectDoc;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

/** Serialized document. Matches what projectSerializer emits. The
 * `version` field lets future migrations bump the schema without
 * breaking projects saved under the prior shape. */
export type ProjectDoc = {
  version: number;
  layers: SerializedLayer[];
  canvas: { width: number; height: number };
};

/** SerializedLayer is a structurally-narrow JSON of the runtime
 * Layer union. ImageBitmap (not JSON-serializable) is replaced by
 * a base64 PNG dataURL on the way out and re-decoded on the way
 * in. Every other layer field round-trips as-is. */
export type SerializedLayer = Record<string, unknown> & {
  id: string;
  type: "rect" | "ellipse" | "image" | "text";
};
