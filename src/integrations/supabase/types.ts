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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      additional_charges: {
        Row: {
          id: string
          client: string
          month: string
          amount: number
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          client: string
          month: string
          amount: number
          note?: string
          created_at?: string
        }
        Update: {
          id?: string
          client?: string
          month?: string
          amount?: number
          note?: string
          created_at?: string
        }
        Relationships: []
      }
      excluded_trip_months: {
        Row: {
          id: string
          client: string
          month: string
          created_at: string
        }
        Insert: {
          id?: string
          client: string
          month: string
          created_at?: string
        }
        Update: {
          id?: string
          client?: string
          month?: string
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          aliases: string[]
          collection_rate: number | null
          created_at: string
          email: string | null
          exclude_from_total: boolean
          id: string
          markup_includes_vat: boolean
          markup_type: string | null
          markup_value: number | null
          name: string
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          show_driver_price: boolean
          show_full_price_breakdown: boolean
          sort_by_date: string | null
          sort_by_origin: string | null
          vat_number: string | null
        }
        Insert: {
          aliases?: string[]
          collection_rate?: number | null
          created_at?: string
          email?: string | null
          exclude_from_total?: boolean
          id?: string
          markup_includes_vat?: boolean
          markup_type?: string | null
          markup_value?: number | null
          name: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          show_driver_price?: boolean
          show_full_price_breakdown?: boolean
          sort_by_date?: string | null
          sort_by_origin?: string | null
          vat_number?: string | null
        }
        Update: {
          aliases?: string[]
          collection_rate?: number | null
          created_at?: string
          email?: string | null
          exclude_from_total?: boolean
          id?: string
          markup_includes_vat?: boolean
          markup_type?: string | null
          markup_value?: number | null
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          show_driver_price?: boolean
          show_full_price_breakdown?: boolean
          sort_by_date?: string | null
          sort_by_origin?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paid: number
          client: string
          created_at: string
          id: string
          month: string
          owner_user_id: string | null
        }
        Insert: {
          amount_paid?: number
          client: string
          created_at?: string
          id?: string
          month: string
          owner_user_id?: string | null
        }
        Update: {
          amount_paid?: number
          client?: string
          created_at?: string
          id?: string
          month?: string
          owner_user_id?: string | null
        }
        Relationships: []
      }
      phone_routing: {
        Row: {
          client_id: string
          created_at: string
          id: string
          owner_user_id: string | null
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          owner_user_id?: string | null
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          owner_user_id?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_routing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          billing_month: string | null
          client: string | null
          client_id: string | null
          created_at: string
          destination: string | null
          id: string
          notes: string | null
          origin: string | null
          owner_user_id: string | null
          passenger_name: string | null
          phone: string | null
          price: number | null
          trip_date: string | null
          trip_number: string
        }
        Insert: {
          billing_month?: string | null
          client?: string | null
          client_id?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          owner_user_id?: string | null
          passenger_name?: string | null
          phone?: string | null
          price?: number | null
          trip_date?: string | null
          trip_number: string
        }
        Update: {
          billing_month?: string | null
          client?: string | null
          client_id?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          owner_user_id?: string | null
          passenger_name?: string | null
          phone?: string | null
          price?: number | null
          trip_date?: string | null
          trip_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          page: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          page: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          page?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
