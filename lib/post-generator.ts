import { AIProvider } from './ai-providers';
import { ContentSafetyChecker } from './content-safety';

export interface GenerationRequest {
  topic: string;
  tone: string;
  audience: string;
  length: 'short' | 'medium' | 'long';
  postCount: number;
  hashtags: string;
  examples: string;
  language: string;
  llmProvider: 'gemini' | 'openai';
  wordCount?: number;
  outline?: {
    hook: string;
    bullets: string[];
  };
  persona: string;  // Make it required, not optional
}

export interface PostOutline {
  hook: string;
  bullets: string[];
  // cta: string;
}

export interface GeneratedPost {
  id: string;
  persona: string;
  planningOutline: PostOutline;
  finalText: string;
  suggestedHashtags: string[];
  tokensUsed: number;
  latency: number;
}

export interface ProgressCallback {
  (step: string, description: string): void;
}

// Helper to trim text to word count
function trimToWordCount(text: string, wordCount: number): string {
  const words = text.split(/\s+/);
  if (words.length <= wordCount) return text;
  return words.slice(0, wordCount).join(' ') + '...';
}

export class PostGenerator {
  private aiProvider: AIProvider;
  private safetyChecker: ContentSafetyChecker;
  private totalTokensUsed: number = 0;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
    this.safetyChecker = new ContentSafetyChecker();
  }

  async generatePosts(
    request: GenerationRequest, 
    onProgress: ProgressCallback
  ): Promise<GeneratedPost[]> {
    const startTime = Date.now();
    this.totalTokensUsed = 0;

    // Step 1: Batch outlines
    onProgress('Planning', 'Generating outlines...');
    const outlines = await this.batchCreateOutlines(request);

    // Step 2: Batch posts
    onProgress('Drafting', 'Generating posts...');
    const posts = await this.batchExpandOutlines(outlines, request);

    // Step 3: Batch hashtags
    onProgress('Hashtag Generation', 'Generating hashtags...');
    const hashtags = await this.batchGenerateHashtags(posts, request);

    // Step 4: Safety check (batched for efficiency)
    onProgress('Content Safety', 'Checking content...');
    const safetyResults = posts.map(post => this.safetyChecker.checkContent(post));

    // Step 5: Package results
    onProgress('Packaging', 'Finalizing...');
    const personas = ['Founder', 'Mentor', 'Industry Expert', 'Thought Leader', 'Practitioner', 'Innovator'];
    const latency = Date.now() - startTime;

    return posts.map((post, i) => ({
      id: `post-${i + 1}`,
      persona: personas[i % personas.length],
      planningOutline: outlines[i],
      finalText: request.wordCount ? trimToWordCount(
        safetyResults[i].safe ? post : this.safetyChecker.sanitizeContent(post),
        request.wordCount
      ) : (safetyResults[i].safe ? post : this.safetyChecker.sanitizeContent(post)),
      suggestedHashtags: hashtags[i],
      tokensUsed: Math.ceil(this.totalTokensUsed / request.postCount),
      latency
    }));
  }

  // Batch outlines in one call
  private async batchCreateOutlines(request: GenerationRequest): Promise<PostOutline[]> {
    const prompt = `Create ${request.postCount} LinkedIn post outlines about "${request.topic}".
Audience: ${request.audience}
Tone: ${request.tone}
${request.wordCount ? `Limit each outline to a post of about ${request.wordCount} words.` : ''}
Language: ${request.language}
${request.examples ? `Examples: ${request.examples}` : ''}
Return as JSON array: [{"hook":"...","bullets":["...","...","..."]}]`;

    this.totalTokensUsed += this.aiProvider.countTokens(prompt);
    const response = await this.aiProvider.generateText(prompt);
    this.totalTokensUsed += this.aiProvider.countTokens(response);

    try {
      return JSON.parse(this.extractJsonFromResponse(response));
    } catch {
      return this.createFallbackOutlines(request.postCount, request.topic);
    }
  }

  // Batch expand all outlines in one call
  private async batchExpandOutlines(outlines: PostOutline[], request: GenerationRequest): Promise<string[]> {
    const outlinesText = outlines.map((o, i) =>
      `Outline ${i + 1}:\nHook: ${o.hook}\nBullets: ${o.bullets.join(', ')}`
    ).join('\n\n');

    const prompt = `Expand each of the following LinkedIn post outlines into a full post.
${request.wordCount ? `Each post must be no more than ${request.wordCount} words.` : ''}
Language: ${request.language}
Tone: ${request.tone}
Audience: ${request.audience}
${request.examples ? `Examples: ${request.examples}` : ''}
Return as JSON array: ["post1", "post2", ...]
Outlines:
${outlinesText}`;

    this.totalTokensUsed += this.aiProvider.countTokens(prompt);
    const response = await this.aiProvider.generateText(prompt);
    this.totalTokensUsed += this.aiProvider.countTokens(response);

    try {
      return JSON.parse(this.extractJsonFromResponse(response));
    } catch {
      // fallback: return empty posts
      return outlines.map(() => '');
    }
  }

  // Batch hashtags for all posts in one call
  private async batchGenerateHashtags(posts: string[], request: GenerationRequest): Promise<string[][]> {
    const postsText = posts.map((p, i) => `Post ${i + 1}: ${(typeof p === 'string' ? p : '').substring(0, 100)}`).join('\n');
    const prompt = `For each LinkedIn post below, generate 3-8 relevant hashtags as a JSON array.
${request.hashtags ? `Preferred hashtags: ${request.hashtags}` : ''}
Posts:
${postsText}
Return as JSON array of arrays: [["#tag1",...], ["#tag2",...], ...]`;

    this.totalTokensUsed += this.aiProvider.countTokens(prompt);
    try {
      const response = await this.aiProvider.generateText(prompt);
      this.totalTokensUsed += this.aiProvider.countTokens(response);
      const hashtags = JSON.parse(this.extractJsonFromResponse(response));
      return Array.isArray(hashtags) ? hashtags : posts.map(() => []);
    } catch {
      return posts.map(() => []);
    }
  }

  private extractJsonFromResponse(response: string): string {
    const jsonMatch = response.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : response;
  }

  private createFallbackOutlines(count: number, topic: string): PostOutline[] {
    const outlines: PostOutline[] = [];
    for (let i = 0; i < count; i++) {
      outlines.push({
        hook: `Here's what I learned about ${topic}...`,
        bullets: [
          `Key insight about ${topic}`,
          `Practical application`,
          `Why this matters now`
        ]
      });
    }
    return outlines;
  }
}