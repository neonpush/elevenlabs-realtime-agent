export interface ElevenLabsConfig {
  agentId: string;
  apiKey: string;
  voice?: string;
  language?: string;
}

export interface ConversationConfig {
  agent: {
    prompt: { prompt: string };
    first_message: string;
    language: string;
  };
  tts?: {
    voice_id?: string;
    stability?: number;
    similarity_boost?: number;
    use_speaker_boost?: boolean;
  };
}

export interface ElevenLabsMessage {
  type: string;
  [key: string]: any;
}

export interface AudioEvent {
  audio_base_64: string;
  event_id: number;
}

export interface TranscriptEvent {
  user_transcript: string;
}

export interface AgentResponseEvent {
  agent_response: string;
}

export interface InterruptionEvent {
  reason: string;
}

export interface VADScoreEvent {
  vad_score: number;
}

export interface ConversationInitiationMetadata {
  conversation_id: string;
  agent_output_audio_format: string;
  user_input_audio_format: string;
} 