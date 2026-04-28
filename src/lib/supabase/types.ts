export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nom: string;
          prenom: string;
          telephone: string;
          photo_url: string | null;
          role: "conducteur" | "passager" | "les_deux";
          voiture_modele: string | null;
          voiture_couleur: string | null;
          voiture_plaque: string | null;
          charte_acceptee_at: string;
          is_admin: boolean;
          suspended: boolean;
          suspended_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nom: string;
          prenom: string;
          telephone: string;
          photo_url?: string | null;
          role?: "conducteur" | "passager" | "les_deux";
          voiture_modele?: string | null;
          voiture_couleur?: string | null;
          voiture_plaque?: string | null;
          charte_acceptee_at: string;
          is_admin?: boolean;
          suspended?: boolean;
          suspended_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      cultes: {
        Row: {
          id: string;
          libelle: string;
          jour_semaine: number;
          heure: string;
          actif: boolean;
          created_at: string;
        };
        Insert: {
          libelle: string;
          jour_semaine: number;
          heure: string;
          actif?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["cultes"]["Insert"]>;
        Relationships: [];
      };
      eglise: {
        Row: { id: string; nom: string; adresse: string; position: unknown };
        Insert: { nom: string; adresse: string; position: unknown };
        Update: Partial<{ nom: string; adresse: string; position: unknown }>;
        Relationships: [];
      };
      trajets: {
        Row: {
          id: string;
          conducteur_id: string;
          culte_id: string;
          depart_adresse: string;
          depart_position: unknown;
          trajet_ligne: unknown;
          sens: "aller" | "retour" | "aller_retour";
          places_total: number;
          rayon_detour_km: number;
          heure_depart: string;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          conducteur_id: string;
          culte_id: string;
          depart_adresse: string;
          depart_position: string;
          sens: "aller" | "retour" | "aller_retour";
          places_total: number;
          heure_depart: string;
          rayon_detour_km?: number;
          actif?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["trajets"]["Insert"]>;
        Relationships: [];
      };
      trajets_instances: {
        Row: {
          id: string;
          trajet_id: string;
          date: string;
          annule_par_conducteur: boolean;
          motif_annulation: string | null;
          created_at: string;
        };
        Insert: { trajet_id: string; date: string; annule_par_conducteur?: boolean };
        Update: Partial<{ annule_par_conducteur: boolean; motif_annulation: string | null }>;
        Relationships: [];
      };
      signalements: {
        Row: {
          id: string;
          auteur_id: string;
          cible_id: string;
          reservation_id: string | null;
          motif: string;
          description: string | null;
          statut: "ouvert" | "en_cours" | "traite" | "rejete";
          ia_gravite: number | null;
          ia_action_suggeree: string | null;
          traite_par: string | null;
          traite_le: string | null;
          created_at: string;
        };
        Insert: {
          auteur_id: string;
          cible_id: string;
          motif: string;
          description?: string | null;
          reservation_id?: string | null;
        };
        Update: Partial<{
          statut: "ouvert" | "en_cours" | "traite" | "rejete";
          ia_gravite: number | null;
          ia_action_suggeree: string | null;
          traite_par: string | null;
          traite_le: string | null;
        }>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          passager_id: string;
          trajet_instance_id: string;
          sens: "aller" | "retour";
          statut:
            | "pending"
            | "accepted"
            | "refused"
            | "cancelled"
            | "completed"
            | "no_show";
          pickup_adresse: string;
          pickup_position: unknown;
          motif_refus: string | null;
          demande_le: string;
          traitee_le: string | null;
          cancelled_le: string | null;
        };
        Insert: {
          passager_id: string;
          trajet_instance_id: string;
          sens: "aller" | "retour";
          pickup_adresse: string;
          pickup_position: string;
          statut?:
            | "pending"
            | "accepted"
            | "refused"
            | "cancelled"
            | "completed"
            | "no_show";
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [];
      };
      demandes_passager: {
        Row: {
          id: string;
          passager_id: string;
          culte_id: string;
          date: string;
          sens: "aller" | "retour";
          pickup_adresse: string;
          pickup_position: unknown;
          notes: string | null;
          statut: "active" | "matched" | "annulee";
          matched_trajet_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          passager_id: string;
          culte_id: string;
          date: string;
          sens: "aller" | "retour";
          pickup_adresse: string;
          pickup_position: string;
          notes?: string | null;
          statut?: "active" | "matched" | "annulee";
          matched_trajet_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["demandes_passager"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      trajets_compatibles: {
        Args: {
          p_passager_lat: number;
          p_passager_lng: number;
          p_culte_id: string;
          p_sens: "aller" | "retour";
          p_date: string;
        };
        Returns: {
          trajet_id: string;
          trajet_instance_id: string;
          conducteur_id: string;
          conducteur_prenom: string;
          conducteur_photo_url: string | null;
          depart_adresse: string;
          heure_depart: string;
          places_restantes: number;
          detour_km: number;
          score: number;
          dans_zone: boolean;
        }[];
      };
    };
  };
};
