<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { gameEventsStore } from '$lib/stores/gameEvents.svelte';
	import {
		fetchSessionQuestions,
		createSessionQuestion,
		type SessionQuestionInput
	} from '$lib/services/questions';
	import type { SessionQuestion } from '$lib/types';
	import { formatEventDate } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import * as Select from '$lib/components/ui/select/index.js';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let contestsLoaded = false;
	$effect(() => {
		if (checkedAuth && !contestsLoaded) {
			contestsLoaded = true;
			gameEventsStore.load();
		}
	});

	// ---------- Question bank (session-scoped authoring) ----------
	// Questions belong to a single game_session — pick a contest, then a session within
	// it, then author/view that session's questions. Reuses the shared gameEvents store's
	// sessionsByEvent, populated on-demand by ensureSessionsLoaded below.
	let questionEventId = $state('');
	let questionSessionId = $state('');
	let sessionQuestions = $state<SessionQuestion[]>([]);
	let sessionQuestionsLoading = $state(false);
	let sessionQuestionsError = $state('');

	const questionEventSessions = $derived(gameEventsStore.sessionsByEvent[questionEventId] ?? []);

	function eventPickerLabel(eventId: string) {
		const event = gameEventsStore.gameEvents.find((e) => e.id === eventId);
		return event ? `${event.name} — ${formatEventDate(event.eventDate)}` : '';
	}

	function sessionPickerLabel(
		sessions: { id: string; sessionLabel: string; entriesCount: number }[],
		sessionId: string
	) {
		const session = sessions.find((s) => s.id === sessionId);
		return session ? `${session.sessionLabel} (${session.entriesCount} players)` : '';
	}

	async function selectQuestionEvent(eventId: string) {
		questionEventId = eventId;
		questionSessionId = '';
		sessionQuestions = [];
		sessionQuestionsError = '';
		if (eventId) await gameEventsStore.ensureSessionsLoaded(eventId);
	}

	async function selectQuestionSession(sessionId: string) {
		questionSessionId = sessionId;
		sessionQuestions = [];
		sessionQuestionsError = '';
		if (!sessionId) return;
		sessionQuestionsLoading = true;
		try {
			sessionQuestions = await fetchSessionQuestions(sessionId);
		} catch (err) {
			sessionQuestionsError =
				err instanceof Error ? err.message : 'Failed to load session questions.';
		} finally {
			sessionQuestionsLoading = false;
		}
	}

	let showAddQuestion = $state(false);
	let newSequenceNo = $state(1);
	let newQuestionText = $state('');
	let newOptions = $state(['', '', '', '']);
	let newCorrectIndex = $state(0);
	let addQuestionError = $state('');
	let addQuestionSaving = $state(false);

	function openAddQuestion() {
		newSequenceNo = sessionQuestions.length + 1;
		newQuestionText = '';
		newOptions = ['', '', '', ''];
		newCorrectIndex = 0;
		addQuestionError = '';
		showAddQuestion = true;
	}

	async function submitAddQuestion(e: SubmitEvent) {
		e.preventDefault();
		if (!questionSessionId || !newQuestionText.trim() || newOptions.some((o) => !o.trim())) return;
		addQuestionSaving = true;
		addQuestionError = '';
		const input: SessionQuestionInput = {
			sequenceNo: newSequenceNo,
			questionText: newQuestionText.trim(),
			options: newOptions.map((o) => o.trim()),
			correctOption: newOptions[newCorrectIndex].trim()
		};
		try {
			const created = await createSessionQuestion(questionSessionId, input);
			sessionQuestions = [...sessionQuestions, created].sort((a, b) => a.sequenceNo - b.sequenceNo);
			showAddQuestion = false;
		} catch (err) {
			addQuestionError = err instanceof Error ? err.message : 'Failed to add question.';
		} finally {
			addQuestionSaving = false;
		}
	}
</script>

