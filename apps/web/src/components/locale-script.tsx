import { LOCALE_STORAGE_KEY } from "@/lib/locale-storage";

/**
 * Runs before paint so the first frame already matches the saved language direction.
 */
export function LocaleScript() {
  const script = `(function(){try{var k=${JSON.stringify(LOCALE_STORAGE_KEY)};var l=localStorage.getItem(k);var en=l==="en";document.documentElement.lang=en?"en":"ar";document.documentElement.dir=en?"ltr":"rtl";}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
