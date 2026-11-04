export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** La date ISO (aaaa-mm-jj) du jour décalé de `offsetDays` jours, comme l'API l'attend. */
export const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

/** Une date avec une heure explicite, dont les bornes de disponibilité ont besoin (une date seule fait répondre 500 au backend). */
export const at = (offsetDays: number, time = '12:00:00+00:00') => ({ date: isoDate(offsetDays), time });

/** La date et l'heure, au format de l'API, d'il y a `hours` heures. */
export function hoursAgo(hours: number) {
	const moment = new Date(Date.now() - hours * HOUR_MS);
	return { date: moment.toISOString().slice(0, 10), time: `${moment.toISOString().slice(11, 19)}+00:00` };
}

/** Les dates sont saisies comme l'UI française les attend : jj/mm/aaaa. */
export function uiDate(date: Date): string {
	const two = (n: number) => String(n).padStart(2, '0');
	return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** La date du jour décalé de `offsetDays` jours, au format de saisie de l'UI. */
export const uiDateIn = (offsetDays: number) => uiDate(new Date(Date.now() + offsetDays * DAY_MS));
