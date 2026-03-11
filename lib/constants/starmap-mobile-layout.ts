const MOBILE_SAFE_AREA_BOTTOM = 'var(--safe-area-bottom)';
const MOBILE_SAFE_AREA_LEFT = 'var(--safe-area-left)';
const MOBILE_SAFE_AREA_RIGHT = 'var(--safe-area-right)';

export const MOBILE_LAYOUT_CONTRACT = {
  actionRailBottomRem: 0.25,
  bottomToolsBottomRem: 3.75,
  defaultSideInsetRem: 0.5,
  oneHandLeftInsetRem: 3,
  bottomToolsRightClearanceRem: 4,
  oneHandZoomLiftRem: 4.75,
  criticalControlGapPx: 8,
  minTouchTargetPx: 44,
} as const;

interface MobileLayoutOffsetOptions {
  oneHandMode: boolean;
}

interface MobileLayoutOffsets {
  actionRailBottomOffset: string;
  controlsBottomOffset: string;
  zoomBottomOffset: string;
  safeAreaLeft: string;
  safeAreaRight: string;
  safeAreaRightWithControls: string;
}

const withSafeArea = (rem: number, safeAreaVariable: string) => `calc(${rem}rem + ${safeAreaVariable})`;

export function getMobileLayoutOffsets({
  oneHandMode,
}: MobileLayoutOffsetOptions): MobileLayoutOffsets {
  const actionRailBottomOffset = withSafeArea(
    MOBILE_LAYOUT_CONTRACT.actionRailBottomRem,
    MOBILE_SAFE_AREA_BOTTOM,
  );
  const controlsBottomOffset = withSafeArea(
    MOBILE_LAYOUT_CONTRACT.bottomToolsBottomRem,
    MOBILE_SAFE_AREA_BOTTOM,
  );
  const zoomBottomOffset = oneHandMode
    ? withSafeArea(
      MOBILE_LAYOUT_CONTRACT.bottomToolsBottomRem + MOBILE_LAYOUT_CONTRACT.oneHandZoomLiftRem,
      MOBILE_SAFE_AREA_BOTTOM,
    )
    : controlsBottomOffset;
  const safeAreaLeft = withSafeArea(
    oneHandMode
      ? MOBILE_LAYOUT_CONTRACT.oneHandLeftInsetRem
      : MOBILE_LAYOUT_CONTRACT.defaultSideInsetRem,
    MOBILE_SAFE_AREA_LEFT,
  );
  const safeAreaRight = withSafeArea(
    MOBILE_LAYOUT_CONTRACT.defaultSideInsetRem,
    MOBILE_SAFE_AREA_RIGHT,
  );
  const safeAreaRightWithControls = oneHandMode
    ? safeAreaRight
    : withSafeArea(
      MOBILE_LAYOUT_CONTRACT.bottomToolsRightClearanceRem,
      MOBILE_SAFE_AREA_RIGHT,
    );

  return {
    actionRailBottomOffset,
    controlsBottomOffset,
    zoomBottomOffset,
    safeAreaLeft,
    safeAreaRight,
    safeAreaRightWithControls,
  };
}
