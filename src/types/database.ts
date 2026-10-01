import type {
  Area,
  AreaInsert,
  AreaUpdate,
  MasterTask,
  MasterTaskInsert,
  MasterTaskUpdate,
  ScheduleBlock,
  ScheduleBlockInsert,
  ScheduleBlockUpdate,
  TaskFile,
  TaskFileInsert,
  TaskFileUpdate,
} from './domain.ts'

/** Esquema de Supabase para tipar `createClient<Database>()`; refleja supabase/migrations/0001_core_schema.sql. */
export type Database = {
  public: {
    Tables: {
      areas: {
        Row: Area
        Insert: AreaInsert
        Update: AreaUpdate
        Relationships: []
      }
      master_tasks: {
        Row: MasterTask
        Insert: MasterTaskInsert
        Update: MasterTaskUpdate
        Relationships: [
          {
            foreignKeyName: 'master_tasks_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_blocks: {
        Row: ScheduleBlock
        Insert: ScheduleBlockInsert
        Update: ScheduleBlockUpdate
        Relationships: [
          {
            foreignKeyName: 'schedule_blocks_master_task_id_fkey'
            columns: ['master_task_id']
            isOneToOne: false
            referencedRelation: 'master_tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_blocks_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      task_files: {
        Row: TaskFile
        Insert: TaskFileInsert
        Update: TaskFileUpdate
        Relationships: [
          {
            foreignKeyName: 'task_files_master_task_id_fkey'
            columns: ['master_task_id']
            isOneToOne: false
            referencedRelation: 'master_tasks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
