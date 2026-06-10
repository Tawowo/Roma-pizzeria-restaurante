import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(url, key)

export type Categorie = {
  id: string; nom: string; nom_it?: string; nom_en?: string
  ordre: number; actif: boolean
}
export type Article = {
  id: string; categorie_id: string
  nom: string; nom_it?: string; nom_en?: string
  description?: string; description_it?: string; description_en?: string
  prix: number; prix_pala?: number; prix_reduction?: number
  promotion?: number
  disponible: boolean; ordre: number
}
export type PlatDuJour = {
  id: string; nom: string; description?: string
  prix?: number; actif: boolean; date_debut: string
  created_at: string
}
export type Formule = {
  id: string; nom: string; description?: string
  contenu?: string; prix: number; actif: boolean; ordre: number
}
export type Client = {
  id: string; nom: string; telephone: string; email?: string
  created_at: string
}
export type Reservation = {
  id: string; client_id?: string; nom: string; telephone: string
  date_reservation: string; heure_reservation: string
  nombre_couverts: number; zone?: string; notes?: string
  statut: string; created_at: string
}
export type Commande = {
  id: string; numero_commande: number; client_id?: string
  nom: string; telephone: string
  heure_retrait: string; date_retrait: string
  statut: string; notes?: string; total: number
  created_at: string; lignes?: LigneCommande[]
}
export type LigneCommande = {
  id: string; commande_id: string; article_nom: string
  article_id?: string; quantite: number; taille: string
  prix_unitaire: number; commentaire?: string
}
export type Parametre = { cle: string; valeur: string }
