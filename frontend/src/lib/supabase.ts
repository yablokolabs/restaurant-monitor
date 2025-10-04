import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || "";

console.log("Supabase config:", { supabaseUrl, supabaseAnonKey });

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are not set properly");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase client created:", supabase);
