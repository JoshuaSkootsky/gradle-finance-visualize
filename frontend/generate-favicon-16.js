import sharp from 'sharp';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateFavicon16() {
  try {
    // Convert SVG to 16x16 PNG
    const svgBuffer = await readFile(join(__dirname, 'public', 'favicon.svg'));
    const pngBuffer = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
    await writeFile(join(__dirname, 'public', 'favicon-16x16.png'), pngBuffer);
    
    console.log('16x16 favicon generated successfully!');
  } catch (error) {
    console.error('Error generating 16x16 favicon:', error);
  }
}

generateFavicon16();