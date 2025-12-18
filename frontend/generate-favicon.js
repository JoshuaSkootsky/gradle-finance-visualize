import sharp from 'sharp';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateFavicon() {
  try {
    // Convert SVG to PNG
    const svgBuffer = await readFile(join(__dirname, 'public', 'favicon.svg'));
    const pngBuffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
    await writeFile(join(__dirname, 'public', 'favicon.png'), pngBuffer);
    
    console.log('Favicon generated successfully!');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }
}

generateFavicon();