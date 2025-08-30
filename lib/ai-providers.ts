import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export interface AIProvider {
  generateText(prompt: string): Promise<string>;
  countTokens(text: string): number;
}

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  }

  async generateText(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  countTokens(text: string): number {
    // Rough estimation for Gemini
    return Math.ceil(text.length / 4);
  }
}

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generateText(prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '';
  }

  countTokens(text: string): number {
    // More accurate token estimation for OpenAI (roughly 1 token per 4 characters)
    // This includes both input and output tokens
    return Math.ceil(text.length / 3.5);
  }
}

export function createAIProvider(provider: string): AIProvider {
  if (provider === 'gemini') {
    return new GeminiProvider(process.env.GEMINI_API_KEY!);
  } else if (provider === 'openai') {
    return new OpenAIProvider(process.env.OPENAI_API_KEY!);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
}