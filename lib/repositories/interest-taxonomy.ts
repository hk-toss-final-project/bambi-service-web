import { FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiGet } from "@/lib/api-client";
import type { InterestTaxonomyDto } from "@/types/interest";

const TAXONOMY_PATH = "/api/interest-taxonomy";

/** Service DB가 소유한 활성 관심사 taxonomy를 조회한다. */
export async function fetchInterestTaxonomy(signal?: AbortSignal): Promise<InterestTaxonomyDto> {
  const data = await apiGet<InterestTaxonomyDto | null>(TAXONOMY_PATH, { auth: false, signal });
  if (!data || !Array.isArray(data.categories)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid taxonomy payload for ${TAXONOMY_PATH}`, 200);
  }
  return data;
}
