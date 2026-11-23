import { z } from 'zod';
export const passwordSchema=z.string().min(12,'Use at least 12 characters').max(72,'Use no more than 72 characters').refine(v=>Buffer.byteLength(v,'utf8')<=72,'Password must fit within 72 UTF-8 bytes');
