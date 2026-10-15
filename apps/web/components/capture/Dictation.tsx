"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

// Speak a Brain Dump instead of typing it. Uses the browser's own speech
// recognition (Chrome, Edge, Safari); TaskMasterAi only receives the text
// that ends up in the box. Renders nothing where it isn't supported.

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Dictation({ onText }: { onText: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  // Feature-detect after mount so server and client render the same.
  useEffect(() => {
    const timeout = setTimeout(() => setSupported(recognitionClass() !== null), 0);
    return () => {
      clearTimeout(timeout);
      recognition.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function start() {
    const Recognition = recognitionClass();
    if (!Recognition) return;
    const r = new Recognition();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-GB";
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onText(result[0].transcript.trim());
      }
    };
    r.onerror = (event) =>
      setError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in your browser to dictate."
          : "Dictation stopped. Try again, or type instead."
      );
    r.onend = () => setListening(false);
    recognition.current = r;
    setError(null);
    setListening(true);
    r.start();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        aria-pressed={listening}
        onClick={() => (listening ? recognition.current?.stop() : start())}
      >
        {listening ? "Stop dictating" : "Dictate"}
      </Button>
      <span role="status" className="field-hint">
        {listening ? "Listening… speak naturally; pause between thoughts." : (error ?? "")}
      </span>
    </>
  );
}
