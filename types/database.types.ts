// Auto-generate the full version with: npx supabase gen types typescript --linked
// This is a hand-written stub that covers the tables we reference in code.
// Keep in sync with schema.sql.
// NOTE: Supabase v3 requires Relationships: [] on every table/view entry.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string
          name: string
          max_branches: number
          storage_mb: number
          allow_live_rates: boolean
          allow_excel_import: boolean
          allow_layout_config: boolean
          allow_branch_rate_edit: boolean
          duration_days: number
          price_note: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          max_branches?: number
          storage_mb?: number
          allow_live_rates?: boolean
          allow_excel_import?: boolean
          allow_layout_config?: boolean
          allow_branch_rate_edit?: boolean
          duration_days?: number
          price_note?: string | null
          is_active?: boolean
        }
        Update: Partial<{
          name: string
          max_branches: number
          storage_mb: number
          allow_live_rates: boolean
          allow_excel_import: boolean
          allow_layout_config: boolean
          allow_branch_rate_edit: boolean
          duration_days: number
          price_note: string | null
          is_active: boolean
        }>
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          plan_id: string
          plan_expires_at: string
          is_active: boolean
          logo_url: string | null
          primary_color: string
          business_name: string | null
          base_currency: string
          rate_reset_enabled: boolean
          rate_reset_time: string | null
          branch_ad_mode: 'replace' | 'prepend' | 'append'
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          plan_id: string
          plan_expires_at: string
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string
          business_name?: string | null
          base_currency?: string
          rate_reset_enabled?: boolean
          rate_reset_time?: string | null
          branch_ad_mode?: 'replace' | 'prepend' | 'append'
        }
        Update: Partial<{
          name: string
          plan_id: string
          plan_expires_at: string
          is_active: boolean
          logo_url: string | null
          primary_color: string
          business_name: string | null
          base_currency: string
          rate_reset_enabled: boolean
          rate_reset_time: string | null
          branch_ad_mode: 'replace' | 'prepend' | 'append'
        }>
        Relationships: []
      }
      users: {
        Row: {
          id: string
          customer_id: string
          role: 'admin' | 'branch_user'
          full_name: string
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      branches: {
        Row: {
          id: string
          customer_id: string
          name: string
          location_note: string | null
          branch_token: string
          layout: 'split-standard' | 'rates-full' | 'ads-full' | 'portrait' | 'rates-wide'
          allow_user_rate_edit: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          name: string
          location_note?: string | null
          layout?: 'split-standard' | 'rates-full' | 'ads-full' | 'portrait' | 'rates-wide'
          allow_user_rate_edit?: boolean
          is_active?: boolean
        }
        Update: Partial<{
          name: string
          location_note: string | null
          layout: 'split-standard' | 'rates-full' | 'ads-full' | 'portrait' | 'rates-wide'
          allow_user_rate_edit: boolean
          is_active: boolean
          branch_token: string
        }>
        Relationships: []
      }
      branch_user_assignments: {
        Row: {
          user_id: string
          branch_id: string
        }
        Insert: Database['public']['Tables']['branch_user_assignments']['Row']
        Update: Partial<Database['public']['Tables']['branch_user_assignments']['Row']>
        Relationships: []
      }
      screen_sessions: {
        Row: {
          id: string
          branch_id: string
          screen_id: string | null
          session_key: string
          last_seen_at: string
          user_agent: string | null
          ip_address: string | null
        }
        Insert: Omit<Database['public']['Tables']['screen_sessions']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['screen_sessions']['Insert']>
        Relationships: []
      }
      currencies: {
        Row: {
          id: string
          code: string
          name: string
          flag_path: string | null
          default_decimals: number
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['currencies']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['currencies']['Insert']>
        Relationships: []
      }
      customer_currencies: {
        Row: {
          id: string
          customer_id: string
          currency_id: string
          is_enabled: boolean
          display_order: number
          decimal_places: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customer_currencies']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customer_currencies']['Insert']>
        Relationships: []
      }
      rates: {
        Row: {
          customer_id: string
          currency_id: string
          buy: number | null
          sell: number | null
          transfer: number | null
          extra_values: Json | null
          mode: 'manual' | 'live' | 'excel' | 'api'
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          customer_id: string
          currency_id: string
          buy: number | null
          sell: number | null
          transfer: number | null
          extra_values?: Json | null
          mode: 'manual' | 'live' | 'excel' | 'api'
          updated_by: string | null
          updated_at: string
        }
        Update: Partial<Database['public']['Tables']['rates']['Row']>
        Relationships: []
      }
      branch_rate_overrides: {
        Row: {
          branch_id: string
          currency_id: string
          buy: number | null
          sell: number | null
          transfer: number | null
          updated_by: string | null
          updated_at: string
        }
        Insert: Database['public']['Tables']['branch_rate_overrides']['Row']
        Update: Partial<Database['public']['Tables']['branch_rate_overrides']['Row']>
        Relationships: []
      }
      rate_history: {
        Row: {
          id: string
          customer_id: string
          branch_id: string | null
          currency_id: string
          buy: number | null
          sell: number | null
          transfer: number | null
          changed_by: string | null
          source: 'manual' | 'excel' | 'api' | 'system'
          changed_at: string
        }
        Insert: Omit<Database['public']['Tables']['rate_history']['Row'], 'id' | 'changed_at'>
        Update: never
        Relationships: []
      }
      ads: {
        Row: {
          id: string
          customer_id: string
          branch_id: string | null
          file_url: string
          file_type: 'image' | 'video'
          duration_seconds: number
          display_order: number
          is_active: boolean
          file_size_bytes: number
          original_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          branch_id?: string | null
          file_url: string
          file_type: 'image' | 'video'
          duration_seconds?: number
          display_order?: number
          is_active?: boolean
          file_size_bytes?: number
          original_name?: string | null
        }
        Update: Partial<{
          branch_id: string | null
          file_url: string
          file_type: 'image' | 'video'
          duration_seconds: number
          display_order: number
          is_active: boolean
          file_size_bytes: number
          original_name: string | null
        }>
        Relationships: []
      }
      ticker_messages: {
        Row: {
          id: string
          customer_id: string
          branch_id: string | null
          message: string
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          customer_id: string
          branch_id?: string | null
          message: string
          display_order?: number
          is_active?: boolean
        }
        Update: Partial<{
          message: string
          display_order: number
          is_active: boolean
        }>
        Relationships: []
      }
      license_keys: {
        Row: {
          id: string
          customer_id: string
          key_hash: string
          label: string | null
          issued_at: string
          expires_at: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          is_revoked: boolean
        }
        Insert: {
          customer_id: string
          key_hash: string
          label?: string | null
          expires_at?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          is_revoked?: boolean
        }
        Update: Partial<{
          label: string | null
          expires_at: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          is_revoked: boolean
        }>
        Relationships: []
      }
      excel_imports: {
        Row: {
          id: string
          customer_id: string
          branch_id: string | null
          imported_by: string | null
          rows_total: number
          rows_success: number
          rows_failed: number
          error_summary: Json | null
          imported_at: string
        }
        Insert: {
          customer_id: string
          branch_id?: string | null
          imported_by?: string | null
          rows_total: number
          rows_success: number
          rows_failed: number
          error_summary?: Json | null
        }
        Update: never
        Relationships: []
      }
      display_templates: {
        Row: {
          id: string
          customer_id: string
          name: string
          columns: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          name: string
          columns: Json
          is_default?: boolean
        }
        Update: Partial<{
          name: string
          columns: Json
          is_default: boolean
          updated_at: string
        }>
        Relationships: []
      }
      screens: {
        Row: {
          id: string
          branch_id: string
          customer_id: string
          name: string
          screen_token: string
          template_id: string | null
          orientation: string
          layout: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          branch_id: string
          customer_id: string
          name?: string
          screen_token?: string
          template_id?: string | null
          orientation?: string
          layout?: string
          is_active?: boolean
        }
        Update: Partial<{
          name: string
          template_id: string | null
          orientation: string
          layout: string
          is_active: boolean
          screen_token: string
        }>
        Relationships: []
      }
      screen_ads: {
        Row: {
          screen_id: string
          ad_id: string
          display_order: number
        }
        Insert: {
          screen_id: string
          ad_id: string
          display_order?: number
        }
        Update: Partial<{
          display_order: number
        }>
        Relationships: []
      }
    }
    Views: {
      v_branch_screen_status: {
        Row: {
          branch_id: string
          customer_id: string
          branch_name: string
          screens_online: number
          screens_total: number
          last_seen_at: string | null
        }
        Relationships: []
      }
      v_customer_storage: {
        Row: {
          customer_id: string
          used_mb: number
          limit_mb: number
          used_percent: number
        }
        Relationships: []
      }
      v_distributor_overview: {
        Row: {
          id: string
          name: string
          is_active: boolean
          plan_expires_at: string
          is_expired: boolean
          plan_name: string
          max_branches: number
          branch_count: number
          storage_used_mb: number
          storage_limit_mb: number
        }
        Relationships: []
      }
    }
    Functions: {
      get_tv_data: {
        Args: { p_branch_id: string }
        Returns: Json
      }
      my_customer_id: {
        Args: Record<never, never>
        Returns: string
      }
      my_role: {
        Args: Record<never, never>
        Returns: string
      }
      my_branch_id: {
        Args: Record<never, never>
        Returns: string
      }
      set_template_as_default: {
        Args: { p_template_id: string; p_customer_id: string }
        Returns: void
      }
    }
    Enums: Record<never, never>
  }
}
