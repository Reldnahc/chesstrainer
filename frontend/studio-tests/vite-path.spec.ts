import { expect, test } from "@playwright/test";
import { viteFsPath } from "./helpers/viteFsPath";

test("Vite filesystem URLs use canonical Linux and Windows paths", () => {
  expect(viteFsPath("/home/runner/work/chesstrainer/frontend"))
    .toBe("/@fs/home/runner/work/chesstrainer/frontend");
  expect(viteFsPath("C:\\work\\chesstrainer\\frontend"))
    .toBe("/@fs/C:/work/chesstrainer/frontend");
  expect(viteFsPath("C:/work/chesstrainer/frontend"))
    .toBe("/@fs/C:/work/chesstrainer/frontend");
});
