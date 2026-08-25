<script lang="ts">
	import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';

	let {
		value = $bindable(),
		placeholder = 'Pick a date',
		showTime = false,
		disabled = false,
		class: className
	}: {
		value?: Date;
		placeholder?: string;
		showTime?: boolean;
		disabled?: boolean;
		class?: string;
	} = $props();

	function toCalendarDate(date?: Date): DateValue | undefined {
		if (!date) return undefined;
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	function toTimeString(date?: Date): string {
		if (!date) return '';
		return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
	}

	let open = $state(false);
	let calendarValue = $state<DateValue | undefined>(toCalendarDate(value));
	let timeValue = $state(toTimeString(value));

	$effect(() => {
		calendarValue = toCalendarDate(value);
		timeValue = toTimeString(value);
	});

	function commit() {
		if (!calendarValue) {
			value = undefined;
			return;
		}
		const next = calendarValue.toDate(getLocalTimeZone());
		if (showTime && timeValue) {
			const [hours, minutes] = timeValue.split(':').map(Number);
			next.setHours(hours, minutes, 0, 0);
		}
		value = next;
	}

	function onCalendarChange() {
		commit();
		if (!showTime) open = false;
	}

	const label = $derived(
		value
			? value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
					(showTime ? ` · ${toTimeString(value)}` : '')
			: placeholder
	);
</script>

<Popover.Root bind:open>
	<Popover.Trigger {disabled}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class={cn(
					'w-full justify-start text-left font-normal',
					!value && 'text-muted-foreground',
					className
				)}
			>
				<CalendarIcon class="mr-2 size-4" />
				{label}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0">
		<Calendar type="single" bind:value={calendarValue} onValueChange={onCalendarChange} />
		{#if showTime}
			<div class="border-t border-border p-2.5">
				<Input type="time" bind:value={timeValue} onchange={commit} />
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>
