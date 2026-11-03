import { toast } from "sonner";

export function notify(message: string) {
  const lower = message.toLowerCase();
  const isError = /\b(error|failed|failure|could not|unable|invalid|expired|must |required|choose |enter |add at least|not configured|already reported|session expired|do not match|does not match|something went wrong)\b/.test(lower);
  if (isError) toast.error(message);
  else if (/^(sign in|this account is suspended)/i.test(message)) toast.info(message);
  else toast.success(message);
}
