export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(text); return;}
  } catch {}
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
  document.body.appendChild(field);
  field.focus(); field.select();
  try {if (!document.execCommand("copy")) throw new Error("Copy failed");}
  finally {field.remove(); previous?.focus();}
}
