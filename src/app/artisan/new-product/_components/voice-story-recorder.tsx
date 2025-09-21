'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceStoryRecorderProps {
  onStoryCaptured: (data: {
    transcript: string;
    craft_story_id: string;
    craft_story: string;
    short_description: string;
  }) => void;
  isProcessing: boolean;
}

export default function VoiceStoryRecorder({ onStoryCaptured, isProcessing }: VoiceStoryRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Speak your story now. Click stop when finished.',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Could not access microphone. Please check permissions.',
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast({
        title: 'Recording Stopped',
        description: 'Click "Process Story" to generate your craft story.',
      });
    }
  }, [isRecording, toast]);

  const playRecording = useCallback(() => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [audioUrl, isPlaying]);

  const processStory = useCallback(async () => {
    if (!audioBlob) {
      toast({
        variant: 'destructive',
        title: 'No Recording',
        description: 'Please record your story first.',
      });
      return;
    }

    try {
      // Convert audio blob to base64 (chunked for large files)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Process in chunks to avoid "Maximum call stack size exceeded"
      let base64Audio = '';
      const chunkSize = 8192; // Process 8KB at a time
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        base64Audio += btoa(String.fromCharCode(...chunk));
      }

      // Send to backend
      const response = await fetch('/api/voice/story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: 'demo-product-id', // In real app, get from context
          audioData: base64Audio,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onStoryCaptured({
          transcript: result.transcript,
          craft_story_id: result.craft_story_id,
          craft_story: result.craft_story,
          short_description: result.short_description,
        });

        toast({
          title: 'Story Processed!',
          description: 'Your craft story has been generated. You can edit it below.',
        });
      } else {
        throw new Error(result.error || 'Failed to process story');
      }
    } catch (error) {
      console.error('Story processing error:', error);
      toast({
        variant: 'destructive',
        title: 'Processing Failed',
        description: 'Could not process your story. Please try again.',
      });
    }
  }, [audioBlob, onStoryCaptured, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Tell us the story behind your creation. What inspired you? How did you make it?
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-4">
          {!isRecording && !audioBlob && (
            <Button
              onClick={startRecording}
              disabled={isProcessing}
              size="lg"
              className="rounded-full h-16 w-16"
            >
              <Mic className="h-6 w-6" />
            </Button>
          )}
          
          {isRecording && (
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="rounded-full h-16 w-16"
            >
              <Square className="h-6 w-6" />
            </Button>
          )}
          
          {audioBlob && !isRecording && (
            <div className="flex items-center gap-2">
              <Button
                onClick={playRecording}
                variant="outline"
                size="sm"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-muted-foreground">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-600">Recording... {formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {audioBlob && !isRecording && (
        <div className="flex justify-center">
          <Button
            onClick={processStory}
            disabled={isProcessing}
            className="w-full max-w-xs"
          >
            {isProcessing ? 'Processing Story...' : 'Process Story'}
          </Button>
        </div>
      )}

      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
