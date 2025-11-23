// Enums matching the Database Schema
export enum UserRole {
  ADMIN = 'admin',
  CLIENT = 'client',
  PRESTATAIRE = 'prestataire'
}

export enum InterventionStatus {
  A_ATTRIBUER = 'a_attribuer',
  ACCEPTEE = 'acceptee',
  EN_COURS = 'en_cours',
  TERMINEE = 'terminee'
}

export enum InterventionType {
  STANDARD = 'standard',
  INTENDANCE = 'intendance'
}

// Interfaces
export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  company_name?: string; // For prestataires
}

export interface Logement {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  photos: string[];
}

export interface Intervention {
  id: string;
  logement_id: string;
  logement_name: string; // Joined data for UI
  date: string; // ISO date
  status: InterventionStatus;
  type: InterventionType;
  prix_client_ttc: number;
  prix_prestataire_ht: number;
  nb_voyageurs: number;
}