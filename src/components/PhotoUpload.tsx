import { useEditorStore } from "../store/editorStore";
import PhotoPositioner from "./PhotoPositioner";
import { getTemplateById } from "../templates/templates";

export default function PhotoUpload() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const setRawUploadedImg = useEditorStore((s) => s.setRawUploadedImg);
  const tpl = getTemplateById(activeTemplateId);

  if (!tpl?.imageSlot) {
    return (
      <div className="hint">此版型的照片已經固定烤在底圖裡，不需要另外上傳。</div>
    );
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => setRawUploadedImg(img);
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="field-label">上傳人物 / 前景圖片（選填）</label>
      <input type="file" accept="image/*" onChange={onChange} />
      <div className="hint">正式系統會依版型自動裁切、去背套用；這裡上傳只是方便預覽構圖，輸出的透明底 PNG 不含這張照片。</div>
      <PhotoPositioner />
    </div>
  );
}
