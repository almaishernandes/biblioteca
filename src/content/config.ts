import { defineCollection, z } from 'astro:content';

const livros = defineCollection({
  type: 'content',
  schema: z.object({
    titulo: z.string(),
    subtitulo: z.string().optional(),
    autor: z.string(),
    categoria: z.string(),
    capa: z.string(),
    descricaoCurta: z.string(),
    dataPublicacao: z.date(),
  }),
});

export const collections = { livros };
