import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Leaf, Recycle, Volume2, VolumeX } from 'lucide-react';
import type { Language } from '../types/ecomove';
import { getT } from '../i18n/translations';
import { playEcoJingle } from '../utils/audio';

interface SplashScreenProps {
  lang: Language;
  onFinish: () => void;
}

export function SplashScreen({ lang, onFinish }: SplashScreenProps) {
  const t = getT(lang);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    playEcoJingle().then((res) => {
      if (!active) return;
      setAudioBlocked(res.blocked);
      setAudioPlayed(res.played);
    });

    const start = performance.now();
    const duration = 2500;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed < duration) {
        rafId = requestAnimationFrame(tick);
      } else {
        onFinish();
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [onFinish]);

  const handleManualAudio = async () => {
    const res = await playEcoJingle();
    setAudioBlocked(res.blocked);
    setAudioPlayed(res.played);
  };

  return (
    <div className="flex-1 h-full w-full bg-gradient-to-b from-[#059669] via-[#10B981] to-[#ECFDF5] flex flex-col justify-between p-5 relative overflow-hidden">
      {/* Soft decorative background circles */}
      <div
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-24 -left-16 w-48 h-48 rounded-full bg-[#047857]/15 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Controls */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <button
          type="button"
          onClick={handleManualAudio}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold transition-colors cursor-pointer backdrop-blur-md ${
            audioBlocked
              ? 'bg-white text-[#059669] shadow-sm'
              : 'bg-white/20 text-white border border-white/30'
          }`}
        >
          {audioBlocked ? (
            <VolumeX className="w-3.5 h-3.5 text-[#059669]" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-white" />
          )}
          <span>{audioPlayed ? t.splashSoundOn : t.splashUnmute}</span>
        </button>

        <button
          type="button"
          onClick={onFinish}
          className="px-3 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold text-white/90 hover:text-white bg-white/15 border border-white/25 cursor-pointer"
        >
          {t.splashSkip}
        </button>
      </div>

      {/* Center Animated Brand Emblem + EcoMove Logo */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-5"
        >
          <div className="w-24 h-24 rounded-3xl bg-white text-[#059669] flex items-center justify-center shadow-xl shadow-[#047857]/25 relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center text-[#10B981]/25"
            >
              <Recycle className="w-16 h-16" />
            </motion.div>
            <Leaf className="w-11 h-11 relative z-10" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="w-full max-w-[235px] rounded-2xl overflow-hidden bg-white border border-white/80 p-2.5 shadow-lg mb-4"
        >
          <img
            src="/assets/aistudio/Gemini_Generated_Image_uaqjzyuaqjzyuaqj_7850a8a5.jpg"
            alt="EcoMove"
            referrerPolicy="no-referrer"
            className="w-full h-auto rounded-xl object-contain"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xs font-bold text-[#065F46] bg-white/75 backdrop-blur-xs px-3.5 py-1.5 rounded-xl"
        >
          {t.splashSubtitle}
        </motion.p>
      </div>

      {/* Bottom 2.5s Progress Bar */}
      <div className="space-y-2.5 pb-2 relative z-10">
        <div className="w-full max-w-[210px] mx-auto h-1.5 bg-[#065F46]/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#059669] rounded-full transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-[11px] font-bold text-[#065F46]">
          EcoMove · {t.brandTagline}
        </p>
      </div>
    </div>
  );
}
