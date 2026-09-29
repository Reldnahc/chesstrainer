import { studyRequestId } from "./requestId";

/** Keep the selected content and command identity until creation is acknowledged. */
export function retryableStart<Target, Body extends object, Result>(
  prepare: (target: Target, signal?: AbortSignal) => Promise<Body | null>,
  submit: (body: Body & { request_id: string }, signal?: AbortSignal) => Promise<Result>,
) {
  let pending: { target: string | undefined; body: Body & { request_id: string } } | null = null;
  return async (target: Target, signal?: AbortSignal): Promise<Result | null> => {
    const key = JSON.stringify(target);
    if (!pending || pending.target !== key) {
      pending = null;
      const body = await prepare(target, signal);
      if (!body) return null;
      pending = { target: key, body: { ...body, request_id: studyRequestId() } };
    }
    const attempt = pending;
    const result = await submit(attempt.body, signal);
    if (pending === attempt) pending = null;
    return result;
  };
}
