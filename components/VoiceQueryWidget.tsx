'use client';
// components/VoiceQueryWidget.tsx
// Reusable voice query bar for Parent, Teacher, and Accountant pages.
// POSTs directly to the read-only /api/voice-query endpoint.

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/lib/useLang';

import LanguageSelector from './LanguageSelector';

// Maps Aaria's visual_companion.expression values (see pranix-aaria
// src/visual_companion.py EXPRESSION_KEYWORDS) to a lightweight emoji cue.
const EXPRESSION_EMOJI: Record<string, string> = {
  excited: '🎉',
  concerned: '⚠️',
  curious: '🤔',
  thinking: '💭',
  friendly: '🙂'
};

interface VoiceNLResp {
  intent: string;
  text_response: string;
  audio_response_base64?: string;
  visual_companion?: { avatar_state?: string; expression?: string; captions?: unknown[]; [key: string]: unknown } | null;
}

export function VoiceQueryWidget({ proactiveTrigger = false }: { proactiveTrigger?: boolean }) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [visualCompanion, setVisualCompanion] = useState<VoiceNLResp['visual_companion']>(null);
  const { lang } = useLang();
  const [listening, setListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
    } catch (err) {
      console.error('Error starting media recorder:', err);
    }
  };

  const stopRecording = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve(base64data);
        };
        reader.readAsDataURL(audioBlob);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      
      rec.onstart = () => {
        setListening(true);
        void startRecording();
      };
      
      rec.onresult = async (event: any) => {
        const resultText = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        setInstruction(resultText);
        
        const audioBase64 = await stopRecording();
        
        if (confidence >= 0.8) {
          await executeVoiceQuery({ transcript: resultText, confidence });
        } else {
          await executeVoiceQuery({ audio_base64: audioBase64 || undefined });
        }
      };
      
      rec.onerror = async (event: any) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
        const audioBase64 = await stopRecording();
        if (audioBase64) {
          await executeVoiceQuery({ audio_base64: audioBase64 });
        }
      };
      
      rec.onend = () => {
        setListening(false);
      };
      
      setRecognition(rec);
    }
  }, [lang]);

  useEffect(() => {
    if (proactiveTrigger && recognition && !listening && !loading) {
      const welcomeText = lang === 'te'
        ? "హలో! నేను మీ వాయిస్ అసిస్టెంట్ ఆరియాని. మీ క్లాస్ అటెండెన్స్ చెక్ చేయడానికి 'చెక్ అటెండెన్స్' అని చెప్పండి."
        : "Hello! I am Aaria, your voice assistant. Say 'check attendance' or 'show marks' to start.";
      
      const runGreeting = async () => {
        const speechLangCode = getSpeechLangCode(lang);
        const localVoiceAvailable = await hasLocalVoiceFor(speechLangCode);
        
        if (localVoiceAvailable && typeof window !== 'undefined' && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(welcomeText);
          utterance.lang = speechLangCode;
          utterance.onend = () => {
            try {
              recognition.lang = speechLangCode;
              recognition.start();
            } catch (err) {
              console.warn('Proactive auto-listening failed:', err);
            }
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setLastResult(welcomeText);
          setTimeout(() => {
            try {
              recognition.lang = speechLangCode;
              recognition.start();
            } catch (err) {
              console.warn('Proactive auto-listening failed:', err);
            }
          }, 1500);
        }
      };

      const greetingTimer = setTimeout(() => {
        void runGreeting();
      }, 1000);

      return () => clearTimeout(greetingTimer);
    }
  }, [proactiveTrigger, recognition]);

  function toggleListening() {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (listening) {
      recognition.stop();
    } else {
      const speechLangMap: Record<string, string> = {
        en: 'en-IN',
        te: 'te-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        kn: 'kn-IN',
        mr: 'mr-IN',
        ml: 'ml-IN'
      };
      recognition.lang = speechLangMap[lang] || 'en-IN';
      recognition.start();
    }
  }

  function getSpeechLangCode(l: string): string {
    const speechLangMap: Record<string, string> = {
      en: 'en-IN',
      te: 'te-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
      mr: 'mr-IN',
      ml: 'ml-IN'
    };
    return speechLangMap[l] || 'en-IN';
  }

  // Chrome/Edge load voices asynchronously - getVoices() can return [] on first call.
  function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve([]);
        return;
      }
      const existing = window.speechSynthesis.getVoices();
      if (existing.length > 0) {
        resolve(existing);
        return;
      }
      const handle = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handle);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener('voiceschanged', handle);
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handle);
        resolve(window.speechSynthesis.getVoices());
      }, 500);
    });
  }

  // Real capability check: does this device actually have a voice for langCode?
  // Replaces the old hardcoded device_supports_tts:true, which silently claimed
  // TTS support even when the browser had no matching voice (root cause of
  // Telugu voice output never being heard - EdProSys never called Aaria's
  // cloud speak endpoint as a fallback because this always reported true).
  async function hasLocalVoiceFor(langCode: string): Promise<boolean> {
    const prefix = langCode.split('-')[0].toLowerCase();
    
    // Desktop Chrome/browsers do not support native Telugu TTS, but Android does.
    if (prefix === 'te') {
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
      if (!isAndroid) {
        return false;
      }
    }

    const voices = await getVoicesAsync();
    return voices.some(
      (v) => v.lang.toLowerCase() === langCode.toLowerCase() || v.lang.toLowerCase().startsWith(prefix)
    );
  }

  async function executeVoiceQuery(voicePayload: { transcript?: string; confidence?: number; audio_base64?: string }) {
    setLoading(true);
    setLastResult(null);
    setVisualCompanion(null);
    try {
      const speechLangCode = getSpeechLangCode(lang);
      const localVoiceAvailable = await hasLocalVoiceFor(speechLangCode);

      const res = await fetch('/api/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...voicePayload,
          language_pref: lang,
          device_supports_tts: localVoiceAvailable
        })
      });
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`HTTP ${res.status} - ${bodyText}`);
      }
      const data = await res.json() as VoiceNLResp;
      const speakText = data.text_response || '';
      if (data.visual_companion) {
        setVisualCompanion(data.visual_companion);
      }

      // Device-native TTS - only attempt it when we confirmed a matching voice exists.
      if (speakText && localVoiceAvailable && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(speakText);
        utterance.lang = speechLangCode;
        window.speechSynthesis.speak(utterance);
        setLastResult(speakText || 'No response details found.');
      } else if (speakText && !localVoiceAvailable) {
        // Fall back to playing cloud-synthesized audio if returned.
        if (data.audio_response_base64) {
          try {
            const audio = new Audio(data.audio_response_base64);
            await audio.play();
            setLastResult(speakText);
          } catch (audioErr: any) {
            console.error('Failed to play cloud TTS audio:', audioErr);
            setLastResult(`${speakText}\n\n(Voice playback failed: ${audioErr.message || audioErr})`);
          }
        } else {
          setLastResult(`${speakText}\n\n(Voice playback isn't available in this language on this device yet - showing text only.)`);
        }
      } else {
        setLastResult(speakText || 'No response details found.');
      }
    } catch (err: any) {
      console.error('Voice query execution failed:', err);
      setLastResult(`Voice query failed: ${err.message || err}`);
    }
    setLoading(false);
  }

  async function execute() {
    if (!instruction.trim() || loading) return;
    await executeVoiceQuery({ transcript: instruction, confidence: 1.0 });
    setInstruction('');
  }

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: 0.5 }}>
          🎙️ VOICE QUERY ASSISTANT
        </div>
        <LanguageSelector compact />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleListening}
          disabled={loading}
          style={{
            padding: '8px 12px',
            background: listening ? '#EF4444' : '#F1F5F9',
            color: listening ? '#FFFFFF' : '#475569',
            border: '1px solid #CBD5E1',
            borderRadius: 7,
            fontSize: 14,
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Voice input"
        >
          {listening ? '🛑🎙️' : '🎙️'}
        </button>
        <input
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void execute(); }}
          placeholder='Ask EdProSys... e.g. "show marks", "check attendance", "pending fees"'
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, background: '#fff', outline: 'none' }}
          disabled={loading}
        />
        <button onClick={() => void execute()} disabled={loading || !instruction.trim()}
          style={{ padding: '8px 18px', background: loading ? '#94A3B8' : '#475569', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
          {loading ? '⏳' : 'Ask →'}
        </button>
      </div>

      {lastResult && (
        <div style={{ marginTop: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#334155' }}>
          💡 {lastResult}
          {visualCompanion?.expression && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>
              {EXPRESSION_EMOJI[String(visualCompanion.expression)] || '🙂'} Aaria: {String(visualCompanion.expression)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
