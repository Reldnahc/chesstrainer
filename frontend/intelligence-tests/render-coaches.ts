import type {Page} from "@playwright/test";
import path from "node:path";
import type {DialogueIntent} from "../src/dialogue/model";

export async function renderCoaches(page: Page, intent: DialogueIntent) {
  const source = `/@fs/${path.resolve("src").replaceAll("\\", "/")}`;
  return page.evaluate(async ({source, intent}) => {
    const {selectableCoaches} = await import(`${source}/coach/registry.ts`);
    const {renderDialogue} = await import(`${source}/dialogue/neutral.ts`);
    return selectableCoaches.map((coach: {id: string}) => renderDialogue(intent, coach));
  }, {source, intent}) as Promise<import("../src/dialogue/model").CoachUtterance[]>;
}
