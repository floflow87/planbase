import { useVoiceRecording } from '@/hooks/use-voice-recording';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecordingButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function VoiceRecordingButton({ onTranscript, onError, className }: VoiceRecordingButtonProps) {
  const { isRecording, isSupported, toggleRecording } = useVoiceRecording({
    lang: 'fr-FR',
    continuous: true,
    interimResults: true,
    onTranscript,
    onError,
  });

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={isRecording ? 'destructive' : 'default'}
            onClick={toggleRecording}
            className={cn(
              'h-14 w-14 rounded-full shadow-lg transition-all',
              isRecording && 'animate-pulse'
            )}
            data-testid="button-voice-recording"
          >
            {isRecording ? (
              <div className="flex items-center justify-center">
                <MicOff className="h-7 w-7" />
                <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
              </div>
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer la transcription vocale'}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
