import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { ChatChannel, ChatMessage, Language } from '../types/ecomove';
import { getT } from '../i18n/translations';

interface CollectorChatCardProps {
  lang: Language;
  consumerName: string;
  collectorTitle: string;
  courierName?: string;
  courierPlate?: string;
  activeChannel: ChatChannel;
  onChangeChannel: (channel: ChatChannel) => void;
  messages: ChatMessage[];
  isCollectorTyping: boolean;
  onSendMessage: (text: string, channel: ChatChannel) => void;
}

export function CollectorChatCard({
  lang,
  consumerName,
  collectorTitle,
  courierName,
  courierPlate,
  activeChannel,
  onChangeChannel,
  messages,
  isCollectorTyping,
  onSendMessage,
}: CollectorChatCardProps) {
  const t = getT(lang);
  const [expanded, setExpanded] = useState(true);
  const [inputText, setInputText] = useState('');
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = messages.filter(
    (msg) => !msg.channel || msg.channel === activeChannel
  );

  useEffect(() => {
    if (!expanded || !scrollBoxRef.current) return;
    scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight;
  }, [visibleMessages.length, isCollectorTyping, expanded, activeChannel]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, activeChannel);
    setInputText('');
  };

  const isCourierMode = activeChannel === 'courier';
  const quickChips = isCourierMode
    ? [
        t.chatCourierQuick1,
        t.chatCourierQuick2,
        t.chatCourierQuick3,
        t.chatCourierQuick4,
      ]
    : [t.chatQuick1, t.chatQuick2, t.chatQuick3, t.chatQuick4];

  const subtitleIdentity = isCourierMode
    ? courierName
      ? `${courierName}${courierPlate ? ` · ${courierPlate}` : ''}`
      : 'Kurir Tosa EcoMove Pontianak'
    : collectorTitle;

  return (
    <section className="bg-white rounded-2xl border border-[#A7F3D0] overflow-hidden shadow-xs">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full p-3.5 bg-gradient-to-r from-[#ECFDF5] to-[#F4F9F6] border-b border-[#D1FAE5] flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
              isCourierMode ? 'bg-[#059669]' : 'bg-[#D97706]'
            }`}
          >
            {isCourierMode ? (
              <Truck className="w-4 h-4" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-xs font-bold text-[#0F172A] truncate">
                {isCourierMode ? t.chatCourierTitle : t.chatTitle}
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#D1FAE5] text-[#065F46] text-[9px] font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                {t.chatOnlineBadge}
              </span>
            </div>
            <p className="text-[10px] text-[#475569] truncate mt-0.5 flex items-center gap-1">
              {isCourierMode ? (
                <Truck className="w-3 h-3 text-[#059669] shrink-0" />
              ) : (
                <Building2 className="w-3 h-3 text-[#D97706] shrink-0" />
              )}
              <span className="truncate">{subtitleIdentity}</span>
            </p>
          </div>
        </div>
        <span className="w-7 h-7 rounded-lg bg-white border border-[#D1FAE5] flex items-center justify-center text-[#059669] shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="p-3 space-y-2.5">
          {/* Recipient Switcher: Kurir Tosa <-> Pengepul Mitra */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F1F5F9]">
            <button
              type="button"
              onClick={() => onChangeChannel('courier')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isCourierMode
                  ? 'bg-white text-[#059669] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span className="truncate">{t.chatChannelCourier}</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeChannel('collector')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                !isCourierMode
                  ? 'bg-white text-[#B45309] shadow-xs'
                  : 'text-[#64748B]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="truncate">{t.chatChannelCollector}</span>
            </button>
          </div>

          {/* Intermediary Note */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            <span className="leading-snug">
              {isCourierMode ? t.chatCourierSubtitle : t.chatSubtitle}
            </span>
          </div>

          {/* Message Thread */}
          <div
            ref={scrollBoxRef}
            className="h-48 overflow-y-auto mobile-scroll space-y-2 pr-1"
          >
            {visibleMessages.map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="text-center py-0.5">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[10px] font-semibold text-[#065F46]">
                      {msg.text} · {msg.timeLabel}
                    </span>
                  </div>
                );
              }

              const isConsumer = msg.sender === 'consumer';
              const isCourierMsg = msg.sender === 'courier';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isConsumer ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[9px] font-semibold text-[#64748B] mb-0.5 px-1">
                    {isConsumer
                      ? `${consumerName} (${lang === 'id' ? 'Konsumen' : 'Consumer'})`
                      : msg.senderName}{' '}
                    · {msg.timeLabel}
                  </span>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed shadow-2xs ${
                      isConsumer
                        ? 'bg-[#059669] text-white rounded-br-sm'
                        : isCourierMsg
                        ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-bl-sm'
                        : 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isCollectorTyping && (
              <div className="flex items-start">
                <div className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[10px] italic text-[#64748B]">
                  {isCourierMode ? t.chatCourierTyping : t.chatTyping}
                </div>
              </div>
            )}
          </div>

          {/* Quick Message Chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onSendMessage(chip, activeChannel)}
                className="px-2 py-1 rounded-lg bg-[#F4F9F6] hover:bg-[#ECFDF5] border border-[#D1FAE5] text-[10px] font-semibold text-[#065F46] cursor-pointer transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-0.5">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isCourierMode ? t.chatCourierPlaceholder : t.chatPlaceholder
              }
              className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#10B981]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label={t.chatSendBtn}
              className="min-h-[38px] px-3 rounded-xl bg-[#059669] disabled:bg-[#94A3B8] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.chatSendBtn}</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
