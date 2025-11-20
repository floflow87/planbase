import { useState, useCallback, useEffect, useRef } from 'react';

interface VoiceRecordingOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceRecording(options: VoiceRecordingOptions = {}) {
  const {
    lang = 'fr-FR',
    continuous = true,
    interimResults = true,
    onTranscript,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  
  // Store callbacks in refs to avoid recreating recognition on every render
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  // Update callback refs when they change
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Initialize speech recognition only once
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
          onTranscriptRef.current?.(finalTranscript.trim(), true);
        } else if (interimTranscript) {
          onTranscriptRef.current?.(interimTranscript.trim(), false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'Une erreur est survenue';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Aucune parole détectée';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone non accessible';
            break;
          case 'not-allowed':
            errorMessage = 'Permission microphone refusée';
            break;
          case 'network':
            errorMessage = 'Erreur réseau';
            break;
          default:
            errorMessage = `Erreur: ${event.error}`;
        }
        
        onErrorRef.current?.(errorMessage);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onstart = () => {
        setIsRecording(true);
        finalTranscriptRef.current = '';
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [lang, continuous, interimResults]); // Removed callback dependencies

  const startRecording = useCallback(() => {
    if (!isSupported) {
      onErrorRef.current?.('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      return;
    }

    try {
      recognitionRef.current?.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      onErrorRef.current?.('Impossible de démarrer l\'enregistrement');
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
