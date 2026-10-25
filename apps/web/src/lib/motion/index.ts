/**
 * Dynamic motion bundle loader (SPEC-06 RF-10, ENG-086).
 * Loads motion presets asynchronously based on theme / ageSegment
 * ensuring neither bundle is bundled in the other's chunk.
 */

export async function loadMotionTheme(theme: 'kids' | 'teens' = 'kids') {
  if (theme === 'teens') {
    const mod = await import('./teens');
    return mod.teensMotion;
  }
  const mod = await import('./kids');
  return mod.kidsMotion;
}
