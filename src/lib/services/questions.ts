import { api } from '$lib/api';
import type { ApiQuestion } from '$lib/api-types';
import type { SessionQuestion } from '$lib/types';

function mapQuestion(raw: ApiQuestion): SessionQuestion {
	return {
		id: raw.id,
		gameEventId: raw.game_event_id,
		sessionId: raw.session_id,
		sequenceNo: raw.sequence_no,
		questionText: raw.question_text,
		options: raw.options_json,
		correctOption: raw.correct_option,
		isAiGenerated: raw.is_ai_generated,
		approvedAt: raw.approved_at.Valid ? raw.approved_at.Time : null
	};
}

export async function fetchSessionQuestions(sessionId: string): Promise<SessionQuestion[]> {
	const raw = await api.get<ApiQuestion[]>(`/admin/sessions/${sessionId}/questions`);
	return (raw ?? []).map(mapQuestion).sort((a, b) => a.sequenceNo - b.sequenceNo);
}

export interface SessionQuestionInput {
	sequenceNo: number;
	questionText: string;
	options: string[];
	correctOption: string;
}

export async function createSessionQuestion(
	sessionId: string,
	input: SessionQuestionInput
): Promise<SessionQuestion> {
	const raw = await api.post<ApiQuestion>(`/admin/sessions/${sessionId}/questions`, {
		sequence_no: input.sequenceNo,
		question_text: input.questionText,
		options_json: input.options,
		correct_option: input.correctOption
	});
	return mapQuestion(raw);
}
