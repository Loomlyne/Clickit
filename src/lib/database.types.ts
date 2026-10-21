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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          added_at: string
          added_by: string | null
          display_name: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          display_name: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          admin_user_id: string | null
          created_at: string
          cta_copy: Json
          favicon_dark_url: string | null
          favicon_url: string | null
          feature_flags: Json
          footer_content: Json
          genre_config: Json
          google_analytics_id: string | null
          hero_description: string | null
          hero_description_ar: string | null
          hero_video_type: string | null
          hero_video_url: string | null
          id: number
          live_stream_url: string | null
          meta_pixel_id: string | null
          og_image_url: string | null
          portfolio_heading: string | null
          portfolio_heading_ar: string | null
          site_description: string | null
          site_description_ar: string | null
          site_tagline: string | null
          site_tagline_ar: string | null
          site_title: string | null
          top_ticker: Json
          updated_at: string
          youtube_api_key: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          cta_copy?: Json
          favicon_dark_url?: string | null
          favicon_url?: string | null
          feature_flags?: Json
          footer_content?: Json
          genre_config?: Json
          google_analytics_id?: string | null
          hero_description?: string | null
          hero_description_ar?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: number
          live_stream_url?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          portfolio_heading?: string | null
          portfolio_heading_ar?: string | null
          site_description?: string | null
          site_description_ar?: string | null
          site_tagline?: string | null
          site_tagline_ar?: string | null
          site_title?: string | null
          top_ticker?: Json
          updated_at?: string
          youtube_api_key?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          cta_copy?: Json
          favicon_dark_url?: string | null
          favicon_url?: string | null
          feature_flags?: Json
          footer_content?: Json
          genre_config?: Json
          google_analytics_id?: string | null
          hero_description?: string | null
          hero_description_ar?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: number
          live_stream_url?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          portfolio_heading?: string | null
          portfolio_heading_ar?: string | null
          site_description?: string | null
          site_description_ar?: string | null
          site_tagline?: string | null
          site_tagline_ar?: string | null
          site_title?: string | null
          top_ticker?: Json
          updated_at?: string
          youtube_api_key?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name_ar: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      digest_runs: {
        Row: {
          created_at: string | null
          emails: number
          id: string
          status: string
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string | null
          emails?: number
          id?: string
          status: string
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string | null
          emails?: number
          id?: string
          status?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          show_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          show_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          show_id?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          first_attempt_at: string | null
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          lease_until: string | null
          locale: string
          next_attempt_at: string | null
          payload: Json
          provider_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: string
          to_email: string | null
          to_user: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key: string
          kind: string
          last_error?: string | null
          lease_until?: string | null
          locale?: string
          next_attempt_at?: string | null
          payload?: Json
          provider_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string
          to_email?: string | null
          to_user?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          lease_until?: string | null
          locale?: string
          next_attempt_at?: string | null
          payload?: Json
          provider_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string
          to_email?: string | null
          to_user?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          archived: boolean
          created_at: string
          description: string
          description_ar: string | null
          description_ar_edited: boolean
          description_edited: boolean
          duration: number | null
          episode_number: number
          fts: unknown
          id: string
          live_at: string | null
          player_error_at: string | null
          player_error_code: number | null
          publish_at: string | null
          season_id: string
          show_id: string
          status: string
          title: string
          title_ar: string | null
          title_ar_edited: boolean
          title_edited: boolean
          updated_at: string
          youtube_checked_at: string | null
          youtube_duration_seconds: number | null
          youtube_status: string | null
          youtube_text_baseline_at: string | null
          youtube_video_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string
          description_ar?: string | null
          description_ar_edited?: boolean
          description_edited?: boolean
          duration?: number | null
          episode_number: number
          fts?: unknown
          id?: string
          live_at?: string | null
          player_error_at?: string | null
          player_error_code?: number | null
          publish_at?: string | null
          season_id: string
          show_id: string
          status?: string
          title: string
          title_ar?: string | null
          title_ar_edited?: boolean
          title_edited?: boolean
          updated_at?: string
          youtube_checked_at?: string | null
          youtube_duration_seconds?: number | null
          youtube_status?: string | null
          youtube_text_baseline_at?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string
          description_ar?: string | null
          description_ar_edited?: boolean
          description_edited?: boolean
          duration?: number | null
          episode_number?: number
          fts?: unknown
          id?: string
          live_at?: string | null
          player_error_at?: string | null
          player_error_code?: number | null
          publish_at?: string | null
          season_id?: string
          show_id?: string
          status?: string
          title?: string
          title_ar?: string | null
          title_ar_edited?: boolean
          title_edited?: boolean
          updated_at?: string
          youtube_checked_at?: string | null
          youtube_duration_seconds?: number | null
          youtube_status?: string | null
          youtube_text_baseline_at?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          answer_ar: string | null
          created_at: string
          id: string
          question: string
          question_ar: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer?: string
          answer_ar?: string | null
          created_at?: string
          id?: string
          question: string
          question_ar?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          answer_ar?: string | null
          created_at?: string
          id?: string
          question?: string
          question_ar?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          ar_reviewed: boolean
          content: string
          content_ar: string | null
          content_ar_draft: string | null
          created_at: string
          id: string
          slug: string
          sort_order: number
          title: string
          title_ar: string | null
          title_ar_draft: string | null
          updated_at: string
        }
        Insert: {
          ar_reviewed?: boolean
          content?: string
          content_ar?: string | null
          content_ar_draft?: string | null
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          title_ar?: string | null
          title_ar_draft?: string | null
          updated_at?: string
        }
        Update: {
          ar_reviewed?: boolean
          content?: string
          content_ar?: string | null
          content_ar_draft?: string | null
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          title_ar?: string | null
          title_ar_draft?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirm_sent_at: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          interests: Json
          locale: string
          normalized_email: string
          notification_error: string | null
          notification_status: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          confirm_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          interests?: Json
          locale?: string
          normalized_email: string
          notification_error?: string | null
          notification_status?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirm_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          interests?: Json
          locale?: string
          normalized_email?: string
          notification_error?: string | null
          notification_status?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_sends: {
        Row: {
          episode_id: string
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          episode_id: string
          kind?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          episode_id?: string
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_sends_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_sends_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes_view"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string | null
          notify_new_episodes: boolean
          onboarded_at: string | null
          password_set_at: string | null
          updated_at: string
          welcome_sent_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string | null
          notify_new_episodes?: boolean
          onboarded_at?: string | null
          password_set_at?: string | null
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string | null
          notify_new_episodes?: boolean
          onboarded_at?: string | null
          password_set_at?: string | null
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          show_id: string
          stars: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          show_id: string
          stars: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          show_id?: string
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          episode_count: number
          id: string
          season_number: number
          show_id: string
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_count?: number
          id?: string
          season_number: number
          show_id: string
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_count?: number
          id?: string
          season_number?: number
          show_id?: string
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts: {
        Row: {
          archived: boolean | null
          channel_name: string | null
          channel_name_edited: boolean
          created_at: string | null
          duration_seconds: number | null
          expires_at: string | null
          genre: string | null
          id: string
          is_featured: boolean | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          title_edited: boolean
          updated_at: string | null
          youtube_checked_at: string | null
          youtube_video_id: string
        }
        Insert: {
          archived?: boolean | null
          channel_name?: string | null
          channel_name_edited?: boolean
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          title_edited?: boolean
          updated_at?: string | null
          youtube_checked_at?: string | null
          youtube_video_id: string
        }
        Update: {
          archived?: boolean | null
          channel_name?: string | null
          channel_name_edited?: boolean
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          title_edited?: boolean
          updated_at?: string | null
          youtube_checked_at?: string | null
          youtube_video_id?: string
        }
        Relationships: []
      }
      show_cast: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          role: string | null
          show_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          role?: string | null
          show_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          role?: string | null
          show_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "show_cast_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_categories: {
        Row: {
          category_id: string
          created_at: string
          show_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          show_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          archived: boolean
          brand_color: string
          broadcast_day: string[] | null
          broadcast_time: string | null
          card_image_url: string | null
          created_at: string
          description: string
          description_ar: string | null
          episode_count: number
          featured: boolean
          fts: unknown
          genre: string
          hero_image_mobile_url: string | null
          hero_url: string | null
          hero_video_mobile_type: string | null
          hero_video_mobile_url: string | null
          hero_video_type: string | null
          hero_video_url: string | null
          id: string
          logo_url: string | null
          poster_url: string | null
          season_count: number
          slug: string
          sort_order: number
          status: string
          tagline: string | null
          tagline_ar: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          brand_color?: string
          broadcast_day?: string[] | null
          broadcast_time?: string | null
          card_image_url?: string | null
          created_at?: string
          description?: string
          description_ar?: string | null
          episode_count?: number
          featured?: boolean
          fts?: unknown
          genre: string
          hero_image_mobile_url?: string | null
          hero_url?: string | null
          hero_video_mobile_type?: string | null
          hero_video_mobile_url?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: string
          logo_url?: string | null
          poster_url?: string | null
          season_count?: number
          slug: string
          sort_order?: number
          status?: string
          tagline?: string | null
          tagline_ar?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          brand_color?: string
          broadcast_day?: string[] | null
          broadcast_time?: string | null
          card_image_url?: string | null
          created_at?: string
          description?: string
          description_ar?: string | null
          episode_count?: number
          featured?: boolean
          fts?: unknown
          genre?: string
          hero_image_mobile_url?: string | null
          hero_url?: string | null
          hero_video_mobile_type?: string | null
          hero_video_mobile_url?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: string
          logo_url?: string | null
          poster_url?: string | null
          season_count?: number
          slug?: string
          sort_order?: number
          status?: string
          tagline?: string | null
          tagline_ar?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          notification_error: string | null
          notification_status: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          notification_error?: string | null
          notification_status?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          notification_error?: string | null
          notification_status?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          show_id?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          completed: boolean
          episode_id: string
          id: string
          progress_seconds: number
          user_id: string
          watched_at: string
        }
        Insert: {
          completed?: boolean
          episode_id: string
          id?: string
          progress_seconds?: number
          user_id: string
          watched_at?: string
        }
        Update: {
          completed?: boolean
          episode_id?: string
          id?: string
          progress_seconds?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      watch_progress: {
        Row: {
          completed: boolean
          duration_seconds: number | null
          episode_id: string
          progress_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_seconds?: number | null
          episode_id: string
          progress_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_seconds?: number | null
          episode_id?: string
          progress_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      episodes_view: {
        Row: {
          archived: boolean | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          duration: number | null
          episode_number: number | null
          id: string | null
          publish_at: string | null
          season_id: string | null
          show_brand_color: string | null
          show_id: string | null
          show_poster_url: string | null
          show_slug: string | null
          show_status: string | null
          show_title: string | null
          status: string | null
          title: string | null
          title_ar: string | null
          updated_at: string | null
          youtube_video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      am_i_admin: { Args: never; Returns: boolean }
      build_digest: { Args: { p_now?: string }; Returns: string[] }
      claim_outbox: {
        Args: { p_ids: string[] }
        Returns: {
          attempts: number
          first_attempt_at: string
          id: string
          idempotency_key: string
          kind: string
          locale: string
          payload: Json
          reply_to: string
          to_address: string
          to_user: string
        }[]
      }
      claim_welcome: {
        Args: { p_locale?: string; p_user: string }
        Returns: string
      }
      enqueue_email: {
        Args: {
          p_admin_all?: boolean
          p_key: string
          p_kind: string
          p_locale?: string
          p_payload?: Json
          p_reply_to?: string
          p_to_email?: string
          p_to_user?: string
        }
        Returns: {
          id: string
          outcome: string
        }[]
      }
      finish_outbox: { Args: { p_results: Json }; Returns: number }
      get_youtube_key: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      list_admins: {
        Args: never
        Returns: {
          display_name: string
          email: string
          has_totp: boolean
          last_sign_in_at: string
          user_id: string
        }[]
      }
      record_short_checks: { Args: { p_rows: Json }; Returns: number }
      record_youtube_checks: { Args: { p_rows: Json }; Returns: number }
      renumber_season: {
        Args: { p_season_id: string }
        Returns: {
          episode_id: string
          new_number: number
          old_number: number
        }[]
      }
      set_youtube_key: { Args: { p_key: string }; Returns: string }
      sweep_outbox: { Args: { p_limit?: number }; Returns: string[] }
      youtube_key_meta: {
        Args: never
        Returns: {
          has_key: boolean
          last4: string
          updated_at: string
        }[]
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
    Enums: {},
  },
} as const
