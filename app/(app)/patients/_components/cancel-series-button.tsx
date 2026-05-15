"use client";

import { useFormStatus } from "react-dom";
import { cancelRecurrenceAction } from "../../appointments/actions";

export function CancelSeriesButton({
  recurrenceId,
  patientId,
}: {
  recurrenceId: string;
  patientId: string;
}) {
  const action = cancelRecurrenceAction.bind(null, recurrenceId, patientId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Cancel this series? Its future scheduled occurrences will be cancelled.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button />
    </form>
  );
}

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {pending ? "Cancelling…" : "Cancel series"}
    </button>
  );
}
