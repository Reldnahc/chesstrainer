export function clearExerciseLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete("exercise");
  url.searchParams.delete("unit");
  window.history.replaceState(null, "", url);
}
