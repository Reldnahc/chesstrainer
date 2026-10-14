import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultPieces } from "react-chessboard";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { moveSquares } from "../boardCues";

export type GifPosition = { fen: string; uci: string | null };

const SQUARE = 60, SIZE = SQUARE * 8;
const MOVE_DELAY_MS = 1000, FINAL_DELAY_MS = 3000;
// The board's own colours (foundation.css), so the GIF matches the page.
function boardColour(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
  pieces: Map<string, HTMLImageElement>, { light, dark, highlight }: Record<"light" | "dark" | "highlight", string>) {
  for (let rank = 0; rank < 8; rank++)
    for (let file = 0; file < 8; file++) {
      const { x, y } = squareAt(file, rank, white);
      context.fillStyle = (file + rank) % 2 ? light : dark;
      context.fillRect(x, y, SQUARE, SQUARE);
    }
  for (const name of moveSquares(position.uci)) {
    const { x, y } = squareAt(name.charCodeAt(0) - 97, Number(name[1]) - 1, white);
    context.strokeStyle = highlight;
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
  onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const pieces = await pieceImages();
  // The move highlight is board.css's .playback-highlight colour.
  const colours = { light: boardColour("--board-light"), dark: boardColour("--board-dark"), highlight: boardColour("--accent") };
  const gif = GIFEncoder();
  for (const [index, position] of positions.entries()) {
    // Stops between frames once the dialog closes.
    signal?.throwIfAborted();
    draw(context, position, orientation === "white", pieces, colours);
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
