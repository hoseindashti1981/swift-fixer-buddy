import { useState } from "react";
import {
  backupPreview,
  exportLibrary,
  importLibrary,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreDamagedLibrary,
  exportRecovery,
} from "@/lib/library-storage";
import { useLibraryState } from "@/lib/library-hooks";
export function LibraryBackup() {
  const { data, error } = useLibraryState();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof backupPreview> | null>(null);
  const [replace, setReplace] = useState(false);
  const [repair, setRepair] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details
      className="mt-4 rounded-xl border border-border p-3 text-sm leading-7"
      open={error ? true : undefined}
    >
      <summary className="min-h-11 cursor-pointer py-2 font-bold">پشتیبان و داده‌های من</summary>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <p className="text-muted-foreground">
        {data?.notes.length ?? "—"} یادداشت، {data?.favorites.length ?? "—"} علاقه‌مندی و{" "}
        {data?.history.length ?? "—"} جست‌وجوی اخیر. فایل پشتیبان یادداشت‌های شخصی، نشان‌ها و محل
        مطالعهٔ کلاس را هم نگه می‌دارد.
      </p>
      <button
        disabled={!data}
        className="mt-3 min-h-12 w-full rounded-xl border border-primary text-primary disabled:opacity-50"
        onClick={() => {
          try {
            const url = URL.createObjectURL(
              new Blob([exportLibrary()], { type: "application/json" }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "repair-library-" + new Date().toISOString().slice(0, 10) + ".json";
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("فایل پشتیبان آماده دریافت شد.");
          } catch {
            setMessage("خروجی گرفته نشد؛ وضعیت حافظه را بررسی کنید.");
          }
        }}
      >
        دریافت فایل پشتیبان
      </button>
      <button
        className="mt-2 min-h-11 w-full text-primary"
        onClick={() => {
          try {
            const url = URL.createObjectURL(
              new Blob([exportRecovery()], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "repair-library-before-import.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("نسخه پیش از آخرین ورود آماده دریافت شد.");
          } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : "نسخه قبلی خوانده نشد.");
          }
        }}
      >
        دریافت نسخه پیش از آخرین ورود
      </button>
      <label className="mt-4 block">
        انتخاب فایل برای بازیابی (حداکثر ۱۰ مگابایت)
        <input
          type="file"
          accept=".json,application/json"
          disabled={!data && !error}
          className="mt-2 block w-full min-w-0 text-xs"
          onChange={async (event) => {
            setRaw("");
            setPreview(null);
            setReplace(false);
            setRepair(false);
            setMessage("");
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              if (file.size > MAX_BACKUP_BYTES) throw new Error("فایل بیشتر از ۱۰ مگابایت است.");
              const text = await file.text();
              const parsed = parseBackup(text);
              const checked = error
                ? {
                    notes: parsed.notes.length,
                    studyNotes: parsed.study?.notes.length ?? 0,
                    marks: parsed.study?.marks.length ?? 0,
                    favorites: parsed.favorites.length,
                    history: parsed.history.length,
                    conflicts: 0,
                  }
                : backupPreview(text);
              setRaw(text);
              setPreview(checked);
            } catch (cause) {
              setMessage(cause instanceof Error ? cause.message : "فایل خوانده نشد.");
            }
          }}
        />
      </label>
      {preview && (
        <div className="mt-3 rounded-xl bg-secondary p-3">
          {error && (
            <label className="block text-destructive">
              <input
                type="checkbox"
                checked={repair}
                onChange={(event) => setRepair(event.target.checked)}
              />
              بازسازی کتابخانه از این فایل؛ داده خراب فعلی برای بازیابی اضطراری نگه داشته می‌شود.
            </label>
          )}
          <p>
            {preview.notes} یادداشت، {preview.favorites} علاقه‌مندی و {preview.history} جست‌وجو در
            فایل.
          </p>
          {(preview.studyNotes > 0 || preview.marks > 0) && (
            <p>
              {preview.studyNotes} یادداشت شخصی و {preview.marks} بخش نشان‌شده در کلاس.
            </p>
          )}
          <p>
            {preview.conflicts} یادداشت با شناسه یکسان و متن متفاوت. پیش‌فرض: نسخه دستگاه حفظ
            می‌شود.
          </p>
          <label className="mt-2 flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
            جایگزینی یادداشت‌های متداخل با نسخه فایل
          </label>
          <button
            disabled={!!error && !repair}
            className="mt-2 min-h-12 w-full rounded-xl bg-primary text-primary-foreground"
            onClick={() => {
              try {
                if (error && repair) {
                  restoreDamagedLibrary(raw);
                  setMessage("کتابخانه از فایل بازسازی شد؛ نسخه خام قبلی محفوظ است.");
                  setPreview(null);
                  setRaw("");
                  return;
                }
                const result = importLibrary(raw, replace);
                setMessage(
                  result.added +
                    " افزوده، " +
                    result.replaced +
                    " جایگزین، " +
                    result.skipped +
                    " تداخل حفظ‌شده.",
                );
                setPreview(null);
                setRaw("");
              } catch (cause) {
                setMessage(cause instanceof Error ? cause.message : "بازیابی انجام نشد.");
              }
            }}
          >
            اعمال بازیابی
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        ورود دوباره فایل، شناسه‌ها را تکثیر نمی‌کند. نسخه پیش از ورود برای بازیابی اضطراری در همین
        مرورگر نگه داشته می‌شود. متن‌های قرنطینه‌شده در پشتیبان حفظ می‌شوند و وارد نتایج عملیاتی
        نمی‌شوند.
      </p>
    </details>
  );
}
