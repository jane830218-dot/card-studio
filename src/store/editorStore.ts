import { create } from "zustand";
import { TEMPLATES } from "../templates/templates";
import type { CardLayer, FieldValues } from "../templates/types";

function defaultFieldsFor(templateId: string): FieldValues {
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  const values: FieldValues = {};
  tpl.fields.forEach((f) => {
    values[f.key] = f.default;
  });
  return values;
}

interface EditorState {
  activeTemplateId: string;
  fieldValues: FieldValues;
  /** 使用者上傳的原始照片（未經過 Fabric.js 定位面板調整），沿用 demo 原本的自動裁切公式當預設效果 */
  rawUploadedImg: HTMLImageElement | null;
  /** 使用者用 Fabric.js 定位面板調整完、已經烘焙成版型插槽尺寸的結果；存在時優先於自動裁切公式 */
  positionedOverride: HTMLImageElement | null;
  activeLayerIdx: number | null;
  showSafeFrame: boolean;
  layers: CardLayer[];
  setTemplate: (id: string) => void;
  setField: (key: string, value: string | boolean) => void;
  setRawUploadedImg: (img: HTMLImageElement | null) => void;
  setPositionedOverride: (img: HTMLImageElement | null) => void;
  setActiveLayerIdx: (idx: number | null) => void;
  toggleSafeFrame: () => void;
  loadCard: (templateId: string, fieldValues: FieldValues) => void;
  setLayers: (layers: CardLayer[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTemplateId: TEMPLATES[0].id,
  fieldValues: defaultFieldsFor(TEMPLATES[0].id),
  rawUploadedImg: null,
  positionedOverride: null,
  activeLayerIdx: null,
  showSafeFrame: false,
  layers: [],
  setLayers: (layers) => set({ layers }),
  setTemplate: (id) =>
    set({
      activeTemplateId: id,
      fieldValues: defaultFieldsFor(id),
      rawUploadedImg: null,
      positionedOverride: null,
      activeLayerIdx: null,
    }),
  setField: (key, value) =>
    set((state) => ({ fieldValues: { ...state.fieldValues, [key]: value } })),
  setRawUploadedImg: (img) => set({ rawUploadedImg: img, positionedOverride: null }),
  setPositionedOverride: (img) => set({ positionedOverride: img }),
  setActiveLayerIdx: (idx) => set({ activeLayerIdx: idx }),
  toggleSafeFrame: () => set((state) => ({ showSafeFrame: !state.showSafeFrame })),
  loadCard: (templateId, fieldValues) =>
    set({
      activeTemplateId: templateId,
      fieldValues,
      rawUploadedImg: null,
      positionedOverride: null,
      activeLayerIdx: null,
    }),
}));
