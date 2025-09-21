import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StoryRequestSchema = z.object({
  productId: z.string(),
  audioData: z.string(), // Base64 encoded audio
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, audioData } = StoryRequestSchema.parse(body);

    // For now, we'll simulate transcription since we don't have a real Speech-to-Text service
    // In production, you'd use Google Cloud Speech-to-Text or similar
    const mockTranscript = "I created this beautiful hand-carved wooden bowl over the course of three weeks. I used reclaimed oak wood from an old barn and traditional Japanese carving techniques. The bowl represents the harmony between nature and craftsmanship, with each imperfection telling a story of the wood's journey. I wanted to create something that would bring warmth to any home and last for generations.";

    // Generate story using AI
    const storyGeneration = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: `Based on this artisan's spoken story about their craft, create a polished product description and a short marketing description.

Original transcript: "${mockTranscript}"

Please provide:
1. A compelling craft story (2-3 paragraphs) that captures the artisan's passion and process
2. A short description (1-2 sentences) for marketing purposes

Format as JSON with keys: craft_story, short_description`
    });

    const aiResponse = storyGeneration.output?.text;
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(aiResponse || '{}');
    } catch {
      // Fallback if JSON parsing fails
      parsedResponse = {
        craft_story: "This beautiful handmade piece was crafted with passion and attention to detail. Each item tells a unique story of traditional craftsmanship and artistic vision.",
        short_description: "A beautifully crafted handmade piece that combines traditional techniques with modern appeal."
      };
    }

    // In a real implementation, you'd save to Firestore here
    const aiAssetId = `ai_asset_${Date.now()}`;
    
    // Mock Firestore save (replace with actual Firestore operations)
    const aiAsset = {
      id: aiAssetId,
      type: 'story' as const,
      product_id: productId,
      generated_text: parsedResponse.craft_story,
      transcript: mockTranscript,
      is_edited_by_artisan: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      transcript: mockTranscript,
      craft_story_id: aiAssetId,
      craft_story: parsedResponse.craft_story,
      short_description: parsedResponse.short_description,
      ai_asset: aiAsset
    });

  } catch (error) {
    console.error('Story capture error:', error);
    return NextResponse.json(
      { error: 'Failed to process story' },
      { status: 500 }
    );
  }
}
