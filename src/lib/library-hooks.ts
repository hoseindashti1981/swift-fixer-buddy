import { useEffect, useState } from "react";
import { readLibrary, subscribeLibrary, type Library } from "./library-storage";
export function useLibraryState() {
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => {
      try {
        setData(readLibrary());
        setError("");
      } catch {
        setData(null);
        setError(
          "دسترسی به داده محلی ممکن نیست یا داده خراب است. ذخیره و ورود پشتیبان متوقف است؛ نسخه موجود پاک نشده است.",
        );
      }
    };
    sync();
    const unsubscribe = subscribeLibrary(sync);
    window.addEventListener("storage", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { data, error };
}
