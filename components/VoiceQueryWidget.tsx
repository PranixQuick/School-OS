'use client';
// components/VoiceQueryWidget.tsx
// Reusable voice query bar for Parent, Teacher, and Accountant pages.
// POSTs directly to the read-only /api/voice-query endpoint.

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/lib/useLang';

import LanguageSelector from './LanguageSelector';

interface VoiceNLResp {
  intent: string;
  text_response: string;
}

export function VoiceQueryWidget() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
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

  async function executeVoiceQuery(voicePayload: { transcript?: string; confidence?: number; audio_base64?: string }) {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...voicePayload,
          language_pref: lang,
          device_supports_tts: true
        })
      });
      if (res.status === 403) {
        const friendlyDenials: Record<string, string> = {
          en: "You don't have access to this student's records.",
          te: "మీకు ఈ విద్యార్థి వివరాలను చూసే అనుమతి లేదు.",
          hi: "आपके पास इस छात्र के विवरण देखने की अनुमति नहीं है।",
          ta: "இந்த மாணவரின் விவரங்களை அணுக உங்களுக்கு அனுமதி இல்லை.",
          kn: "ನಿಮಗೆ ಈ ವಿದ್ಯಾರ್ಥಿಯ ವಿವರಗಳನ್ನು ಪ್ರವೇಶಿಸಲು ಅನುಮತಿಯಿಲ್ಲ.",
          mr: "तुम्हाला या विद्यार्थ्याची माहिती पाहण्याची परवानगी नाही.",
          ml: "ഈ വിദ്യാർത്ഥിയുടെ വിവരങ്ങൾ കാണാൻ നിങ്ങൾക്ക് അനുമതിയില്ല."
        };
        const speakText = friendlyDenials[lang] || friendlyDenials['en'];
        setLastResult(speakText);

        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(speakText);
          const speechLangMap: Record<string, string> = {
            en: 'en-IN', te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', mr: 'mr-IN', ml: 'ml-IN'
          };
          utterance.lang = speechLangMap[lang] || 'en-IN';
          window.speechSynthesis.speak(utterance);
        }
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`HTTP ${res.status} - ${bodyText}`);
      }
      const data = await res.json() as VoiceNLResp;
      setLastResult(data.text_response || 'No response details found.');

      // Device-native TTS
      const speakText = data.text_response || '';
      if (speakText && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(speakText);
        const speechLangMap: Record<string, string> = {
          en: 'en-IN',
          te: 'te-IN',
          hi: 'hi-IN',
          ta: 'ta-IN',
          kn: 'kn-IN',
          mr: 'mr-IN',
          ml: 'ml-IN'
        };
        utterance.lang = speechLangMap[lang] || 'en-IN';
        window.speechSynthesis.speak(utterance);
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
        </div>
      )}
    </div>
  );
}
