/**
 * Kids animation presets and variants (SPEC-06 RF-10, ENG-086).
 * Loaded dynamically in separate chunk for ageSegment === 'kids'.
 */
export const kidsMotion = {
  cardFlip: {
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transformStyle: 'preserve-3d',
  },
  buttonPop: {
    transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
    transform: 'scale(1.03)',
  },
  selectionPulse: 'animate-pulse ring-4 ring-amber-400',
  bounceEntrance: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 350, damping: 15 },
  },
};

export default kidsMotion;
