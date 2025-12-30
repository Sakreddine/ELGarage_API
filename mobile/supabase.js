import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// REMPLACEZ PAR VOS VRAIES CLÉS (Les mêmes que dans votre fichier .env du backend)
const SUPABASE_URL = 'https://ljdzsqpzbxtrptdaftur.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZHpzcXB6Ynh0cnB0ZGFmdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NjA3NTIsImV4cCI6MjA4MjMzNjc1Mn0.Z0IaWz901FG360CrGMHAQBdDJ88md2p2mpCe-Y5yOVY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);