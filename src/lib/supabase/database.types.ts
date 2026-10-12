/**
 * Hand-written to match supabase/migrations/20260929000000_roles_and_backend.sql exactly.
 * Normally generated via `supabase gen types typescript` — done by hand here because this
 * session has no DB-privileged credential to run that command against the linked project.
 * Keep this in sync whenever a migration changes a table/function shape.
 *
 * Shape follows @supabase/postgrest-js's `GenericSchema`/`GenericTable`: every table needs
 * Row/Insert/Update/Relationships, or supabase-js silently falls back to untyped (`never`) query
 * results instead of a type error.
 */

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: {
          site_id: string;
          name: string;
          address: string | null;
          timezone: string;
          staleness_limit_s: number;
          opening_hours: { weekday: number; opens_at: string; closes_at: string }[];
          capacity_reference: number;
          points_enabled: boolean;
          manually_open: boolean;
          manager_id: string;
          approval_status: 'pending_approval' | 'active' | 'suspended';
          approved_at: string | null;
          plan: 'trial' | 'pro' | 'business';
          created_at: string;
        };
        Insert: never; // only via create_manager_site()
        Update: Partial<{
          name: string;
          address: string | null;
          timezone: string;
          staleness_limit_s: number;
          opening_hours: { weekday: number; opens_at: string; closes_at: string }[];
          capacity_reference: number;
          points_enabled: boolean;
          manually_open: boolean;
          // approval_status/approved_at are NOT updatable directly — only via admin_set_site_status().
        }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          /** 'unclaimed' = placeholder row created by the auth.users trigger before signup finishes — never a real role. */
          role: 'manager' | 'coach' | 'client' | 'admin' | 'unclaimed';
          site_id: string | null;
          status: 'pending' | 'active' | 'rejected';
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          birth_year: number | null;
          location_always: boolean;
          /** A Manager's plan choice at signup, applied to the site they eventually create once Admin-approved. */
          requested_plan: 'trial' | 'pro' | 'business' | null;
          avatar_url: string | null;
          created_at: string;
          activated_at: string | null;
          deactivated_at: string | null;
          phone: string | null;
        };
        Insert: {
          id: string;
          role: 'coach' | 'client';
          site_id: string;
          status: 'pending' | 'active';
          full_name?: string | null;
        };
        Update: Partial<{
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          birth_year: number | null;
          location_always: boolean;
          avatar_url: string | null;
        }>;
        Relationships: [];
      };
      checkins: {
        Row: {
          id: number;
          user_id: string;
          site_id: string;
          kind: 'client' | 'coach';
          checkin_at: string;
          last_confirmed_at: string;
          checkout_at: string | null;
        };
        Insert: { user_id: string; site_id: string; kind: 'client' | 'coach' };
        Update: Partial<{ checkout_at: string | null; last_confirmed_at: string }>;
        Relationships: [];
      };
      coach_logs: {
        Row: {
          id: number;
          coach_id: string;
          client_id: string;
          site_id: string;
          note: string;
          logged_for_date: string;
          created_at: string;
        };
        Insert: { coach_id: string; client_id: string; site_id: string; note: string };
        Update: Partial<{ note: string }>;
        Relationships: [];
      };
      point_rules: {
        Row: {
          id: string;
          site_id: string;
          weekday_mask: number;
          from_time: string;
          to_time: string;
          points: number;
          daily_cap: number;
        };
        Insert: {
          id: string;
          site_id: string;
          weekday_mask: number;
          from_time: string;
          to_time: string;
          points: number;
          daily_cap: number;
        };
        Update: Partial<{
          weekday_mask: number;
          from_time: string;
          to_time: string;
          points: number;
          daily_cap: number;
        }>;
        Relationships: [];
      };
      points_ledger: {
        Row: {
          id: number;
          client_id: string;
          site_id: string;
          delta: number;
          reason: string;
          ref_id: string | null;
          created_at: string;
        };
        Insert: { client_id: string; site_id: string; delta: number; reason: string; ref_id?: string | null };
        Update: never;
        Relationships: [];
      };
      rewards: {
        Row: { id: string; site_id: string; title: string; cost: number; stock: number | null };
        Insert: { id: string; site_id: string; title: string; cost: number; stock?: number | null };
        Update: Partial<{ title: string; cost: number; stock: number | null }>;
        Relationships: [];
      };
      platform_settings: {
        Row: { id: true; default_capacity_reference: number; support_email: string | null };
        Insert: never;
        Update: never; // only via admin_update_settings()
        Relationships: [];
      };
      broadcasts: {
        Row: { id: number; title: string; body: string; created_by: string; created_at: string };
        Insert: never; // only via admin_create_broadcast()
        Update: never;
        Relationships: [];
      };
      manager_activity_log: {
        Row: { manager_id: string; site_id: string; log_date: string; created_at: string };
        Insert: { manager_id: string; site_id: string }; // log_date defaults to current_date server-side
        Update: never;
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          client_id: string;
          site_id: string;
          reward_id: string;
          reward_title: string;
          code: string;
          qr: string;
          status: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id: string;
          client_id: string;
          site_id: string;
          reward_id: string;
          reward_title: string;
          code: string;
          qr: string;
          status: string;
          expires_at: string;
        };
        Update: Partial<{ status: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_manager_site: {
        Args: { p_name: string; p_address: string | null; p_timezone: string };
        Returns: string;
      };
      request_manager_signup: {
        Args: { p_plan: 'trial' | 'pro' | 'business'; p_full_name: string | null };
        Returns: undefined;
      };
      complete_self_registration: {
        Args: { p_role: 'coach' | 'client'; p_site_id: string; p_full_name: string | null };
        Returns: undefined;
      };
      list_signup_sites: {
        Args: Record<string, never>;
        Returns: { site_id: string; name: string; address: string | null }[];
      };
      manager_create_member: {
        Args: { p_user_id: string; p_role: 'coach' | 'client'; p_full_name: string | null; p_phone?: string | null };
        Returns: undefined;
      };
      set_profile_status: {
        Args: { p_user_id: string; p_status: 'active' | 'rejected' };
        Returns: undefined;
      };
      manager_set_person_name: {
        Args: { p_user_id: string; p_full_name: string | null };
        Returns: undefined;
      };
      manager_delete_person: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_support_email: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      admin_set_site_status: {
        Args: { p_site_id: string; p_status: 'pending_approval' | 'active' | 'suspended' };
        Returns: undefined;
      };
      admin_set_profile_status: {
        Args: { p_user_id: string; p_status: 'active' | 'rejected' };
        Returns: undefined;
      };
      admin_get_overview: {
        Args: Record<string, never>;
        Returns: {
          sites_pending: number;
          sites_active: number;
          sites_suspended: number;
          managers_total: number;
          managers_active: number;
          managers_pending: number;
          checkins_today: number;
        }[];
      };
      admin_set_profile_name: {
        Args: { p_user_id: string; p_full_name: string };
        Returns: undefined;
      };
      admin_reassign_site_manager: {
        Args: { p_site_id: string; p_new_manager_id: string };
        Returns: undefined;
      };
      admin_get_checkins_by_day: {
        Args: { p_days?: number };
        Returns: { date_key: string; count: number }[];
      };
      admin_get_checkins_by_site: {
        Args: { p_days?: number };
        Returns: { site_id: string; site_name: string; count: number }[];
      };
      admin_update_settings: {
        Args: { p_default_capacity_reference: number; p_support_email: string | null };
        Returns: undefined;
      };
      admin_create_broadcast: {
        Args: { p_title: string; p_body: string };
        Returns: undefined;
      };
      admin_delete_manager: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      admin_get_sites_growth: {
        Args: { p_months?: number };
        Returns: { month_key: string; count: number }[];
      };
      admin_get_manager_activity: {
        Args: { p_months?: number };
        Returns: { month_key: string; site_count: number }[];
      };
      admin_set_site_plan: {
        Args: { p_site_id: string; p_plan: 'trial' | 'pro' | 'business' };
        Returns: undefined;
      };
      get_daily_bands: {
        Args: { p_site_id: string; p_days?: number };
        Returns: { date_key: string; band: 'green' | 'amber' | 'red' }[];
      };
      get_live_band: {
        Args: { p_site_id: string };
        Returns: string;
      };
      get_week_real_bands: {
        Args: { p_site_id: string; p_week_start: string };
        Returns: { date_key: string; hour: number; band: 'green' | 'amber' | 'red' }[];
      };
      get_weekly_stats: {
        Args: { p_site_id: string; p_weeks?: number };
        Returns: { weekday: number; hour: number; band: 'green' | 'amber' | 'red'; samples: number }[];
      };
      get_site_geofence: {
        Args: { p_site_id: string };
        Returns: { lat: number; lng: number; radius: number }[];
      };
      manager_set_site_location: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_radius: number };
        Returns: undefined;
      };
      admin_set_site_location: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_radius: number };
        Returns: undefined;
      };
      check_in: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_mocked: boolean };
        Returns: number;
      };
    };
  };
}
