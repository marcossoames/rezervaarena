export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_user_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          images: string[] | null
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          images?: string[] | null
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          images?: string[] | null
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          created_by: string
          end_time: string | null
          facility_id: string
          id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          created_by: string
          end_time?: string | null
          facility_id: string
          id?: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          created_by?: string
          end_time?: string | null
          facility_id?: string
          id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          client_id: string
          created_at: string
          end_time: string
          facility_id: string
          facility_owner_amount: number | null
          id: string
          notes: string | null
          payment_method: string | null
          platform_fee_amount: number | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_application_fee_amount: number | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_transfer_id: string | null
          total_amount: number | null
          total_price: number
          updated_at: string
        }
        Insert: {
          booking_date: string
          client_id: string
          created_at?: string
          end_time: string
          facility_id: string
          facility_owner_amount?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          platform_fee_amount?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_application_fee_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          total_amount?: number | null
          total_price: number
          updated_at?: string
        }
        Update: {
          booking_date?: string
          client_id?: string
          created_at?: string
          end_time?: string
          facility_id?: string
          facility_owner_amount?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          platform_fee_amount?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_application_fee_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          total_amount?: number | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bookings_client_id"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_bookings_facility_id"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: string
          amenities: string[] | null
          capacity: number
          city: string
          created_at: string
          description: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          images: string[] | null
          is_active: boolean
          main_image_url: string | null
          name: string
          operating_hours_end: string | null
          operating_hours_start: string | null
          owner_id: string
          price_per_hour: number
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          capacity?: number
          city: string
          created_at?: string
          description?: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image_url?: string | null
          name: string
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          owner_id: string
          price_per_hour: number
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          capacity?: number
          city?: string
          created_at?: string
          description?: string | null
          facility_type?: Database["public"]["Enums"]["facility_type"]
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image_url?: string | null
          name?: string
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          owner_id?: string
          price_per_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_facilities_owner_id"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      facility_images: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          facility_id: string
          id: string
          image_url: string
          is_main: boolean | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          facility_id: string
          id?: string
          image_url: string
          is_main?: boolean | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          facility_id?: string
          id?: string
          image_url?: string
          is_main?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_images_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_services: {
        Row: {
          created_at: string
          description: string | null
          facility_id: string
          id: string
          is_included: boolean | null
          price: number | null
          service_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          facility_id: string
          id?: string
          is_included?: boolean | null
          price?: number | null
          service_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          facility_id?: string
          id?: string
          is_included?: boolean | null
          price?: number | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_services_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          updated_at: string
          user_id: string
          user_type_comment: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          updated_at?: string
          user_id: string
          user_type_comment?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          user_type_comment?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_current_user_account: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      delete_user_account_secure: {
        Args: { _user_id: string }
        Returns: boolean
      }
      get_client_info_for_facility_bookings: {
        Args: { facility_owner_id: string }
        Returns: {
          client_email: string
          client_id: string
          client_name: string
          client_phone: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_facilities_for_authenticated_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          amenities: string[]
          area_info: string
          capacity: number
          city: string
          description: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          images: string[]
          name: string
          phone_number: string
          price_per_hour: number
          sports_complex_address: string
          sports_complex_name: string
        }[]
      }
      get_facilities_for_booking: {
        Args: Record<PropertyKey, never>
        Returns: {
          amenities: string[]
          area_info: string
          capacity: number
          city: string
          description: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          images: string[]
          name: string
          price_per_hour: number
        }[]
      }
      get_facilities_for_public_browsing_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          amenities: string[]
          capacity: number
          city: string
          description: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          images: string[]
          name: string
          price_per_hour: number
          sports_complex_name: string
        }[]
      }
      get_facility_stats_by_type: {
        Args: Record<PropertyKey, never>
        Returns: {
          facility_count: number
          facility_type: Database["public"]["Enums"]["facility_type"]
          min_price: number
        }[]
      }
      get_owner_facility_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          amenities: string[]
          city: string
          created_at: string
          description: string
          exact_capacity: number
          exact_price_per_hour: number
          facility_type: Database["public"]["Enums"]["facility_type"]
          full_address: string
          id: string
          images: string[]
          is_active: boolean
          main_image_url: string
          name: string
          owner_id: string
          updated_at: string
        }[]
      }
      get_public_facilities: {
        Args: Record<PropertyKey, never>
        Returns: {
          address: string
          amenities: string[]
          capacity: number
          city: string
          created_at: string
          description: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          images: string[]
          name: string
          price_per_hour: number
        }[]
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      promote_user_to_admin_secure: {
        Args: { _user_id: string }
        Returns: boolean
      }
      promote_user_to_facility_owner_secure: {
        Args: { _user_id: string }
        Returns: boolean
      }
      register_facility_with_profile: {
        Args: {
          p_address: string
          p_amenities: string[]
          p_capacity: number
          p_city: string
          p_description: string
          p_email: string
          p_facility_name: string
          p_facility_type: Database["public"]["Enums"]["facility_type"]
          p_full_name: string
          p_phone: string
          p_price_per_hour: number
          p_user_id: string
        }
        Returns: string
      }
      register_facility_with_profile_secure: {
        Args: {
          p_address: string
          p_amenities: string[]
          p_capacity: number
          p_city: string
          p_description: string
          p_email: string
          p_facility_name: string
          p_facility_type: Database["public"]["Enums"]["facility_type"]
          p_full_name: string
          p_phone: string
          p_price_per_hour: number
        }
        Returns: string
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      facility_type:
        | "tennis"
        | "football"
        | "padel"
        | "swimming"
        | "basketball"
        | "volleyball"
      user_role: "client" | "facility_owner" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      facility_type: [
        "tennis",
        "football",
        "padel",
        "swimming",
        "basketball",
        "volleyball",
      ],
      user_role: ["client", "facility_owner", "admin"],
    },
  },
} as const
