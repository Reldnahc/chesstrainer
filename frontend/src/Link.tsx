import type { AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";

export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (event.currentTarget.target && event.currentTarget.target !== "_self") || event.currentTarget.hasAttribute("download") ||
      new URL(href, window.location.href).origin !== window.location.origin) return;
    event.preventDefault();
    navigate(href);
  }} />;
}
