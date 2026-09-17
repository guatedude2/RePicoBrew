import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from '~/utils/encryption';

const RECIPE_PHOTO_DIR = path.join(process.cwd(), 'public', 'recipe-photos');
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Parses the multipart recipe editor submission: a `photo` file field (optional) plus a
// `data` field holding the rest of the recipe as a JSON string.
//
// React Router v7 dropped Remix's unstable_* upload-handler APIs — the standard
// Request.formData() already parses multipart bodies into real File objects, so the file is
// just written to disk directly instead of going through a composed upload-handler pipeline.
export async function parseRecipeFormData(request: Request) {
  const formData = await request.formData();

  const photo = formData.get('photo');
  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0 && photo.type.startsWith('image/')) {
    if (photo.size > MAX_PHOTO_SIZE) {
      throw new Response('Photo too large', { status: 400 });
    }
    const filename = `${randomUUID()}${path.extname(photo.name)}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    await writeFile(path.join(RECIPE_PHOTO_DIR, filename), buffer);
    photoUrl = `/recipe-photos/${filename}`;
  }

  const data = JSON.parse(formData.get('data') as string);
  return { data, photoUrl };
}
