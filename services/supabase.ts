import { createClient } from '@supabase/supabase-js';

// Configuration des clés API
// On vérifie d'abord les variables d'environnement (Vite), sinon on utilise les clés en dur.
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://dnkpcupephllhrdyewcz.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRua3BjdXBlcGhsbGhyZHlld2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDA4MTMsImV4cCI6MjA3OTA3NjgxM30.fp4Cu8BiqvwNhwpwHr8dEXCh09LzQ-B95rp2QfHAhWQ';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERREUR CRITIQUE : Clés Supabase manquantes.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type SupabaseClient = typeof supabase;