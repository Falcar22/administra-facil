// js/config.js
// js/config.js
const supabaseUrl = 'https://qtzariztmuzskhqmbtef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0emFyaXp0bXV6c2tocW1idGVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MzczNSwiZXhwIjoyMDkxNTM5NzM1fQ.CBwfN1sRrbc9JbZiXUZWziYvzonMedn8OMox_LW4f3o';

// AQUI ESTAVA O ERRO: Mudamos de 'const _supabase' para 'window.supabaseClient'
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("🚀 Agora SIM a conexão real está salva em window.supabaseClient!", window.supabaseClient);