import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';
import { PostGenerator } from '@/lib/post-generator';
import { GeminiProvider, OpenAIProvider } from '@/lib/ai-providers';

// Schema for both batch and single post generation
const GenerationRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  tone: z.string().optional(),
  audience: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  postCount: z.number().min(1).max(6).default(3), // Allow single post
  hashtags: z.string().optional(),
  // cta: z.string().optional(),
  examples: z.string().optional(),
  language: z.string().default('English'),
  llmProvider: z.enum(['gemini', 'openai']).default('gemini'),
  wordCount: z.number().optional(),
  // Optional fields for regeneration
  outline: z.object({
    hook: z.string(),
    bullets: z.array(z.string()),
    // cta: z.string()
  }).optional(),
  persona: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimiter.check(clientIP);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded', 
        resetTime: rateLimitResult.resetTime 
      }, { status: 429 });
    }

    // Validate request
    const body = await request.json();
    const validationResult = GenerationRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const requestData = validationResult.data;

    // Check API keys
    const requiredKey = requestData.llmProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    if (!process.env[requiredKey]) {
      return NextResponse.json(
        { error: `${requestData.llmProvider.toUpperCase()} API key not configured` },
        { status: 500 }
      );
    }

    // Create AI provider
    const provider = requestData.llmProvider === 'gemini' 
      ? new GeminiProvider(process.env.GEMINI_API_KEY!)
      : new OpenAIProvider(process.env.OPENAI_API_KEY!);

    const generator = new PostGenerator(provider);

    // Map length to word count
    let wordCount = 200;
    if (requestData.length === 'short') wordCount = 120;
    if (requestData.length === 'medium') wordCount = 200;
    if (requestData.length === 'long') wordCount = 300;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const progressCallback = (step: string, description: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              progress: { step, description, completed: false }
            })}\n\n`));
          };

          console.log('Starting post generation for topic:', requestData.topic);

          const results = await generator.generatePosts(
            { 
              topic: requestData.topic,
              tone: requestData.tone ?? '',
              audience: requestData.audience ?? '',
              length: requestData.length,
              postCount: requestData.postCount,
              hashtags: requestData.hashtags ?? '',
              examples: requestData.examples ?? '',
              language: requestData.language,
              llmProvider: requestData.llmProvider,
              wordCount,
              outline: requestData.outline,
              persona: requestData.persona ?? ''
            },
            progressCallback
          );
          
          console.log('Generation completed. Results:', results.length);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'result',
            results
          })}\n\n`));

        } catch (error) {
          console.error('Generation error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Generation failed'
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}