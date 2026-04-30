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
          voiture_photo_url: string | null;
          bio: string | null;
          charte_acceptee_at: string;
          is_admin: boolean;
          suspended: boolean;
          suspended_reason: string | null;
          available_now: boolean;
          available_until: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
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
          voiture_photo_url?: string | null;
          bio?: string | null;
          charte_acceptee_at: string;
          is_admin?: boolean;
          suspended?: boolean;
          suspended_reason?: string | null;
          available_now?: boolean;
          available_until?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      saved_places: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          icon: string | null;
          adresse: string;
          position: unknown;
          created_at: string;
        };
        Insert: {
          user_id: string;
          label: string;
          icon?: string | null;
          adresse: string;
          position: string;
        };
        Update: Partial<{
          label: string;
          icon: string | null;
          adresse: string;
          position: string;
        }>;
        Relationships: [];
      };
      trip_ratings: {
        Row: {
          id: string;
          reservation_id: string;
          rater_id: string;
          rated_id: string;
          stars: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          reservation_id: string;
          rater_id: string;
          rated_id: string;
          stars: number;
          comment?: string | null;
        };
        Update: Partial<{ stars: number; comment: string | null }>;
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
          trajet_ligne?: string;
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
      messages: {
        Row: {
          id: string;
          reservation_id: string | null;
          expediteur_id: string;
          destinataire_id: string;
          contenu: string;
          lu: boolean;
          envoye_le: string;
        };
        Insert: {
          reservation_id?: string | null;
          expediteur_id: string;
          destinataire_id: string;
          contenu: string;
          lu?: boolean;
        };
        Update: Partial<{ lu: boolean }>;
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
      track_positions: {
        Row: {
          trajet_instance_id: string;
          conducteur_id: string;
          lat: number;
          lng: number;
          updated_at: string;
        };
        Insert: {
          trajet_instance_id: string;
          conducteur_id: string;
          lat: number;
          lng: number;
          updated_at?: string;
        };
        Update: Partial<{
          lat: number;
          lng: number;
          updated_at: string;
        }>;
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
      subscriptions: {
        Row: {
          id: string;
          passager_id: string;
          trajet_id: string;
          sens: "aller" | "retour";
          pickup_adresse: string;
          pickup_position: unknown;
          actif: boolean;
          created_at: string;
        };
        Insert: {
          passager_id: string;
          trajet_id: string;
          sens: "aller" | "retour";
          pickup_adresse: string;
          pickup_position: string;
          actif?: boolean;
        };
        Update: Partial<{
          pickup_adresse: string;
          pickup_position: string;
          actif: boolean;
        }>;
        Relationships: [];
      };
      thanks: {
        Row: {
          id: string;
          auteur_id: string;
          destinataire_id: string;
          reservation_id: string | null;
          message: string;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          auteur_id: string;
          destinataire_id: string;
          reservation_id?: string | null;
          message: string;
          is_public?: boolean;
        };
        Update: never;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
        };
        Update: Partial<{
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
        }>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          reminder_2h: boolean;
          imminent_departure: boolean;
          new_request: boolean;
          decision: boolean;
          trajet_cancelled: boolean;
          new_message: boolean;
          thanks_received: boolean;
          weekly_summary_admin: boolean;
          engagement_relance: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          reminder_2h?: boolean;
          imminent_departure?: boolean;
          new_request?: boolean;
          decision?: boolean;
          trajet_cancelled?: boolean;
          new_message?: boolean;
          thanks_received?: boolean;
          weekly_summary_admin?: boolean;
          engagement_relance?: boolean;
        };
        Update: Partial<{
          reminder_2h: boolean;
          imminent_departure: boolean;
          new_request: boolean;
          decision: boolean;
          trajet_cancelled: boolean;
          new_message: boolean;
          thanks_received: boolean;
          weekly_summary_admin: boolean;
          engagement_relance: boolean;
        }>;
        Relationships: [];
      };
      engagement_log: {
        Row: {
          id: string;
          user_id: string;
          kind: "engage_d2" | "engage_d7" | "engage_d14";
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "engage_d2" | "engage_d7" | "engage_d14";
          sent_at?: string;
        };
        Update: Partial<{
          kind: "engage_d2" | "engage_d7" | "engage_d14";
          sent_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      user_stats: {
        Row: {
          user_id: string;
          total_trajets_conducteur: number;
          total_passagers_transportes: number;
          total_trajets_passager: number;
          places_offertes_30j: number;
          note_moyenne: number | null;
          mois_courant_trajets: number;
        };
        Relationships: [];
      };
      user_top_score: {
        Row: {
          user_id: string;
          trajets_proposes: number;
          demandes_recues: number;
          demandes_acceptees: number;
          passagers_transportes: number;
          km_detour_consenti: number;
          median_minutes_reponse: number | null;
          taux_acceptation: number | null;
        };
        Relationships: [];
      };
    };
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
