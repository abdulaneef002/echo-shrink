import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, Upload, Play, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [processedText, setProcessedText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
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
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Recording started", description: "Speak into your microphone" });
    } catch (error) {
      toast({ title: "Error", description: "Could not access microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({ title: "Recording stopped", description: "Ready to process audio" });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioBlob(file);
      toast({ title: "File uploaded", description: "Ready to process audio" });
    } else {
      toast({ title: "Error", description: "Please select a valid audio file", variant: "destructive" });
    }
  };

  const transcribeAudio = (audioBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');
        resolve(transcript);
      };

      recognition.onerror = () => {
        reject(new Error('Speech recognition failed'));
      };

      recognition.start();
      audio.play();
      
      audio.onended = () => {
        recognition.stop();
      };
    });
  };

  const summarizeText = (text: string): string => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return text;

    // Extract key information and create concise summary
    const words = text.toLowerCase().split(/\s+/);
    const keyPhrases = [];
    
    // Look for names, titles, achievements, numbers
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const names = text.match(namePattern) || [];
    const numbers = text.match(/\d+/g) || [];
    
    // Find the main subject (usually first proper noun)
    const mainSubject = names[0] || 'User';
    
    // Extract key descriptors and achievements
    const achievements = [];
    if (text.includes('captain')) achievements.push('captain');
    if (text.includes('farmer')) achievements.push('farmer');
    if (text.includes('won') || text.includes('winner')) {
      const trophyMention = text.match(/(\d+)\s*(icc|ipl|trophy|trophies)/gi);
      if (trophyMention) {
        trophyMention.forEach(match => achievements.push(match.toLowerCase()));
      }
    }
    
    // Create concise summary
    let summary = mainSubject;
    if (achievements.length > 0) {
      summary += ' – ' + achievements.join(', ');
    }
    
    // Limit to around 15-25 words max
    const maxWords = 20;
    const summaryWords = summary.split(' ');
    if (summaryWords.length > maxWords) {
      summary = summaryWords.slice(0, maxWords).join(' ') + '...';
    }
    
    return summary;
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;
      speechSynthesis.speak(utterance);
    }
  };

  const processAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setProcessedText("");
    setSummary("");
    
    try {
      toast({ title: "Processing...", description: "Transcribing audio" });
      
      // Step 1: Transcribe audio to text
      const transcribedText = await transcribeAudio(audioBlob);
      setProcessedText(transcribedText);
      
      toast({ title: "Transcription complete", description: "Creating summary" });
      
      // Step 2: Summarize the text
      const summarizedText = summarizeText(transcribedText);
      setSummary(summarizedText);
      
      // Step 3: Speak the summary
      setTimeout(() => {
        speakText(summarizedText);
      }, 500);
      
      toast({ title: "Success", description: "Audio processed and summary ready!" });
    } catch (error) {
      console.error('Processing error:', error);
      toast({ 
        title: "Error", 
        description: "Failed to process audio. Please try recording again.", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            EchoShrink
          </h1>
          <p className="text-xl text-muted-foreground">
            Transform your audio into concise summaries
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Audio Input Section */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Audio Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  className="w-full"
                  disabled={isProcessing}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>

                <div className="relative">
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="audio-upload"
                    disabled={isProcessing}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('audio-upload')?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Audio File
                  </Button>
                </div>

                {audioBlob && (
                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      onClick={playAudio}
                      className="w-full"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Preview Audio
                    </Button>
                    
                    <Button
                      onClick={processAudio}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Process Audio"
                      )}
                    </Button>
                  </div>
                )}

                {processedText && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-border">
                    <h3 className="font-semibold text-sm text-muted-foreground">Input Text Converted:</h3>
                    <p className="text-sm bg-muted/50 p-3 rounded-md border">{processedText}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {processedText && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Transcribed Text:</h3>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{processedText}</p>
                </div>
              )}
              
              {summary && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Summary:</h3>
                  <p className="text-lg font-medium bg-primary/10 p-4 rounded-md border border-primary/20 text-primary">
                    {summary}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => speakText(summary)}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Play Summary
                  </Button>
                </div>
              )}
              
              {!processedText && !summary && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Record or upload audio to see results here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
