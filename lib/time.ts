// Every date and time on the site is shown in Pacific time, whatever the
// viewer's own clock is set to, so the server and browser render the same text.

export const SITE_TIME_ZONE = 'America/Los_Angeles';

type DateInput = Date | string | number;

export function formatPacific(date: DateInput, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: SITE_TIME_ZONE }).format(new Date(date));
}

/** "7:00 PM PT" */
export const pacificTime = (date: DateInput) => `${formatPacific(date, { hour: 'numeric', minute: '2-digit' })} PT`;

/** A calendar day such as "2026-11-06" (no time of day), formatted without shifting to the day before. */
export const calendarDay = (day: string, options: Intl.DateTimeFormatOptions) => formatPacific(`${day.slice(0, 10)}T12:00:00Z`, options);

/** "2026-11-06" for the Pacific calendar day of a moment. */
export const calendarIso = (date: DateInput) => new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
