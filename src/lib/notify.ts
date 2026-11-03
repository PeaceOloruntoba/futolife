import { toast } from "sonner";

export function notify(message: string) {
  const lower = message.toLowerCase();
  const isError = /\b(error|failed|failure|could not|unable|invalid|expired|must |required|choose |enter |add at least|not configured|not connected|already reported|already exists|session expired|do not match|does not match|something went wrong|couldn['’]t confirm)\b/.test(lower);
  if (isError) toast.error(message);
  else if (/^(sign in|this account is suspended)/i.test(message)) toast.info(message);
  else toast.success(message);
}
