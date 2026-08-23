import { api, unwrapStr, unwrapTime } from '$lib/api';
import type { ApiKycDocument } from '$lib/api-types';
import type { KycDocument } from '$lib/types';

function mapDoc(d: ApiKycDocument): KycDocument {
	const fullName = unwrapStr(d.user_full_name);
	return {
		id: d.id,
		userId: d.user_id,
		playerName: fullName || d.user_phone_number,
		playerPhone: d.user_phone_number,
		docType: d.doc_type,
		docNumberMasked: d.doc_number_masked,
		docFileUrl: unwrapStr(d.doc_file_url),
		status: d.status,
		verifiedAt: unwrapTime(d.verified_at),
		rejectionReason: unwrapStr(d.rejection_reason),
		createdAt: d.created_at
	};
}

export async function fetchKycDocuments(): Promise<KycDocument[]> {
	const rows = await api.get<ApiKycDocument[]>('/admin/kyc');
	return (rows ?? []).map(mapDoc);
}

export async function verifyKycDocument(id: string): Promise<KycDocument> {
	const d = await api.post<ApiKycDocument>(`/admin/kyc/${id}/verify`);
	return mapDoc(d);
}

export async function rejectKycDocument(id: string, reason: string): Promise<KycDocument> {
	const d = await api.post<ApiKycDocument>(`/admin/kyc/${id}/reject`, { reason });
	return mapDoc(d);
}
