'use client';

import { useState } from 'react';
import { Linkedin, Sparkles, Copy, Edit3, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PostResult {
  id: string;
  persona: string;
  planningOutline: {
    hook: string;
    bullets: string[];
    // cta: string;
  };
  finalText: string;
  suggestedHashtags: string[];
  tokensUsed: number;
  latency: number;
}

interface GenerationProgress {
  step: string;
  description: string;
  completed: boolean;
}

interface GeneratedPost {
  id: string;
  persona: string;
  planningOutline: {
    hook: string;
    bullets: string[];
  };
  finalText: string;
  suggestedHashtags: string[];
  tokensUsed: number;
  latency: number;
}

export default function Home() {
  const [formData, setFormData] = useState({
    topic: '',
    tone: '',
    audience: '',
    length: 'medium',
    postCount: 3,
    hashtags: '',
    // cta: '',
    examples: '',
    language: 'English',
    llmProvider: 'gemini'
  });

  const [results, setResults] = useState<PostResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress[]>([]);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [extractedPosts, setExtractedPosts] = useState<string[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null); // Tracks which post is regenerating
  const [regenerationError, setRegenerationError] = useState<string | null>(null);

  const toneOptions = [
    'Professional',
    'Casual',
    'Inspirational',
    'Educational',
    'Humorous',
    'Thought-provoking'
  ];

  const lengthOptions = [
    { value: 'short', label: 'Short (100-150 words)' },
    { value: 'medium', label: 'Medium (150-250 words)' },
    { value: 'long', label: 'Long (250-350 words)' }
  ];

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 
    'Portuguese', 'Dutch', 'Japanese', 'Chinese', 'Korean'
  ];

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setResults([]);
    setProgress([]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
        
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'progress') {
            setProgress(prev => [...prev, data.progress]);
          } else if (data.type === 'extracted_posts') {
            setExtractedPosts(data.posts);
          } else if (data.type === 'result') {
            setResults(data.results);
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate posts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy handler
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Edit handlers
  const handleEdit = (postId: string, currentText: string) => {
    setEditingPostId(postId);
    setEditedText(currentText);
  };

  const handleSaveEdit = (postId: string) => {
    setResults(results =>
      results.map(post =>
        post.id === postId ? { ...post, finalText: editedText } : post
      )
    );
    setEditingPostId(null);
    setEditedText('');
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditedText('');
  };

  // Regenerate handler
  const handleRegenerate = async (postId: string, index: number) => {
    if (isRegenerating) return;
    
    setIsRegenerating(postId);
    setRegenerationError(null);
    const startTime = Date.now();

    try {
      // Preserve all original request parameters
      const regenerateRequest = {
        ...formData,
        postCount: 1,
        // Preserve the original post's properties if needed
        outline: results[index]?.planningOutline,
        persona: results[index]?.persona,
      };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regenerateRequest),
      });

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let newPost: GeneratedPost | null = null;  // Add type annotation here

      // Handle streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'result' && data.results?.[0]) {
              newPost = data.results[0] as GeneratedPost;  // Add type assertion
            }
          } catch (parseError) {
            console.error('Error parsing stream chunk:', parseError);
          }
        }
      }

      if (!newPost) {
        throw new Error('No post generated');
      }

      // Carefully merge the new post with existing properties
      setResults(prevResults => 
        prevResults.map((post, idx) => 
          idx === index ? {
            ...post,
            ...newPost,
            id: post.id,
            persona: post.persona,
            planningOutline: post.planningOutline,
            latency: Date.now() - startTime // Now startTime is defined
          } : post
        )
      );

    } catch (error) {
      console.error('Regeneration error:', error);
      setRegenerationError(
        error instanceof Error ? error.message : 'Failed to regenerate post'
      );
    } finally {
      setIsRegenerating(null);
    }
  };

  // Toggle expanded posts
  const togglePostExpanded = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // Calculate total tokens and cost
  const totalTokens = results.reduce((sum, post) => sum + post.tokensUsed, 0);
  const llmModel = formData.llmProvider;
  let costPer1M = 0.3; // Example: $0.3 per 1M tokens for Gemini
  if (llmModel === 'openai') costPer1M = 0.3; // Example: $0.3 per 1M tokens for OpenAI
  const estimatedCost = ((totalTokens / 1000000) * costPer1M).toFixed(4);

  // Add this handler function
  const handleHashtagClick = (postId: string, hashtag: string) => {
    setResults(prevResults => 
      prevResults.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            // Add hashtag to end of post text
            finalText: `${post.finalText} ${hashtag}`,
            // Remove hashtag from suggestions
            suggestedHashtags: post.suggestedHashtags.filter(h => h !== hashtag)
          };
        }
        return post;
      })
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1729] via-[#151c3d] to-[#1a1c3d]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#4f46e5] animate-pulse-glow">
              <Linkedin className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">
              LinkedIn Post Generator
            </h1>
          </div>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Nugget internship application by Manan Bagga
          </p>
        </div>

        {/* Form */}
        <div className="mb-12">
          <Card className="backdrop-blur-glass border-[#2a2f42] bg-[#1a1f35]/80 hover:bg-[#1e2339]/80 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#e2e8f0]">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Content Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Topic */}
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-slate-200 font-medium">
                  Topic *
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g., Remote work productivity tips"
                  value={formData.topic}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* LLM Provider */}
              <div className="space-y-3">
                <Label className="text-slate-200 font-medium">AI Provider</Label>
                <RadioGroup
                  value={formData.llmProvider}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, llmProvider: value }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gemini" id="gemini" className="border-slate-600 text-cyan-400" />
                    <Label htmlFor="gemini" className="text-slate-200">Gemini (Free Tier)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="openai" id="openai" className="border-slate-600 text-pink-400" />
                    <Label htmlFor="openai" className="text-slate-200">OpenAI (Paid)</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label className="text-slate-200 font-medium">Tone</Label>
                <div className="space-y-2">
                  <Select value={formData.tone} onValueChange={(value) => setFormData(prev => ({ ...prev, tone: value }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {toneOptions.map(tone => (
                        <SelectItem key={tone} value={tone} className="text-slate-100 hover:bg-slate-700">
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Audience */}
              <div className="space-y-2">
                <Label htmlFor="audience" className="text-slate-200 font-medium">
                  Target Audience
                </Label>
                <Input
                  id="audience"
                  placeholder="e.g., Software developers, entrepreneurs"
                  value={formData.audience}
                  onChange={(e) => setFormData(prev => ({ ...prev, audience: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* Length */}
              <div className="space-y-2">
                <Label className="text-slate-200 font-medium">Post Length</Label>
                <Select value={formData.length} onValueChange={(value) => setFormData(prev => ({ ...prev, length: value }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {lengthOptions.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-slate-100 hover:bg-slate-700">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Post Count */}
              <div className="space-y-3">
                <Label className="text-slate-200 font-medium">
                  Number of Posts: {formData.postCount}
                </Label>
                <Slider
                  value={[formData.postCount]}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, postCount: value[0] }))}
                  min={3}
                  max={6}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-slate-400 text-sm">
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                </div>
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label htmlFor="hashtags" className="text-slate-200 font-medium">
                  Preferred Hashtags
                </Label>
                <Input
                  id="hashtags"
                  placeholder="e.g., #productivity, #remotework"
                  value={formData.hashtags}
                  onChange={(e) => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* CTA */}
              {/* <div className="space-y-2">
                <Label htmlFor="cta" className="text-slate-200 font-medium">
                  Call to Action
                </Label>
                <Input
                  id="cta"
                  placeholder="e.g., What's your experience with remote work?"
                  value={formData.cta}
                  onChange={(e) => setFormData(prev => ({ ...prev, cta: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-cyan-400 transition-colors"
                />
              </div> */}

              {/* Examples */}
              <div className="space-y-2">
                <Label htmlFor="examples" className="text-slate-200 font-medium">
                  Examples to Mimic
                </Label>
                <Textarea
                  id="examples"
                  placeholder="Paste example posts or describe the style you want to mimic"
                  value={formData.examples}
                  onChange={(e) => setFormData(prev => ({ ...prev, examples: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-cyan-400 transition-colors min-h-[80px]"
                />
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label className="text-slate-200 font-medium">Language</Label>
                <Select value={formData.language} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {languages.map(lang => (
                      <SelectItem key={lang} value={lang} className="text-slate-100 hover:bg-slate-700">
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <div className="md:col-span-2 lg:col-span-3">
                <Button
                  onClick={handleGenerate}
                disabled={isGenerating || !formData.topic.trim()}
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-semibold transition-all duration-300 disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate Posts
                  </div>
                )}
              </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress and Results */}
        <div className="space-y-8">
            {/* Progress */}
            {isGenerating && progress.length > 0 && (
              <Card className="backdrop-blur-glass border-slate-600 max-w-4xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-slate-100">Generation Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {progress.map((step, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${step.completed ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                        <div className={`${step.completed ? 'text-slate-100' : 'text-slate-400'}`}>
                          <div className="font-medium">{step.step}</div>
                          <div className="text-sm">{step.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extracted LinkedIn Posts */}
            {extractedPosts.length > 0 && (
              <Card className="backdrop-blur-glass border-slate-600 max-w-4xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-slate-100">Extracted LinkedIn Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {extractedPosts.map((post, index) => (
                      <div key={index} className="bg-slate-800 rounded-lg p-4 border border-slate-600">
                        <div className="text-cyan-400 font-medium mb-2">Post {index + 1}</div>
                        <div className="text-slate-300 text-sm whitespace-pre-wrap">
                          {post.length > 200 ? `${post.substring(0, 200)}...` : post}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-100 text-center">Generated Posts</h2>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {results.map((post, idx) => (
                    <Card key={post.id} className="backdrop-blur-glass border-slate-600 h-full flex flex-col">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-[#2a2f42] text-[#94b4f4]">
                            {post.persona}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4"> {/* Updated */}
                      <Collapsible>
                        <CollapsibleTrigger
                          onClick={() => togglePostExpanded(post.id)}
                          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
                        >
                          {expandedPosts.has(post.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          View Planning Outline
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="bg-[#1e2339] rounded-lg p-4 space-y-3">
                            <div>
                              <div className="text-[#94b4f4] font-medium mb-1">Hook:</div>
                              <div className="text-[#e2e8f0]">{post.planningOutline.hook}</div>
                            </div>
                            <div>
                              <div className="text-[#94b4f4] font-medium mb-1">Key Points:</div>
                              <ul className="text-slate-300 space-y-1">
                                {post.planningOutline.bullets.map((bullet, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-pink-400 mt-1">•</span>
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {/* <div>
                              <div className="text-cyan-400 font-medium mb-1">CTA:</div>
                              <div className="text-slate-300">{post.planningOutline.cta}</div>
                            </div> */}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator className="bg-[#2a2f42]" />

                      {/* Final Post */}
                      <div className="flex-1 flex flex-col"> {/* Updated */}
                        {editingPostId === post.id ? (
                          <div className="flex-1 flex flex-col"> {/* Container for edit mode */}
                            <textarea
                              className="w-full h-full flex-1 p-2 rounded bg-[#1e2339] border border-[#2a2f42] 
                                       text-[#e2e8f0] resize-none
                                       focus:border-[#94b4f4] focus:ring-1 focus:ring-[#94b4f4] 
                                       focus:outline-none"
                              value={editedText}
                              onChange={e => setEditedText(e.target.value)}
                              style={{
                                minHeight: '300px' // Match the preview mode height
                              }}
                            />
                            <div className="flex gap-2 mt-2">
                              {/* <button onClick={() => handleSaveEdit(post.id)} className="btn btn-primary">Save</button>
                              <button onClick={handleCancelEdit} className="btn btn-secondary">Cancel</button> */}
                              <Button variant="default" 
                                className="bg-[#94b4f4] hover:bg-[#7594d4] text-[#0f1729]" 
                                onClick={() => handleSaveEdit(post.id)}>
                                Save
                              </Button>
                              <Button variant="outline" 
                                className="border-[#2a2f42] text-[#94b4f4] hover:bg-[#2a2f42]"
                                onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 whitespace-pre-line mb-2 min-h-[300px] text-[#e2e8f0]">{post.finalText}</div>
                            <div className="flex gap-2 mt-2">
                              <Button variant="default"  onClick={() => copyToClipboard(post.finalText)} className="bg-[#94b4f4] hover:bg-[#7594d4] text-[#0f1729]">Copy</Button>
                              <Button variant="default"  onClick={() => handleEdit(post.id, post.finalText)} className="bg-[#94b4f4] hover:bg-[#7594d4] text-[#0f1729]">Edit</Button>
                              <Button variant="default"  onClick={() => handleRegenerate(post.id, idx)} className="bg-[#94b4f4] hover:bg-[#7594d4] text-[#0f1729]">
                                {isRegenerating === post.id ? (
                                  <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    Regenerating...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Regenerate
                                  </div>
                                )}
                              </Button>
                            </div>
                          </>
                        )}

                        {/* Hashtags */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.suggestedHashtags.map((hashtag, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              // className="border-slate-600 text-cyan-400 hover:bg-slate-700 cursor-pointer text-xs"
                              onClick={() => handleHashtagClick(post.id, hashtag)}
                              className="px-2 py-1 text-sm bg-slate-700 hover:bg-slate-600 
                                        text-slate-300 hover:text-slate-100 rounded-full 
                                        transition-colors"
                            >
                              {hashtag}
                            </Badge>
                          ))}
                        </div>

                        {regenerationError && (
                          <div className="text-red-400 text-sm mt-2">
                            Error: {regenerationError}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>
              </div>
            )}
        </div>

        {/* Summary Section */}
        {results.length > 0 && (
          <div className="mb-6 p-4 rounded bg-slate-800 text-slate-200 flex flex-col gap-2">
            <div><strong>Total tokens used:</strong> {totalTokens}</div>
            <div><strong>LLM model:</strong> {llmModel}</div>
            <div><strong>Estimated cost:</strong> ${estimatedCost}</div>
          </div>
        )}
      </div>
    </div>
  );
}