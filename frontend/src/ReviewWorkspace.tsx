import { useLayoutEffect, useRef, type ReactNode } from "react";

/** The single layout and sizing policy for game review and spaced repetition. */
export default function ReviewWorkspace({ heading, boardLabel, board, aboveBoard, belowBoard, boardControls, evaluation, children }: {
  heading?: ReactNode;
  boardLabel: string;
  board: ReactNode;
  aboveBoard: ReactNode;
  belowBoard?: ReactNode;
  boardControls?: ReactNode;
  evaluation?: ReactNode;
  children: ReactNode;
}) {
  const area = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = area.current!;
    const layout = element.parentElement!;
    const page = layout.closest("main")!;
    const chrome = [...element.querySelectorAll<HTMLElement>("[data-review-chrome]")];
    const resize = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const controlsHeight = chrome.reduce((sum, item) => sum + item.getBoundingClientRect().height, 0);
      const layoutStyle = getComputedStyle(layout);
      const pageStyle = getComputedStyle(page);
      const gutter = Number.parseFloat(layoutStyle.getPropertyValue("--review-gutter"));
      const width = `${Math.max(240, window.innerHeight - top - controlsHeight - 14) + gutter}px`;
      const height = `${Math.max(0, window.innerHeight - top - 12)}px`;
      if (layout.style.getPropertyValue("--review-board-width") !== width) layout.style.setProperty("--review-board-width", width);
      if (layout.style.getPropertyValue("--review-height") !== height) layout.style.setProperty("--review-height", height);
      // Narrow the sidebar first. Grow beyond the shared page width only
      // when the existing board and usable controls cannot otherwise fit.
      const minimum = `${Number.parseFloat(width) + Number.parseFloat(layoutStyle.columnGap)
        + Number.parseFloat(layoutStyle.getPropertyValue("--review-sidebar-min"))
        + Number.parseFloat(pageStyle.paddingLeft) + Number.parseFloat(pageStyle.paddingRight)}px`;
      if (page.style.getPropertyValue("--review-min-width") !== minimum) page.style.setProperty("--review-min-width", minimum);
    };
    resize();
    const observer = new ResizeObserver(resize);
    for (const item of [...chrome, ...document.querySelectorAll(".app-header"), layout.parentElement!]) observer.observe(item);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      page.style.removeProperty("--review-min-width");
    };
  }, []);

  return <div className="review-workspace-layout">
    <section ref={area} className="review-board-area" aria-label={boardLabel}>
      <div className="review-board-meta" data-review-chrome>{aboveBoard}</div>
      <div className="review-board-row">
        {evaluation}
        <div className="review-board-square">{board}</div>
      </div>
      <div className="review-board-meta" data-review-chrome>{belowBoard}</div>
      <div className="review-board-toolbar" data-review-chrome>{boardControls}</div>
    </section>
    <aside className="review-sidebar">
      {heading && <div className="review-workspace-heading">{heading}</div>}
      {children}
    </aside>
  </div>;
}
