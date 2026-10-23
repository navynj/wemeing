export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      lane_mappings: {
        Row: {
          created_at: string
          id: string
          my_category_id: string
          pool_lane_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          my_category_id: string
          pool_lane_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          my_category_id?: string
          pool_lane_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lane_mappings_my_category_id_fkey"
            columns: ["my_category_id"]
            isOneToOne: false
            referencedRelation: "my_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lane_mappings_pool_lane_id_fkey"
            columns: ["pool_lane_id"]
            isOneToOne: false
            referencedRelation: "pool_lanes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lane_mappings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      links: {
        Row: {
          created_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          list_id: string
          member_id: string
        }
        Insert: {
          list_id: string
          member_id: string
        }
        Update: {
          list_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      my_categories: {
        Row: {
          created_at: string
          default_mode: Database["public"]["Enums"]["ripple_mode"]
          icon: string | null
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          default_mode?: Database["public"]["Enums"]["ripple_mode"]
          icon?: string | null
          id?: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          default_mode?: Database["public"]["Enums"]["ripple_mode"]
          icon?: string | null
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "my_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_lanes: {
        Row: {
          icon: string | null
          id: string
          name: string
          pool_id: string
          position: number
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          pool_id: string
          position?: number
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          pool_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_lanes_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          joined_at: string
          pool_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          pool_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          pool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          born_from_splash: string | null
          created_at: string
          ephemeral: boolean
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          born_from_splash?: string | null
          created_at?: string
          ephemeral?: boolean
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          born_from_splash?: string | null
          created_at?: string
          ephemeral?: boolean
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_born_from_splash_fkey"
            columns: ["born_from_splash"]
            isOneToOne: false
            referencedRelation: "splashes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          last_active_at: string
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          last_active_at?: string
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_active_at?: string
          timezone?: string
        }
        Relationships: []
      }
      ripple_audience: {
        Row: {
          list_id: string | null
          pool_id: string | null
          ripple_id: string
          target_type: Database["public"]["Enums"]["audience_target"]
        }
        Insert: {
          list_id?: string | null
          pool_id?: string | null
          ripple_id: string
          target_type: Database["public"]["Enums"]["audience_target"]
        }
        Update: {
          list_id?: string | null
          pool_id?: string | null
          ripple_id?: string
          target_type?: Database["public"]["Enums"]["audience_target"]
        }
        Relationships: [
          {
            foreignKeyName: "ripple_audience_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripple_audience_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripple_audience_ripple_id_fkey"
            columns: ["ripple_id"]
            isOneToOne: false
            referencedRelation: "ripples"
            referencedColumns: ["id"]
          },
        ]
      }
      ripple_views: {
        Row: {
          ripple_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          ripple_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          ripple_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ripple_views_ripple_id_fkey"
            columns: ["ripple_id"]
            isOneToOne: false
            referencedRelation: "ripples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripple_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ripples: {
        Row: {
          author_id: string
          category_id: string
          created_at: string
          ended_at: string | null
          id: string
          media: string[]
          note: string | null
          occurred_on: string | null
          occurred_time: string | null
          parent_ripple_id: string | null
          participants: string[]
          planned: boolean
          splash_id: string | null
          started_at: string | null
        }
        Insert: {
          author_id: string
          category_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          media?: string[]
          note?: string | null
          occurred_on?: string | null
          occurred_time?: string | null
          parent_ripple_id?: string | null
          participants?: string[]
          planned?: boolean
          splash_id?: string | null
          started_at?: string | null
        }
        Update: {
          author_id?: string
          category_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          media?: string[]
          note?: string | null
          occurred_on?: string | null
          occurred_time?: string | null
          parent_ripple_id?: string | null
          participants?: string[]
          planned?: boolean
          splash_id?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ripples_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripples_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "my_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripples_parent_ripple_id_fkey"
            columns: ["parent_ripple_id"]
            isOneToOne: false
            referencedRelation: "ripples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ripples_splash_id_fkey"
            columns: ["splash_id"]
            isOneToOne: false
            referencedRelation: "splashes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          declared_end: string | null
          declared_start: string | null
          id: string
          kind: Database["public"]["Enums"]["session_kind"]
          lane_id: string | null
          month: string | null
          owner_id: string
          title: string
        }
        Insert: {
          created_at?: string
          declared_end?: string | null
          declared_start?: string | null
          id?: string
          kind: Database["public"]["Enums"]["session_kind"]
          lane_id?: string | null
          month?: string | null
          owner_id: string
          title: string
        }
        Update: {
          created_at?: string
          declared_end?: string | null
          declared_start?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["session_kind"]
          lane_id?: string | null
          month?: string | null
          owner_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "my_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      splashes: {
        Row: {
          created_at: string
          declared_end: string | null
          declared_lane_id: string | null
          declared_start: string | null
          ends_at: string | null
          icon: string | null
          id: string
          owner_id: string
          pinned_at: string | null
          pool_id: string | null
          prompt: string | null
          session_id: string | null
          title: string
          type: Database["public"]["Enums"]["splash_type"]
        }
        Insert: {
          created_at?: string
          declared_end?: string | null
          declared_lane_id?: string | null
          declared_start?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          owner_id: string
          pinned_at?: string | null
          pool_id?: string | null
          prompt?: string | null
          session_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["splash_type"]
        }
        Update: {
          created_at?: string
          declared_end?: string | null
          declared_lane_id?: string | null
          declared_start?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          owner_id?: string
          pinned_at?: string | null
          pool_id?: string | null
          prompt?: string | null
          session_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["splash_type"]
        }
        Relationships: [
          {
            foreignKeyName: "splashes_created_by_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splashes_declared_lane_id_fkey"
            columns: ["declared_lane_id"]
            isOneToOne: false
            referencedRelation: "my_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splashes_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "splashes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_ripple: { Args: { rid: string }; Returns: boolean }
      is_linked: { Args: { other: string }; Returns: boolean }
      record_ripple_view: { Args: { rid: string }; Returns: undefined }
      ripple_author: { Args: { rid: string }; Returns: string }
      ripple_is_locked: { Args: { rid: string }; Returns: boolean }
      ripple_span: {
        Args: { ended: string; started: string }
        Returns: unknown
      }
    }
    Enums: {
      audience_target: "list" | "pool" | "lock"
      ripple_mode: "drop" | "timed"
      session_kind: "monthly" | "custom"
      splash_type: "free" | "prompted"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audience_target: ["list", "pool", "lock"],
      ripple_mode: ["drop", "timed"],
      session_kind: ["monthly", "custom"],
      splash_type: ["free", "prompted"],
    },
  },
} as const

