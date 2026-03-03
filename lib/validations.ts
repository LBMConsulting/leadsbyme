import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const searchSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(200),
  location: z.string().min(1, 'Location is required').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
