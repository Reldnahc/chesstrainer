import { expect, type Locator } from "@playwright/test";

export async function expectReturnAction(button: Locator) {
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("type", "button");
  await expect(button.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(button.locator("svg")).toHaveAttribute("width", "18");
  await expect(button.locator("svg")).toHaveAttribute("height", "18");
  // A previous click can leave the replacement action under the pointer.
  await button.page().mouse.move(0, 0);
  await expect.poll(() => button.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(181, 160, 242)");
  const presentation = await button.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      borderColor: style.borderColor,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      padding: style.padding,
      gap: style.gap,
      icon: element.querySelector("svg")!.innerHTML,
    };
  });
  expect(presentation).toMatchObject({
    color: "rgb(33, 20, 55)", borderColor: "rgb(207, 191, 255)",
    fontSize: "12px", fontWeight: "700", padding: "6px 10px", gap: "6px",
  });
  return presentation;
}
