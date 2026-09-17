import {
  unstable_composeUploadHandlers,
  unstable_createFileUploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from '@remix-run/node';
import path from 'node:path';
import { randomUUID } from '~/utils/encryption';

const RECIPE_PHOTO_DIR = path.join(process.cwd(), 'public', 'recipe-photos');
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Parses the multipart recipe editor submission: a `photo` file field (optional) plus a
// `data` field holding the rest of the recipe as a JSON string.
export async function parseRecipeFormData(request: Request) {
  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      directory: RECIPE_PHOTO_DIR,
      file: ({ filename }) => `${randomUUID()}${path.extname(filename)}`,
      maxPartSize: MAX_PHOTO_SIZE,
      filter: ({ name, contentType }) => name === 'photo' && contentType.startsWith('image/'),
    }),
    unstable_createMemoryUploadHandler(),
  );

  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  const photo = formData.get('photo');
  const photoUrl =
    photo && typeof photo === 'object' && 'name' in photo && photo.name ? `/recipe-photos/${photo.name}` : null;

  const data = JSON.parse(formData.get('data') as string);
  return { data, photoUrl };
}
