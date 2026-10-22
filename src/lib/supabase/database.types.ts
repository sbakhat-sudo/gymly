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
          band_green_pct: number;
          band_amber_pct: number;
          notify_manager_on_threshold: boolean;
          chain_id: string | null;
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
          band_green_pct: number;
          band_amber_pct: number;
          notify_manager_on_threshold: boolean;
          // approval_status/approved_at are NOT updatable directly — only via admin_set_site_status().
          // chain_id is NOT updatable directly — only set once via create_manager_site().
        }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          /** 'unclaimed' = placeholder row created by the auth.users trigger before signup finishes — never a real role. */
          role: 'manager' | 'coach' | 'client' | 'admin' | 'owner' | 'unclaimed';
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
          /** Real, Manager/Owner-set fields — no payment processor in this project, so this is a
           * fact recorded by hand, never a computed/invented number. Only via owner_set_client_payment(). */
          membership_type: 'annual' | 'monthly' | null;
          payment_status: 'paid' | 'unpaid' | null;
          /** false for every Client that existed before the subscriptions feature shipped (backfilled
           * once) — a brand-new Client with no `subscriptions` row AND this still true is the one who
           * must see the mandatory plan-choice popup. See client_get_my_subscription(). */
          subscription_required: boolean;
          /** Set once, the moment an approved Owner creates their gym_chains row (create_owner_chain())
           * — same role for Owner that site_id already plays for Manager: "hasn't created their own
           * thing yet" is this being null, not a separate status. */
          chain_id: string | null;
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
      gym_chains: {
        Row: { id: string; name: string; owner_id: string | null; hq_address: string | null; plan: 'trial' | 'pro' | 'business'; created_at: string };
        Insert: never; // only via create_manager_site()/create_owner_chain()
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
      coach_ratings: {
        Row: {
          id: number;
          checkin_id: number;
          client_id: string;
          coach_id: string;
          rating: number;
          comment: string | null;
          coach_reply: string | null;
          manager_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { checkin_id: number; client_id: string; coach_id: string; rating: number; comment?: string | null };
        Update: never; // coach_reply/manager_note only via coach_reply_to_rating()/manager_note_on_rating()
        Relationships: [];
      };
      issue_reports: {
        Row: {
          id: number;
          checkin_id: number;
          client_id: string;
          description: string | null;
          severity: 'urgent' | 'minor' | null;
          status: 'pending' | 'resolved';
          created_at: string;
          resolved_at: string | null;
        };
        Insert: { checkin_id: number; client_id: string; description?: string | null };
        Update: never; // severity/status only via manager_set_issue_severity()/manager_resolve_issue()
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          site_id: string;
          plan_type: 'monthly' | 'annual';
          status: 'active' | 'grace' | 'blocked';
          start_date: string;
          expiry_date: string;
          last_payment_date: string;
          grace_end_date: string | null;
          warning_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // only via client_choose_plan()/manager_assign_plan()
        Update: never; // only via client_confirm_payment_during_grace()/client_switch_plan()
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_site_coaches: {
        Args: Record<string, never>;
        Returns: { id: string; full_name: string | null }[];
      };
      coach_get_my_ratings: {
        Args: Record<string, never>;
        Returns: { id: number; created_at: string; client_name: string; rating: number; comment: string | null; coach_reply: string | null; manager_note: string | null }[];
      };
      client_get_my_ratings: {
        Args: Record<string, never>;
        Returns: { id: number; checkin_id: number; created_at: string; coach_id: string; coach_name: string; rating: number; comment: string | null; coach_reply: string | null }[];
      };
      client_get_site_issues_resolved_today: {
        Args: Record<string, never>;
        Returns: { id: number; description: string | null; resolved_at: string }[];
      };
      coach_reply_to_rating: {
        Args: { p_rating_id: number; p_reply: string };
        Returns: undefined;
      };
      manager_note_on_rating: {
        Args: { p_rating_id: number; p_note: string };
        Returns: undefined;
      };
      manager_get_ratings: {
        Args: Record<string, never>;
        Returns: {
          id: number;
          created_at: string;
          client_name: string;
          coach_id: string;
          coach_name: string;
          rating: number;
          comment: string | null;
          coach_reply: string | null;
          manager_note: string | null;
        }[];
      };
      manager_get_issues: {
        Args: Record<string, never>;
        Returns: {
          id: number;
          created_at: string;
          client_id: string;
          client_name: string;
          description: string | null;
          severity: 'urgent' | 'minor' | null;
          status: 'pending' | 'resolved';
          resolved_at: string | null;
        }[];
      };
      manager_set_issue_severity: {
        Args: { p_issue_id: number; p_severity: 'urgent' | 'minor' };
        Returns: undefined;
      };
      manager_resolve_issue: {
        Args: { p_issue_id: number };
        Returns: undefined;
      };
      manager_reopen_issue: {
        Args: { p_issue_id: number };
        Returns: undefined;
      };
      create_manager_site: {
        Args: { p_name: string; p_address: string | null; p_timezone: string; p_chain_name?: string | null };
        Returns: string;
      };
      manager_get_chain_sites: {
        Args: { p_site_id: string };
        Returns: { chain_name: string; sibling_site_id: string; sibling_name: string; sibling_address: string | null; sibling_manager_name: string | null }[];
      };
      request_manager_signup: {
        Args: { p_plan: 'trial' | 'pro' | 'business'; p_full_name: string | null };
        Returns: undefined;
      };
      request_owner_signup: {
        Args: { p_plan: 'trial' | 'pro' | 'business'; p_full_name: string | null };
        Returns: undefined;
      };
      create_owner_chain: {
        Args: { p_name: string };
        Returns: string;
      };
      complete_self_registration: {
        Args: { p_role: 'coach' | 'client'; p_site_id: string; p_full_name: string | null; p_phone?: string | null };
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
      manager_roster_emails: {
        Args: { p_site_id: string };
        Returns: { user_id: string; email: string | null }[];
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
        Returns: { date_key: string; hour: number; band: 'green' | 'amber' | 'red'; pct: number }[];
      };
      get_weekly_stats: {
        Args: { p_site_id: string; p_weeks?: number };
        Returns: { weekday: number; hour: number; band: 'green' | 'amber' | 'red'; samples: number; pct: number }[];
      };
      get_site_geofence: {
        Args: { p_site_id: string };
        Returns: { lat: number; lng: number; radius: number; proximity_radius: number }[];
      };
      manager_set_site_location: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_radius: number; p_user_agent?: string | null };
        Returns: undefined;
      };
      admin_set_site_location: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_radius: number; p_user_agent?: string | null };
        Returns: undefined;
      };
      admin_get_actions_log: {
        Args: { p_limit?: number };
        Returns: {
          id: number;
          admin_name: string | null;
          action_type: string;
          entity_type: string;
          entity_id: string;
          entity_label: string | null;
          detail: string | null;
          created_at: string;
        }[];
      };
      admin_get_gps_audit_log: {
        Args: { p_site_id?: string | null; p_limit?: number };
        Returns: {
          id: number;
          site_id: string;
          site_name: string;
          changed_by: string;
          changed_by_name: string | null;
          changed_at: string;
          old_lat: number | null;
          old_lng: number | null;
          old_radius: number | null;
          new_lat: number;
          new_lng: number;
          new_radius: number;
          user_agent: string | null;
        }[];
      };
      check_in: {
        Args: { p_site_id: string; p_lat: number; p_lng: number; p_mocked: boolean };
        Returns: number;
      };
      client_get_my_subscription: {
        Args: Record<string, never>;
        Returns: {
          needsPlanChoice: boolean;
          subscription: {
            planType: 'monthly' | 'annual';
            status: 'active' | 'grace' | 'blocked';
            startDate: string;
            expiryDate: string;
            lastPaymentDate: string;
            graceEndDate: string | null;
            warningSentAt: string | null;
          } | null;
        };
      };
      client_choose_plan: {
        Args: { p_plan: 'monthly' | 'annual' };
        Returns: undefined;
      };
      client_confirm_payment_during_grace: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      client_switch_plan: {
        Args: { p_plan: 'monthly' | 'annual' };
        Returns: undefined;
      };
      manager_get_client_subscriptions: {
        Args: Record<string, never>;
        Returns: {
          client_id: string;
          full_name: string | null;
          plan_type: 'monthly' | 'annual' | null;
          status: 'active' | 'grace' | 'blocked' | null;
          start_date: string | null;
          expiry_date: string | null;
          last_payment_date: string | null;
        }[];
      };
      manager_assign_plan: {
        Args: { p_client_id: string; p_plan: 'monthly' | 'annual' };
        Returns: undefined;
      };
      is_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      owner_chain_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      owner_get_overview: {
        Args: Record<string, never>;
        Returns: { managers: number; clients: number; coaches: number; revenueEur: number; activity7d: { day: string; count: number }[] };
      };
      owner_get_managers: {
        Args: Record<string, never>;
        Returns: {
          manager_id: string;
          full_name: string | null;
          email: string;
          phone: string | null;
          site_id: string;
          site_name: string;
          address: string | null;
          address_verified: boolean;
          client_count: number;
          coach_count: number;
          created_at: string;
        }[];
      };
      owner_get_manager_detail: {
        Args: { p_manager_id: string };
        Returns: {
          siteId: string;
          siteName: string;
          address: string | null;
          plan: 'trial' | 'pro' | 'business';
          lat: number | null;
          lng: number | null;
          radius: number;
          clients: { id: string; fullName: string | null; membershipType: 'annual' | 'monthly' | null; paymentStatus: 'paid' | 'unpaid' | null }[];
          coaches: { id: string; fullName: string | null }[];
          paidCount: number;
          unpaidCount: number;
        };
      };
      owner_set_client_payment: {
        Args: { p_client_id: string; p_type: 'annual' | 'monthly' | null; p_status: 'paid' | 'unpaid' | null };
        Returns: undefined;
      };
      owner_create_manager_record: {
        Args: { p_manager_user_id: string; p_full_name: string; p_site_name: string; p_address: string; p_lat?: number | null; p_lng?: number | null; p_phone?: string | null };
        Returns: string;
      };
      owner_get_hq: {
        Args: Record<string, never>;
        Returns: { address: string | null; lat: number | null; lng: number | null };
      };
      owner_set_hq: {
        Args: { p_address: string; p_lat?: number | null; p_lng?: number | null };
        Returns: undefined;
      };
    };
  };
}
