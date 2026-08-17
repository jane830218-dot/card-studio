import { supabase } from "./supabaseClient";
import type { FieldValues } from "../templates/types";

export interface SavedCardRow {
  id: string;
  name: string;
  template_id: string;
  field_values: FieldValues;
  created_at: string;
  updated_at: string;
}

export async function listCards(): Promise<SavedCardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cards")
    .select("id,name,template_id,field_values,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as SavedCardRow[];
}

export async function saveCard(name: string, templateId: string, fieldValues: FieldValues): Promise<SavedCardRow> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { data, error } = await supabase
    .from("cards")
    .insert({ name, template_id: templateId, field_values: fieldValues })
    .select()
    .single();
  if (error) throw error;
  return data as SavedCardRow;
}

export async function deleteCard(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}
