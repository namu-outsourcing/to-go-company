import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
    console.warn('Supabase URL is missing. Auth and DB features will not work until you update your .env file.');
}

export const supabase = (supabaseUrl && supabaseUrl !== 'YOUR_SUPABASE_URL') 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } };
