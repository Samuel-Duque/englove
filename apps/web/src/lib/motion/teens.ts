/**
 * Teens animation presets and variants (SPEC-06 RF-10, ENG-086).
 * Loaded dynamically in separate chunk for ageSegment === 'teens'.
 */
export const teensMotion = {
  cardFlip: {
    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    transformStyle: 'preserve-3d',
  },
  buttonPop: {
    transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.12s ease',
    transform: 'scale(1.015)',
  },
  selectionPulse: 'ring-2 ring-indigo-500 shadow-sm',
  bounceEntrance: {
    initial: { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { ease: [0.16, 1, 0.3, 1], duration: 0.24 },
  },
};

export default teensMotion;
