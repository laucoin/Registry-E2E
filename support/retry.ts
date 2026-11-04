/** Relance `action` après une pause tant qu'il reste des tentatives ; la dernière erreur est propagée. */
export async function withRetries<T>(action: () => Promise<T>, attempts: number, pauseMs: number): Promise<T> {
	try {
		return await action();
	} catch (error) {
		if (attempts <= 1) throw error;
		await new Promise((resolve) => setTimeout(resolve, pauseMs));
		return withRetries(action, attempts - 1, pauseMs);
	}
}
