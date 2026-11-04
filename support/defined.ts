/** Une valeur que le contexte garantit présente (résultat d'un `find`, d'un `get`...) ; échoue avec un message clair sinon. */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
	if (value === undefined || value === null) throw new Error(`Expected ${what} to be defined`);
	return value;
}
