import { motion } from 'framer-motion'
import { useState } from 'react'
import { useDocumentaryMode } from '../../context/DocumentaryModeContext'

export function DocumentaryEnding() {
  const { exploreAtlas } = useDocumentaryMode()
  const [continueHintVisible, setContinueHintVisible] = useState(false)

  const handleContinue = () => {
    setContinueHintVisible(true)
  }

  return (
    <motion.div
      className="documentary-ending"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.6, ease: [0.22, 0.8, 0.2, 1] }}
    >
      <div className="documentary-ending__backdrop" aria-hidden="true" />

      <div className="documentary-ending__content">
        <motion.p
          className="documentary-ending__line documentary-ending__line--primary"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.2, ease: [0.22, 0.8, 0.2, 1] }}
        >
          The opening you&apos;ve just watched is only the beginning.
        </motion.p>

        <motion.p
          className="documentary-ending__line documentary-ending__line--secondary"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 1.1, ease: [0.22, 0.8, 0.2, 1] }}
        >
          The evidence is already here — waiting in the Atlas.
        </motion.p>

        <motion.div
          className="documentary-ending__actions"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4, duration: 0.9, ease: [0.22, 0.8, 0.2, 1] }}
        >
          <button type="button" className="documentary-ending__cta" onClick={handleContinue}>
            Continue Documentary
          </button>
          <button
            type="button"
            className="documentary-ending__cta documentary-ending__cta--secondary"
            onClick={exploreAtlas}
          >
            Explore the Atlas
          </button>
        </motion.div>

        {continueHintVisible ? (
          <motion.p
            className="documentary-ending__hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            The remaining chapters are still being assembled.
          </motion.p>
        ) : null}
      </div>
    </motion.div>
  )
}
