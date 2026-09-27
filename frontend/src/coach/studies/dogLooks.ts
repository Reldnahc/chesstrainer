import type { AnimalPalette } from "./AnimalFace";

export type DogLook = "sunny" | "gentle" | "corgi" | "collie";
export const dogPalettes: Record<DogLook, AnimalPalette> = {
  sunny: {
    fur: "#d8a150",
    dark: "#ac783b",
    light: "#ecc080",
    muzzle: "#f3d7a5",
    nose: "#42322b",
    iris: "#8c6949",
    accent: "#618b98",
    brow: "#9c6939",
  },
  gentle: {
    fur: "#dfc087",
    dark: "#b59662",
    light: "#f0d8aa",
    muzzle: "#f8e7c6",
    nose: "#574137",
    iris: "#927a56",
    accent: "#80917a",
    brow: "#a88658",
  },
  corgi: {
    fur: "#c28a50",
    dark: "#955e36",
    light: "#e4b576",
    muzzle: "#f5e5c7",
    nose: "#443630",
    iris: "#927347",
    accent: "#af6658",
    brow: "#865d3b",
  },
  collie: {
    fur: "#343b46",
    dark: "#232a34",
    light: "#778696",
    muzzle: "#eee9d9",
    nose: "#34373b",
    iris: "#b59b66",
    accent: "#5e9190",
    brow: "#afb9bd",
    lid: "#afb9bd",
  },
};

export function dogLook(family: string): DogLook {
  return family === "gentle" || family === "corgi" || family === "collie"
    ? family
    : "sunny";
}
