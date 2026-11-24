import type { ReactNode } from 'react';

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#DCEFE5] via-[#EEF6F2] to-[#DFECE7] min-[430px]:py-5 min-[430px]:px-4 flex items-center justify-center">
      {/* Smartphone Hardware Frame: Fullscreen on actual phones (<430px), centered 390x844 phone mockup on wider viewports */}
      <div className="relative flex items-center justify-center w-full h-[100dvh] min-[430px]:w-auto min-[430px]:h-auto">
        {/* Decorative Side Hardware Buttons (Volume + Power) */}
        <div
          className="hidden min-[430px]:block absolute -left-[3px] top-[128px] w-[3px] h-8 bg-[#334155] rounded-l-sm"
          aria-hidden="true"
        />
        <div
          className="hidden min-[430px]:block absolute -left-[3px] top-[176px] w-[3px] h-12 bg-[#334155] rounded-l-sm"
          aria-hidden="true"
        />
        <div
          className="hidden min-[430px]:block absolute -left-[3px] top-[234px] w-[3px] h-12 bg-[#334155] rounded-l-sm"
          aria-hidden="true"
        />
        <div
          className="hidden min-[430px]:block absolute -right-[3px] top-[186px] w-[3px] h-16 bg-[#334155] rounded-r-sm"
          aria-hidden="true"
        />

        {/* Phone Body */}
        <div className="relative w-full h-[100dvh] min-[430px]:w-[390px] min-[430px]:h-[844px] min-[430px]:max-h-[94dvh] bg-[#F4F9F6] min-[430px]:rounded-[46px] min-[430px]:border-[10px] min-[430px]:border-[#0F172A] min-[430px]:ring-1 min-[430px]:ring-white/60 min-[430px]:shadow-[0_28px_70px_-12px_rgba(5,150,105,0.22),0_18px_36px_-15px_rgba(15,23,42,0.35)] overflow-hidden flex flex-col">
          {/* Top Phone Status Bar & Dynamic Island (Desktop/Tablet Frame) */}
          <div
            className="hidden min-[430px]:flex items-center justify-between px-7 pt-3 pb-1.5 bg-[#059669] text-white shrink-0 select-none z-30"
            aria-hidden="true"
          >
            <span className="font-mono-tabular text-[11px] font-bold tracking-tight">
              09:41
            </span>
            {/* Dynamic Island Pill */}
            <div className="w-[92px] h-[22px] rounded-full bg-[#0F172A] flex items-center justify-end pr-2 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1E293B] ring-1 ring-[#334155]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold">5G</span>
              <div className="w-[18px] h-[10px] rounded-[3px] border border-white/80 p-[1.5px] flex items-center">
                <div className="w-full h-full bg-[#A7F3D0] rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* App Viewport */}
          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {children}
          </div>

          {/* Bottom Home Indicator Bar (Desktop/Tablet Frame) */}
          <div
            className="hidden min-[430px]:flex items-center justify-center py-2 bg-white shrink-0 select-none"
            aria-hidden="true"
          >
            <div className="w-28 h-1 rounded-full bg-[#CBD5E1]" />
          </div>
        </div>
      </div>
    </div>
  );
}
