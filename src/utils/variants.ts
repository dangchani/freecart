// =============================================================================
// Variant combination generator
// =============================================================================

export interface OptionInput {
  name: string;
  isRequired?: boolean; // 기본값 true (필수 옵션)
  values: { value: string; additionalPrice: number }[];
}

export interface VariantRow {
  /** 화면에 표시할 조합 레이블 (예: "빨강 / S") */
  label: string;
  /** 각 옵션별 (optionIndex, valueIndex) 참조. 선택 옵션이 "선택 안 함"인 경우 valueIndex === -1 */
  combination: { optionIndex: number; valueIndex: number }[];
  sku: string;
  stockQuantity: number;
  additionalPrice: number;
  isActive: boolean;
  minPurchaseQuantity: number | null;
  maxPurchaseQuantity: number | null;
  dailyPurchaseLimit: number | null;
}

/**
 * 옵션 배열에서 카테시안 곱으로 모든 variant 조합을 생성합니다.
 * - 선택 옵션(isRequired === false)은 "선택 안 함" 항목(valueIndex: -1)을 자동 추가합니다.
 * - 기존 variant 데이터가 있으면 레이블이 일치하는 경우 값을 보존합니다.
 */
export function generateVariantCombinations(
  options: OptionInput[],
  existingVariants: VariantRow[] = []
): VariantRow[] {
  // 옵션이 없거나 옵션값이 모두 비어있으면 빈 배열 반환
  const validOptions = options.filter(
    (opt) => opt.name.trim() && opt.values.some((v) => v.value.trim())
  );
  if (validOptions.length === 0) return [];

  // 각 옵션의 유효한 값 인덱스 목록
  const optionValueIndices = validOptions.map((opt) => {
    const originalOptIdx = options.indexOf(opt);
    const validValues = opt.values
      .map((v, valIdx) => ({ optIdx: originalOptIdx, valIdx, value: v.value }))
      .filter((item) => item.value.trim());

    // 선택 옵션이면 "선택 안 함" 항목을 맨 앞에 추가 (valIdx: -1)
    if (opt.isRequired === false) {
      return [
        { optIdx: originalOptIdx, valIdx: -1, value: '선택 안 함' },
        ...validValues,
      ];
    }

    return validValues;
  });

  // 카테시안 곱 계산
  const combinations: { optIdx: number; valIdx: number; value: string }[][] = optionValueIndices.reduce(
    (acc, optValues) => {
      if (acc.length === 0) return optValues.map((v) => [v]);
      return acc.flatMap((existing) => optValues.map((v) => [...existing, v]));
    },
    [] as { optIdx: number; valIdx: number; value: string }[][]
  );

  return combinations.map((combo) => {
    // "선택 안 함"인 항목은 레이블에서 제외
    const labelParts = combo.filter((c) => c.valIdx !== -1).map((c) => c.value);
    const label = labelParts.length > 0 ? labelParts.join(' / ') : '선택 안 함';
    const combination = combo.map((c) => ({ optionIndex: c.optIdx, valueIndex: c.valIdx }));

    // 기존 variant에서 동일한 레이블을 찾아 값 보존
    const existing = existingVariants.find((v) => v.label === label);

    return {
      label,
      combination,
      sku: existing?.sku ?? '',
      stockQuantity: existing?.stockQuantity ?? 0,
      additionalPrice: existing?.additionalPrice ?? 0,
      isActive: existing?.isActive ?? true,
      minPurchaseQuantity: existing?.minPurchaseQuantity ?? null,
      maxPurchaseQuantity: existing?.maxPurchaseQuantity ?? null,
      dailyPurchaseLimit: existing?.dailyPurchaseLimit ?? null,
    };
  });
}
