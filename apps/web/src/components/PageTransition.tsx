import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export const PageTransition = ({ children }: PropsWithChildren) => (
  <motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="min-h-full"
  >
    {children}
  </motion.div>
);

