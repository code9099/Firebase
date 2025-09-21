'use server';

import { enhanceAndCartoonizeImage } from '@/ai/flows/enhance-and-cartoonize-image';
import { generateProductDetails } from '@/ai/flows/generate-product-details';
import { z } from 'zod';

const EnhanceImageSchema = z.object({
  productPhotoDataUri: z.string().startsWith('data:image/'),
});

export async function handleEnhanceImage(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = EnhanceImageSchema.safeParse(data);

  if (!parsed.success) {
    return { error: 'Invalid image data URI.' };
  }

  try {
    // TODO: Upload original image to Firebase Storage first
    const result = await enhanceAndCartoonizeImage({
      productPhotoDataUri: parsed.data.productPhotoDataUri,
    });
    // TODO: Upload enhanced/cartoon images to Firebase Storage
    return { success: true, enhancedImage: result.enhancedImage, cartoonImage: result.cartoonImage };
  } catch (e: any) {
    console.error('Image enhancement error:', e);
    
    // Check if it's a quota exceeded error
    if (e.message?.includes('quota') || e.message?.includes('429') || e.message?.includes('Too Many Requests')) {
      console.log('API quota exceeded, using fallback enhancement');
      return {
        success: true,
        enhancedImage: parsed.data.productPhotoDataUri, // Use original as "enhanced"
        cartoonImage: parsed.data.productPhotoDataUri, // Use original as "cartoon"
        fallback: true // Flag to indicate fallback was used
      };
    }
    
    return { error: 'Failed to enhance image.' };
  }
}

const GenerateDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  category: z.string().min(1, 'Category is required.'),
  dimensions: z.string().min(1, 'Dimensions are required.'),
  price: z.coerce.number().positive('Price must be a positive number.'),
  story: z.string().optional(),
});

export async function handleGenerateDetails(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = GenerateDetailsSchema.safeParse(data);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: 'Invalid input.', errors };
  }

  try {
    const result = await generateProductDetails(parsed.data);
    return { success: true, ...result };
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate details.' };
  }
}
