// =============================================================================
// Variant combination generator
// =============================================================================

export interface OptionInput {
  name: string;
  values: { value: string; additionalPrice: number }[];
}

export interface VariantRow {
  /** 화면에 표시할 조합 레이블 (예: "빨강 / S") */
  label: string;
  /** 각 옵션별 (optionIndex, valueIndex) 참조 */
  combination: { optionIndex: number; valueIndex: number }[];
  sku: string;
  stockQuantity: number;
  additionalPrice: number;
  isActive: boolean;
}

/**
 * 옵션 배열에서 카테시안 곱으로 모든 variant 조합을 생성합니다.
 * 기존 variant 데이터가 있으면 레이블이 일치하는 경우 값을 보존합니다.
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
  const optionValueIndices = validOptions.map((opt, optIdx) => {
    const originalOptIdx = options.indexOf(opt);
    return opt.values
      .map((v, valIdx) => ({ optIdx: originalOptIdx, valIdx, value: v.value }))
      .filter((item) => item.value.trim());
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
    const label = combo.map((c) => c.value).join(' / ');
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
    };
  });
}
