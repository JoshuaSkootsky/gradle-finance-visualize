import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

describe('Frontend Build Validation', () => {
  it('should generate required build artifacts', () => {
    // Check that the dist directory exists
    const distPath = 'dist';
    expect(existsSync(distPath)).toBe(true);
    
    // Check that index.html exists
    const indexPath = 'dist/index.html';
    expect(existsSync(indexPath)).toBe(true);
    
    // Check that assets directory exists
    const assetsPath = 'dist/assets';
    expect(existsSync(assetsPath)).toBe(true);
  });

  it('should have valid HTML structure in index.html', () => {
    const htmlContent = readFileSync('dist/index.html', 'utf-8');
    
    // Check for basic HTML structure
    expect(htmlContent).toContain('<!doctype html>');
    expect(htmlContent).toContain('<html');
    expect(htmlContent).toContain('<head>');
    expect(htmlContent).toContain('<body>');
    expect(htmlContent).toContain('</body>');
    expect(htmlContent).toContain('</html>');
    
    // Check for required meta tags
    expect(htmlContent).toContain('charset="UTF-8"');
    expect(htmlContent).toContain('viewport');
    
    // Check for title
    expect(htmlContent).toContain('<title>');
  });

  it('should have generated CSS and JS assets', () => {
    const htmlContent = readFileSync('dist/index.html', 'utf-8');
    
    // Check for CSS files
    expect(htmlContent).toContain('.css');
    
    // Check for JS files
    expect(htmlContent).toContain('.js');
  });

  it('should have favicon files', () => {
    // Check that favicon files exist
    expect(existsSync('dist/favicon.svg')).toBe(true);
    expect(existsSync('dist/favicon.png')).toBe(true);
    expect(existsSync('dist/favicon-16x16.png')).toBe(true);
  });

  it('should reference favicons in index.html', () => {
    const htmlContent = readFileSync('dist/index.html', 'utf-8');
    
    // Check for favicon references
    expect(htmlContent).toContain('favicon.svg');
    expect(htmlContent).toContain('favicon-16x16.png');
    expect(htmlContent).toContain('favicon.png');
  });
});