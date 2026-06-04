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
      app_config: {
        Row: {
          admin_user_id: string | null
          created_at: string
          cta_copy: Json
          favicon_url: string | null
          feature_flags: Json
          footer_content: Json
          genre_config: Json
          google_analytics_id: string | null
          hero_video_type: string | null
          hero_video_url: string | null
          id: number
          live_stream_url: string | null
          meta_pixel_id: string | null
          og_image_url: string | null
          site_description: string | null
          site_tagline: string | null
          site_title: string | null
          top_ticker: Json
          updated_at: string
          youtube_api_key: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          cta_copy?: Json
          favicon_url?: string | null
          feature_flags?: Json
          footer_content?: Json
          genre_config?: Json
          google_analytics_id?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: number
          live_stream_url?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          site_description?: string | null
          site_tagline?: string | null
          site_title?: string | null
          top_ticker?: Json
          updated_at?: string
          youtube_api_key?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          cta_copy?: Json
          favicon_url?: string | null
          feature_flags?: Json
          footer_content?: Json
          genre_config?: Json
          google_analytics_id?: string | null
          hero_video_type?: string | null
          hero_video_url?: string | null
          id?: number
          live_stream_url?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          site_description?: string | null
          site_tagline?: string | null
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
      episodes: {
        Row: {
          archived: boolean
          created_at: string
          description: string
          description_ar: string | null
          duration: number | null
          episode_number: number
          fts: unknown
          id: string
          season_id: string
          show_id: string
          status: string
          title: string
          title_ar: string | null
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string
          description_ar?: string | null
          duration?: number | null
          episode_number: number
          fts?: unknown
          id?: string
          season_id: string
          show_id: string
          status?: string
          title: string
          title_ar?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string
          description_ar?: string | null
          duration?: number | null
          episode_number?: number
          fts?: unknown
          id?: string
          season_id?: string
          show_id?: string
          status?: string
          title?: string
          title_ar?: string | null
          updated_at?: string
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
          created_at: string
          id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer?: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
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
      legal_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          interests: Json
          normalized_email: string
          notification_error: string | null
          notification_status: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          interests?: Json
          normalized_email: string
          notification_error?: string | null
          notification_status?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          interests?: Json
          normalized_email?: string
          notification_error?: string | null
          notification_status?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
          created_at: string | null
          duration_seconds: number | null
          expires_at: string | null
          genre: string | null
          id: string
          is_featured: boolean
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          youtube_video_id: string
        }
        Insert: {
          archived?: boolean | null
          channel_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          youtube_video_id: string
        }
        Update: {
          archived?: boolean | null
          channel_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          genre?: string | null
          id?: string
          is_featured?: boolean
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
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
          broadcast_day: string | null
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
          broadcast_day?: string | null
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
          broadcast_day?: string | null
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
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