{#if !adminAccount.canSeeQuestions}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to the question bank.
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-end gap-3">
		<label class="block">
			<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest</span>
			<Select.Root
				type="single"
				value={questionEventId}
				onValueChange={(v) => selectQuestionEvent(v ?? '')}
			>
				<Select.Trigger class="w-56">
					<span class="min-w-0 flex-1 truncate text-left">
						{questionEventId ? eventPickerLabel(questionEventId) : 'Select a contest…'}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each gameEventsStore.gameEvents as event (event.id)}
						<Select.Item value={event.id} label={eventPickerLabel(event.id)} />
					{/each}
				</Select.Content>
			</Select.Root>
		</label>

		<label class="block">
			<span class="mb-1.5 block text-sm font-medium text-ink-soft">Session</span>
			<Select.Root
				type="single"
				value={questionSessionId}
				disabled={!questionEventId}
				onValueChange={(v) => selectQuestionSession(v ?? '')}
			>
				<Select.Trigger class="w-56">
					<span class="min-w-0 flex-1 truncate text-left">
						{questionSessionId
							? sessionPickerLabel(questionEventSessions, questionSessionId)
							: 'Select a session…'}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each questionEventSessions as session (session.id)}
						<Select.Item
							value={session.id}
							label={sessionPickerLabel(questionEventSessions, session.id)}
						/>
					{/each}
				</Select.Content>
			</Select.Root>
		</label>

		{#if questionSessionId}
			<button
				class="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
				onclick={openAddQuestion}
			>
				+ New question
			</button>
		{/if}
	</div>

	{#if !questionEventId}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Pick a contest to see its sessions.
		</div>
	{:else if gameEventsStore.sessionsLoadingFor[questionEventId]}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Loading sessions…
		</div>
	{:else if questionEventSessions.length === 0}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			This contest has no sessions yet — sessions are formed once the entry window closes.
		</div>
	{:else if !questionSessionId}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Pick a session to view or author its questions.
		</div>
	{:else}
		{#if sessionQuestionsError}
			<p
				class="mb-4 rounded-lg px-3 py-2 text-sm"
				style="background-color: var(--color-error-bg); color: var(--color-error);"
			>
				{sessionQuestionsError}
			</p>
		{/if}
		<div class="overflow-x-auto rounded-card border border-line bg-surface">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-line text-xs text-ink-soft uppercase">
						<th class="px-4 py-3 font-medium">#</th>
						<th class="px-4 py-3 font-medium">Question</th>
						<th class="px-4 py-3 font-medium">Options</th>
						<th class="px-4 py-3 font-medium">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each sessionQuestions as question (question.id)}
						<tr class="border-b border-line align-top last:border-0">
							<td class="px-4 py-3 text-ink-soft tabular-nums">{question.sequenceNo}</td>
							<td class="max-w-md px-4 py-3 font-medium text-ink">{question.questionText}</td>
							<td class="px-4 py-3 text-ink-soft">
								{#each question.options as option (option)}
									<p class:font-semibold={option === question.correctOption}>
										{option === question.correctOption ? '✓ ' : ''}{option}
									</p>
								{/each}
							</td>
							<td class="px-4 py-3">
								{#if question.isAiGenerated}
									<Chip label="AI-generated" color="var(--color-info)" bg="var(--color-info-bg)" />
								{:else}
									<Chip
										label="Admin-authored"
										color="var(--color-success)"
										bg="var(--color-success-bg)"
									/>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="4" class="px-4 py-8 text-center text-sm text-ink-soft">
								{sessionQuestionsLoading
									? 'Loading questions…'
									: 'No questions authored for this session yet.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

{#if showAddQuestion}
	<Modal title="Add question" onClose={() => (showAddQuestion = false)}>
		<form class="space-y-4" onsubmit={submitAddQuestion}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Sequence no.</span>
				<input
					required
					type="number"
					min="1"
					bind:value={newSequenceNo}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Question</span>
				<textarea
					required
					bind:value={newQuestionText}
					rows="2"
					placeholder="Question text"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>

			<div class="space-y-2">
				<span class="block text-sm font-medium text-ink-soft">Options — select the correct one</span
				>
				{#each [0, 1, 2, 3] as i (i)}
					<label class="flex items-center gap-2.5">
						<input
							type="radio"
							name="correct-option"
							checked={newCorrectIndex === i}
							onchange={() => (newCorrectIndex = i)}
							class="accent-primary"
						/>
						<input
							required
							bind:value={newOptions[i]}
							placeholder={`Option ${i + 1}`}
							class="w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
					</label>
				{/each}
			</div>

			{#if addQuestionError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{addQuestionError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={addQuestionSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{addQuestionSaving ? 'Adding…' : 'Add question'}
			</button>
		</form>
	</Modal>
{/if}
