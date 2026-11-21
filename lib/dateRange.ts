// Move-in date range rules for the client (ENG-55). Pure; the server checks the same rule again
// (latest on or after earliest). Dates are YYYY-MM-DD strings, compared as strings.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function dayLabel(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : d;
}

// The earliest date the "latest" picker may offer: the same day is allowed.
export function latestMin(earliest: string): string | undefined {
  return earliest || undefined;
}

// Error text when the range is the wrong way round, or null.
export function rangeError(earliest: string, latest: string): string | null {
  if (earliest && latest && latest < earliest) return `Choose your latest date again. It must be on or after ${dayLabel(earliest)}.`;
  return null;
}

// Moving the start past an existing end clears the end and says what to do; nothing else changes.
export function afterEarliestChange(earliest: string, latest: string): { latest: string; cleared: boolean; message: string | null } {
  if (earliest && latest && latest < earliest) {
    return { latest: "", cleared: true, message: `Choose your latest date again. It must be on or after ${dayLabel(earliest)}.` };
  }
  return { latest, cleared: false, message: null };
}
