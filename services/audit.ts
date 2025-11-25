import { supabase } from './supabase';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export async function logAction(
  action: AuditAction,
  table_name: string,
  record_id: string,
  changes: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Audit log: Aucun utilisateur connecté');
      return;
    }

    // On suppose que la table audit_log existe comme défini dans le schéma SQL initial
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      table_name,
      record_id,
      changes: changes,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Ne pas bloquer l'opération principale si le log échoue
    console.error('Erreur audit log:', error);
  }
}