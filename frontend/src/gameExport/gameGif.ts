import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultPieces } from "react-chessboard";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

export type GifPosition = { fen: string; uci: string | null };

const SQUARE = 60, SIZE = SQUARE * 8;
const MOVE_DELAY_MS = 1000, FINAL_DELAY_MS = 3000;
// The board's move highlight (board.css .playback-highlight).
const HIGHLIGHT = "#ff8059";

function boardColour(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** The board's own piece artwork, as images the canvas can draw. */
async function pieceImages() {
  const entries = await Promise.all(Object.entries(defaultPieces).map(([code, Piece]) => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const svg = renderToStaticMarkup(createElement(Piece))
      .replace("<svg", `<svg width="${SQUARE}" height="${SQUARE}"`).replace(/ width="100%" height="100%"/, "");
    const image = new Image();
    image.onload = () => resolve([code, image]);
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  })));
  return new Map(entries);
}

function squareAt(file: number, rank: number, white: boolean) {
  return white ? { x: file * SQUARE, y: (7 - rank) * SQUARE } : { x: (7 - file) * SQUARE, y: rank * SQUARE };
}

function draw(context: CanvasRenderingContext2D, position: GifPosition, white: boolean,
  pieces: Map<string, HTMLImageElement>, light: string, dark: string) {
  for (let rank = 0; rank < 8; rank++)
    for (let file = 0; file < 8; file++) {
      const { x, y } = squareAt(file, rank, white);
      context.fillStyle = (file + rank) % 2 ? light : dark;
      context.fillRect(x, y, SQUARE, SQUARE);
    }
  if (position.uci)
    for (const name of [position.uci.slice(0, 2), position.uci.slice(2, 4)]) {
      const { x, y } = squareAt(name.charCodeAt(0) - 97, Number(name[1]) - 1, white);
      context.strokeStyle = HIGHLIGHT;
      context.lineWidth = 3;
      context.strokeRect(x + 1.5, y + 1.5, SQUARE - 3, SQUARE - 3);
    }
  position.fen.split(" ")[0].split("/").forEach((row, index) => {
    const rank = 7 - index;
    let file = 0;
    for (const symbol of row) {
      if (/\d/.test(symbol)) { file += Number(symbol); continue; }
      const code = (symbol === symbol.toUpperCase() ? "w" : "b") + symbol.toUpperCase();
      const { x, y } = squareAt(file, rank, white);
      context.drawImage(pieces.get(code)!, x, y, SQUARE, SQUARE);
      file++;
    }
  });
}

/** Every position of the game as an animated GIF, one move a second. */
export async function gameGif(positions: GifPosition[], orientation: "white" | "black",
  onProgress?: (done: number, total: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const pieces = await pieceImages();
  const light = boardColour("--board-light", "#c7cbd0"), dark = boardColour("--board-dark", "#737e8b");
  const gif = GIFEncoder();
  for (const [index, position] of positions.entries()) {
    draw(context, position, orientation === "white", pieces, light, dark);
    const rgba = context.getImageData(0, 0, SIZE, SIZE).data;
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), SIZE, SIZE, {
      palette, delay: index === positions.length - 1 ? FINAL_DELAY_MS : MOVE_DELAY_MS,
    });
    onProgress?.(index + 1, positions.length);
    // Yield so the dialog can show progress on long games.
    await new Promise((resolve) => setTimeout(resolve));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
