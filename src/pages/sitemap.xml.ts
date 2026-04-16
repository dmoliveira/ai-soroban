import { getCollection } from 'astro:content';

const staticPaths = [
  '',
  'about/',
  'assessments/',
  'daily-drills/',
  'exercises/',
  'lessons/',
  'levels/',
  'paths/adults/',
  'paths/children/',
  'practice/',
  'privacy/',
  'progress/',
  'releases/',
  'start-here/',
  'support/',
  'worksheets/',
];

export async function GET() {
  const base = 'https://dmoliveira.github.io/ai-soroban/';
  const lessons = await getCollection('lessons');
  const exercises = await getCollection('exercises');
  const lessonUrls = lessons.map((entry) => `${base}lessons/${entry.slug}/`);
  const exerciseUrls = exercises.map((entry) => `${base}exercises/${entry.slug}/`);
  const urls = [
    ...staticPaths.map((path) => `${base}${path}`),
    ...lessonUrls,
    ...exerciseUrls,
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
