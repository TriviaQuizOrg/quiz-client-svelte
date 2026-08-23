export function formatINR(amount: number): string {
	// Real backend amounts (converted from paise) can be fractional rupees — round to the
	// nearest paise rather than truncating to whole rupees, but only show the decimals
	// when they're non-zero so existing whole-rupee displays look exactly as before.
	const value = Math.abs(Math.round(amount * 100) / 100);
	const [whole, frac] = value.toFixed(2).split('.');
	const wholeFormatted = whole.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
	return frac === '00' ? `₹${wholeFormatted}` : `₹${wholeFormatted}.${frac}`;
}

export function formatSignedINR(amount: number): string {
	const sign = amount >= 0 ? '+' : '-';
	return `${sign}${formatINR(amount)}`;
}

export function formatDateLabel(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';

	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday = date.toDateString() === yesterday.toDateString();

	const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

	if (isToday) return `Today, ${time}`;
	if (isYesterday) return `Yesterday, ${time}`;

	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** For game_events.event_date — a calendar date, not a timestamp, so no relative-day logic. */
export function formatEventDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-IN', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatMonthYear(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
