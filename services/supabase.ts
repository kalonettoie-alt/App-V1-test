import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dnkpcupephllhrdyewcz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRua3BjdXBlcGhsbGhyZHlld2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDA4MTMsImV4cCI6MjA3OTA3NjgxM30.fp4Cu8BiqvwNhwpwHr8dEXCh09LzQ-B95rp2QfHAhWQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseClient = typeof supabase;