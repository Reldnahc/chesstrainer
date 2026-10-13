import { useEffect, useId, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { api, read, type Schema } from "../api";
import Button, { IconButton } from "../Button";
import Notice from "../Notice";
import { LoadingState } from "../LoadState";
import useModalDialog from "../useModalDialog";
import "./game-export.css";

type Exported = Schema["GameExport"];

function fileName(game: Exported, extension: string) {
  // Keep letters in any script ("Müller"); drop characters file systems reject.
  const name = `${game.white} vs ${game.black}`.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "game";
  return `${name}.${extension}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The Clipboard API exists only on secure pages; the LAN server is plain HTTP. */
async function copy(text: string, from: HTMLElement) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  // Outside the modal everything is inert, so the scratch field lives inside it.
  const field = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  field.style.position = "fixed";
  field.style.opacity = "0";
  (from.closest("dialog") ?? document.body).append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  from.focus();
  if (!copied) throw new Error("Copying is blocked here; select the text instead.");
}

function CopyButton({ text, label, onError }: { text: string; label: string; onError: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button size="compact" aria-label={label} onClick={(event) => copy(text, event.currentTarget).then(() => setCopied(true),
      (e) => onError(e instanceof Error ? e.message : "Copying failed."))}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** PGN, FEN and an animated GIF of one game. */
export default function GameExportDialog({ id, fen, orientation, onClose }: {
  id: string;
  /** The position on the board. */
  fen: string;
  /** The side the board is shown from; the GIF uses the same. */
  orientation: "white" | "black";
  onClose: () => void;
}) {
  const dialog = useModalDialog(onClose);
  const ids = useId();
  const [game, setGame] = useState<Exported | null>(null);
  const [error, setError] = useState("");
  const [gif, setGif] = useState<{ url: string; blob: Blob } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    let active = true;
    read(api.GET("/api/games/{game_id}/export", { params: { path: { game_id: id } } }))
      .then((value) => { if (active) setGame(value); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => () => { if (gif) URL.revokeObjectURL(gif.url); }, [gif]);
  async function makeGif() {
    if (!game || progress) return;
    setError("");
    setProgress({ done: 0, total: game.positions.length });
    try {
      // The encoder and piece renderer load only when someone asks for a GIF.
      const { gameGif } = await import("./gameGif");
      const blob = await gameGif(game.positions, orientation, (done, total) => setProgress({ done, total }));
      setGif({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The GIF could not be made.");
    } finally {
      setProgress(null);
    }
  }
  return (
    <dialog {...dialog} aria-labelledby={`${ids}-title`} className="game-export-dialog panel">
      <div className="row-between">
        <h2 id={`${ids}-title`}>Export game</h2>
        <IconButton variant="quiet" onClick={onClose} aria-label="Close export">
          <X />
        </IconButton>
      </div>
      {error && <Notice announcement="alert" tone="error" appearance="inline">{error}</Notice>}
      {!game ? (!error && <LoadingState>Preparing the game…</LoadingState>) : <>
        <section className="game-export-section" aria-labelledby={`${ids}-pgn`}>
          <div className="row-between">
            <h3 id={`${ids}-pgn`}>PGN</h3>
            <div className="cluster">
              <CopyButton text={game.pgn} label="Copy PGN" onError={setError} />
              <Button size="compact" onClick={() => save(new Blob([game.pgn], { type: "application/x-chess-pgn" }), fileName(game, "pgn"))}>
                <Download size={15} />Download
              </Button>
            </div>
          </div>
          <textarea readOnly rows={5} value={game.pgn} aria-labelledby={`${ids}-pgn`} spellCheck={false} />
        </section>
        <section className="game-export-section" aria-labelledby={`${ids}-fen`}>
          <div className="row-between">
            <h3 id={`${ids}-fen`}>FEN <span className="muted">Position on the board</span></h3>
            <CopyButton text={fen} label="Copy FEN" onError={setError} />
          </div>
          <input readOnly value={fen} aria-labelledby={`${ids}-fen`} spellCheck={false} />
        </section>
        <section className="game-export-section" aria-labelledby={`${ids}-gif`}>
          <div className="row-between">
            <h3 id={`${ids}-gif`}>GIF <span className="muted">Whole game from this side, one move a second</span></h3>
            {gif ? (
              <Button size="compact" variant="primary" onClick={() => save(gif.blob, fileName(game, "gif"))}>
                <Download size={15} />Download
              </Button>
            ) : (
              <Button size="compact" variant="primary" disabled={!!progress} onClick={makeGif}>
                {progress ? `Drawing ${progress.done} of ${progress.total}…` : "Make GIF"}
              </Button>
            )}
          </div>
          {gif && <img className="game-export-preview" src={gif.url} alt={`Animated game: ${game.white} vs ${game.black}`} />}
        </section>
      </>}
    </dialog>
  );
}
