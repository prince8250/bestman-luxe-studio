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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          ends_at: string
          id: string
          notes: string | null
          public_token: string
          quoted_price: number
          sale_id: string | null
          seen_at: string | null
          service_id: string
          sms_status: string
          source: string
          staff_id: string
          staff_preference: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          ends_at: string
          id?: string
          notes?: string | null
          public_token: string
          quoted_price: number
          sale_id?: string | null
          seen_at?: string | null
          service_id: string
          sms_status?: string
          source: string
          staff_id: string
          staff_preference?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          ends_at?: string
          id?: string
          notes?: string | null
          public_token?: string
          quoted_price?: number
          sale_id?: string | null
          seen_at?: string | null
          service_id?: string
          sms_status?: string
          source?: string
          staff_id?: string
          staff_preference?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          reason?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          file_name: string | null
          finished_at: string | null
          id: string
          kind: string
          message: string | null
          row_counts: Json | null
          size_bytes: number | null
          started_at: string
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          message?: string | null
          row_counts?: Json | null
          size_bytes?: number | null
          started_at?: string
          status: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          message?: string | null
          row_counts?: Json | null
          size_bytes?: number | null
          started_at?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          blocked: boolean
          blocked_reason: string | null
          created_at: string
          full_name: string | null
          id: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      day_closes: {
        Row: {
          business_date: string
          cash_difference: number
          closed_at: string
          closed_by: string
          counted_cash: number
          expected_card: number
          expected_cash: number
          expected_momo: number
          expected_other: number
          id: string
          momo_reported: number | null
          note: string | null
          opening_float: number
          opening_float_reason: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          sales_count: number
        }
        Insert: {
          business_date: string
          cash_difference: number
          closed_at?: string
          closed_by: string
          counted_cash: number
          expected_card: number
          expected_cash: number
          expected_momo: number
          expected_other?: number
          id?: string
          momo_reported?: number | null
          note?: string | null
          opening_float: number
          opening_float_reason?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sales_count: number
        }
        Update: {
          business_date?: string
          cash_difference?: number
          closed_at?: string
          closed_by?: string
          counted_cash?: number
          expected_card?: number
          expected_cash?: number
          expected_momo?: number
          expected_other?: number
          id?: string
          momo_reported?: number | null
          note?: string | null
          opening_float?: number
          opening_float_reason?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sales_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_closes_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_closes_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          active: boolean
          caption: string | null
          created_at: string
          id: string
          path: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          caption?: string | null
          created_at?: string
          id?: string
          path: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          caption?: string | null
          created_at?: string
          id?: string
          path?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          ends_on: string | null
          id: string
          image_path: string | null
          service_id: string | null
          sort_order: number
          starts_on: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          image_path?: string | null
          service_id?: string | null
          sort_order?: number
          starts_on?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          image_path?: string | null
          service_id?: string | null
          sort_order?: number
          starts_on?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          occurrence_key: string | null
          payload: Json
          sale_id: string | null
          sms_error: string | null
          sms_sent_at: string | null
          sms_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          occurrence_key?: string | null
          payload?: Json
          sale_id?: string | null
          sms_error?: string | null
          sms_sent_at?: string | null
          sms_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          occurrence_key?: string | null
          payload?: Json
          sale_id?: string | null
          sms_error?: string | null
          sms_sent_at?: string | null
          sms_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_alerts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          activity_seen_at: string | null
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          activity_seen_at?: string | null
          created_at?: string
          display_name: string
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          activity_seen_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      receipt_prints: {
        Row: {
          id: string
          printed_at: string
          printed_by: string
          sale_id: string
        }
        Insert: {
          id?: string
          printed_at?: string
          printed_by: string
          sale_id: string
        }
        Update: {
          id?: string
          printed_at?: string
          printed_by?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_prints_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_prints_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          item_name: string
          line_no: number
          line_total: number
          list_price: number
          price_override_reason: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          staff_id: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          item_name: string
          line_no: number
          line_total: number
          list_price: number
          price_override_reason?: string | null
          quantity?: number
          sale_id: string
          service_id?: string | null
          staff_id?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          item_name?: string
          line_no?: number
          line_total?: number
          list_price?: number
          price_override_reason?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          staff_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string
          reference: string | null
          sale_id: string
          tendered: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method: string
          reference?: string | null
          sale_id: string
          tendered?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string
          reference?: string | null
          sale_id?: string
          tendered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          after_close: boolean
          appointment_id: string | null
          business_date: string
          channel: string
          client_request_id: string
          created_by: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_total: number
          id: string
          is_backdated: boolean
          note: string | null
          paid_at: string
          receipt_no: string
          recorded_at: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          after_close?: boolean
          appointment_id?: string | null
          business_date: string
          channel?: string
          client_request_id: string
          created_by: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_total?: number
          id?: string
          is_backdated?: boolean
          note?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_at?: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          after_close?: boolean
          appointment_id?: string | null
          business_date?: string
          channel?: string
          client_request_id?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_total?: number
          id?: string
          is_backdated?: boolean
          note?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_at?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_fk"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_path: string | null
          name: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_path?: string | null
          name: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_path?: string | null
          name?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_staff: {
        Row: {
          service_id: string
          staff_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          archived_at: string | null
          bookable_online: boolean
          category_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_path: string | null
          name: string
          price: number
          show_on_website: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          bookable_online?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          image_path?: string | null
          name: string
          price: number
          show_on_website?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          bookable_online?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_path?: string | null
          name?: string
          price?: number
          show_on_website?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_in_events: {
        Row: {
          id: string
          profile_id: string
          signed_in_at: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          signed_in_at?: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          signed_in_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_in_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          archived_at: string | null
          bio: string | null
          bookable_online: boolean
          created_at: string
          id: string
          name: string
          phone: string | null
          photo_path: string | null
          show_on_website: boolean
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          bio?: string | null
          bookable_online?: boolean
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          photo_path?: string | null
          show_on_website?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          bio?: string | null
          bookable_online?: boolean
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          photo_path?: string | null
          show_on_website?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_hours: {
        Row: {
          end_time: string
          id: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          reason: string | null
          staff_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          reason?: string | null
          staff_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          reason?: string | null
          staff_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          about_text: string | null
          address: string | null
          alert_settings: Json
          booking_lead_minutes: number
          booking_sound: boolean
          cash_difference_tolerance: number
          counter_backdate_days: number
          daily_sms_cap: number
          default_opening_float: number
          id: boolean
          map_url: string | null
          max_counter_discount_percent: number
          max_upcoming_per_phone: number
          opening_hours: Json
          override_alert_threshold: number
          owner_alert_phone: string | null
          phone: string | null
          receipt_copies: number
          receipt_footer: string | null
          receipt_header: string | null
          slot_interval_minutes: number
          social_links: Json
          studio_name: string
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          alert_settings?: Json
          booking_lead_minutes?: number
          booking_sound?: boolean
          cash_difference_tolerance?: number
          counter_backdate_days?: number
          daily_sms_cap?: number
          default_opening_float?: number
          id?: boolean
          map_url?: string | null
          max_counter_discount_percent?: number
          max_upcoming_per_phone?: number
          opening_hours?: Json
          override_alert_threshold?: number
          owner_alert_phone?: string | null
          phone?: string | null
          receipt_copies?: number
          receipt_footer?: string | null
          receipt_header?: string | null
          slot_interval_minutes?: number
          social_links?: Json
          studio_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          about_text?: string | null
          address?: string | null
          alert_settings?: Json
          booking_lead_minutes?: number
          booking_sound?: boolean
          cash_difference_tolerance?: number
          counter_backdate_days?: number
          daily_sms_cap?: number
          default_opening_float?: number
          id?: boolean
          map_url?: string | null
          max_counter_discount_percent?: number
          max_upcoming_per_phone?: number
          opening_hours?: Json
          override_alert_threshold?: number
          owner_alert_phone?: string | null
          phone?: string | null
          receipt_copies?: number
          receipt_footer?: string | null
          receipt_header?: string | null
          slot_interval_minutes?: number
          social_links?: Json
          studio_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      void_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string
          requested_by: string
          sale_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason: string
          requested_by: string
          sale_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string
          requested_by?: string
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "void_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_requests_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_staff: {
        Row: {
          bio: string | null
          bookable_online: boolean | null
          id: string | null
          name: string | null
          photo_path: string | null
          sort_order: number | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          bookable_online?: boolean | null
          id?: string | null
          name?: string | null
          photo_path?: string | null
          sort_order?: number | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          bookable_online?: boolean | null
          id?: string | null
          name?: string | null
          photo_path?: string | null
          sort_order?: number | null
          title?: string | null
        }
        Relationships: []
      }
      public_studio_settings: {
        Row: {
          about_text: string | null
          address: string | null
          map_url: string | null
          opening_hours: Json | null
          phone: string | null
          social_links: Json | null
          studio_name: string | null
          whatsapp: string | null
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          map_url?: string | null
          opening_hours?: Json | null
          phone?: string | null
          social_links?: Json | null
          studio_name?: string | null
          whatsapp?: string | null
        }
        Update: {
          about_text?: string | null
          address?: string | null
          map_url?: string | null
          opening_hours?: Json | null
          phone?: string | null
          social_links?: Json | null
          studio_name?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_void_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      close_day: {
        Args: {
          p_business_date: string
          p_counted_cash: number
          p_momo_reported: number
          p_note: string
          p_opening_float: number
          p_opening_float_reason?: string
        }
        Returns: Json
      }
      create_appointment: { Args: { payload: Json }; Returns: Json }
      create_sale: { Args: { payload: Json }; Returns: Json }
      customer_detail: { Args: { p_customer_id: string }; Returns: Json }
      customer_lookup: { Args: { p_phone: string }; Returns: Json }
      decide_void_request: {
        Args: { p_approve: boolean; p_note: string; p_request_id: string }
        Returns: undefined
      }
      edit_sale_item: {
        Args: {
          p_changes: Json
          p_item_id: string
          p_payment_adjustment: Json
          p_reason: string
        }
        Returns: Json
      }
      end_user_sessions: { Args: { p_user_id: string }; Returns: number }
      mark_no_show: { Args: { p_appointment_id: string }; Returns: undefined }
      rate_limit_clear: { Args: { p_key: string }; Returns: undefined }
      rate_limit_count: {
        Args: { p_key: string; p_window_seconds: number }
        Returns: number
      }
      rate_limit_hit: {
        Args: { p_key: string; p_window_seconds: number }
        Returns: number
      }
      reassign_sale_item_staff: {
        Args: { p_item_id: string; p_new_staff_id: string; p_reason: string }
        Returns: undefined
      }
      receipt_data: { Args: { p_sale_id: string }; Returns: Json }
      record_receipt_print: { Args: { p_sale_id: string }; Returns: number }
      remove_sample_data: { Args: { p_keep_catalog?: boolean }; Returns: Json }
      reopen_day: {
        Args: { p_business_date: string; p_reason: string }
        Returns: undefined
      }
      reorder_rows: {
        Args: { p_ids: string[]; p_table: string }
        Returns: undefined
      }
      report_after_close: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_backdated: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_category: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_channel: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_counter_user: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_day: { Args: { p_from: string; p_to: string }; Returns: Json }
      report_by_payment_method: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_service: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_by_staff: { Args: { p_from: string; p_to: string }; Returns: Json }
      report_by_weekday: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_changes: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: Json
      }
      report_day_close: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_day_close_export: {
        Args: { p_business_date: string }
        Returns: Json
      }
      report_repeat_customers: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_summary: { Args: { p_from: string; p_to: string }; Returns: Json }
      report_void_requests: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      report_voids: { Args: { p_from: string; p_to: string }; Returns: Json }
      request_void: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: string
      }
      sale_detail: { Args: { p_sale_id: string }; Returns: Json }
      sample_data_summary: { Args: never; Returns: Json }
      save_service: { Args: { payload: Json }; Returns: string }
      search_customers: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_phone?: string
          p_query?: string
        }
        Returns: Json
      }
      search_sales: { Args: { p_filters?: Json }; Returns: Json }
      update_service_prices: { Args: { changes: Json }; Returns: number }
      void_sale: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
