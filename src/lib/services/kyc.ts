import { api, unwrapStr, unwrapTime, mapPaged, type ApiPaged, type Paged } from '$lib/api';
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

export async function fetchKycDocuments(page: number, status = ''): Promise<Paged<KycDocument>> {
	const params = new URLSearchParams({ page: String(page) });
	if (status) params.set('status', status);
	const raw = await api.get<ApiPaged<ApiKycDocument>>(`/admin/kyc?${params}`);
	return mapPaged(raw, mapDoc);
}

export async function verifyKycDocument(id: string): Promise<KycDocument> {
	const d = await api.post<ApiKycDocument>(`/admin/kyc/${id}/verify`);
	return mapDoc(d);
}

export async function rejectKycDocument(id: string, reason: string): Promise<KycDocument> {
	const d = await api.post<ApiKycDocument>(`/admin/kyc/${id}/reject`, { reason });
	return mapDoc(d);
}
