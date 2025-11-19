import puppeteer from "puppeteer";
import type { Document } from "@shared/schema";

/**
 * Converts TipTap JSON content to HTML
 */
function convertTipTapToHTML(content: string): string {
  try {
    const doc = typeof content === 'string' ? JSON.parse(content) : content;
    
    // Sanitize text to prevent XSS
    const sanitizeText = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Sanitize URL to prevent SSRF
    // WARNING: This filters literal private IPs but NOT hostnames that resolve to private IPs.
    // Hostnames like "metadata.internal" or "169.254.169.254.nip.io" can still bypass this check.
    // For production: implement DNS resolution checks or disable external images entirely.
    const sanitizeUrl = (url: string): string => {
      try {
        const parsed = new URL(url);
        
        // Only allow http(s) protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return '#';
        }
        
        const hostname = parsed.hostname.toLowerCase();
        
        // Block localhost and special hostnames
        if (
          hostname === 'localhost' ||
          hostname === '0.0.0.0' ||
          hostname.startsWith('localhost.') ||
          hostname.endsWith('.localhost')
        ) {
          return '#';
        }
        
        // Block internal IPv4 ranges
        const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const ipv4Match = hostname.match(ipv4Pattern);
        if (ipv4Match) {
          const octets = ipv4Match.slice(1, 5).map(Number);
          
          // Block if:
          // - 127.0.0.0/8 (loopback)
          // - 10.0.0.0/8 (private)
          // - 172.16.0.0/12 (private)
          // - 192.168.0.0/16 (private)
          // - 169.254.0.0/16 (link-local)
          // - 100.64.0.0/10 (carrier-grade NAT)
          if (
            octets[0] === 127 ||
            octets[0] === 10 ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168) ||
            (octets[0] === 169 && octets[1] === 254) ||
            (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
            octets[0] === 0 ||
            octets[0] >= 224 // multicast and reserved
          ) {
            return '#';
          }
        }
        
        // Block internal IPv6 ranges (simplified check)
        if (hostname.includes(':')) {
          // Block ::1 (localhost), fc00::/7 (unique local), fe80::/10 (link-local)
          if (
            hostname === '::1' ||
            hostname.startsWith('fc') ||
            hostname.startsWith('fd') ||
            hostname.startsWith('fe8') ||
            hostname.startsWith('fe9') ||
            hostname.startsWith('fea') ||
            hostname.startsWith('feb')
          ) {
            return '#';
          }
        }
        
        return url;
      } catch {
        return '#';
      }
    };

    const renderNode = (node: any): string => {
      if (node.type === 'text') {
        let text = sanitizeText(node.text || '');
        
        // Apply marks (bold, italic, underline, etc.)
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            switch (mark.type) {
              case 'bold':
                text = `<strong>${text}</strong>`;
                break;
              case 'italic':
                text = `<em>${text}</em>`;
                break;
              case 'underline':
                text = `<u>${text}</u>`;
                break;
              case 'strike':
                text = `<s>${text}</s>`;
                break;
              case 'code':
                text = `<code>${text}</code>`;
                break;
              case 'link':
                const href = sanitizeUrl(mark.attrs?.href || '#');
                text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                break;
              case 'textStyle':
                if (mark.attrs?.color) {
                  // Only allow hex colors
                  const color = mark.attrs.color;
                  if (/^#[0-9A-F]{6}$/i.test(color)) {
                    text = `<span style="color: ${color}">${text}</span>`;
                  }
                }
                break;
            }
          });
        }
        
        return text;
      }

      const content = node.content?.map(renderNode).join('') || '';

      switch (node.type) {
        case 'doc':
          return content;
        case 'paragraph':
          // Whitelist text-align values
          const allowedAlignments = ['left', 'center', 'right', 'justify'];
          const align = allowedAlignments.includes(node.attrs?.textAlign) ? node.attrs.textAlign : 'left';
          return `<p style="text-align: ${align};">${content || '<br>'}</p>`;
        case 'heading':
          // Clamp heading level to 1-6
          const level = Math.min(Math.max(parseInt(node.attrs?.level) || 1, 1), 6);
          return `<h${level}>${content}</h${level}>`;
        case 'bulletList':
          return `<ul>${content}</ul>`;
        case 'orderedList':
          return `<ol>${content}</ol>`;
        case 'listItem':
          return `<li>${content}</li>`;
        case 'taskList':
          return `<ul class="task-list">${content}</ul>`;
        case 'taskItem':
          // Only allow boolean checked attribute
          const checked = node.attrs?.checked === true ? 'checked' : '';
          return `<li class="task-item"><input type="checkbox" ${checked} disabled> ${content}</li>`;
        case 'codeBlock':
          // Sanitize language attribute (only alphanumeric, dash, underscore)
          const language = (node.attrs?.language || '').replace(/[^a-zA-Z0-9\-_]/g, '');
          return `<pre><code class="language-${language}">${content}</code></pre>`;
        case 'blockquote':
          return `<blockquote>${content}</blockquote>`;
        case 'horizontalRule':
          return '<hr>';
        case 'hardBreak':
          return '<br>';
        case 'image':
          const src = sanitizeUrl(node.attrs?.src || '');
          const alt = sanitizeText(node.attrs?.alt || '');
          const title = sanitizeText(node.attrs?.title || '');
          return `<img src="${src}" alt="${alt}" title="${title}" style="max-width: 100%; height: auto;">`;
        case 'table':
          return `<table>${content}</table>`;
        case 'tableRow':
          return `<tr>${content}</tr>`;
        case 'tableHeader':
          return `<th>${content}</th>`;
        case 'tableCell':
          return `<td>${content}</td>`;
        default:
          return content;
      }
    }

    return renderNode(doc);
  } catch (error) {
    console.error('Error converting TipTap to HTML:', error);
    return '<p>Error rendering content</p>';
  }
}

/**
 * Generates a PDF from document content using Puppeteer
 */
export async function generatePDF(document: Document): Promise<Buffer> {
  let browser;
  
  try {
    // Sanitize document name to prevent XSS
    const sanitizeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    const safeName = sanitizeHtml(document.name);
    
    // Convert TipTap JSON to HTML
    const htmlContent = convertTipTapToHTML(document.content);
    
    // Create full HTML document with styling
    const fullHTML = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeName}</title>
        <style>
          /* Use system fonts only - no external resources for security */
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #1a1a1a;
            padding: 40px;
            max-width: 210mm;
            margin: 0 auto;
          }
          
          h1, h2, h3, h4, h5, h6 {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            font-weight: 600;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: #000;
          }
          
          h1 { font-size: 24px; border-bottom: 2px solid #7C3AED; padding-bottom: 0.3em; }
          h2 { font-size: 20px; color: #7C3AED; }
          h3 { font-size: 16px; }
          h4 { font-size: 14px; }
          h5 { font-size: 13px; }
          h6 { font-size: 12px; }
          
          p {
            margin-bottom: 1em;
          }
          
          ul, ol {
            margin-left: 1.5em;
            margin-bottom: 1em;
          }
          
          li {
            margin-bottom: 0.3em;
          }
          
          ul.task-list {
            list-style: none;
            margin-left: 0;
          }
          
          li.task-item {
            display: flex;
            align-items: flex-start;
            gap: 0.5em;
          }
          
          li.task-item input[type="checkbox"] {
            margin-top: 0.3em;
          }
          
          blockquote {
            border-left: 4px solid #7C3AED;
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
            color: #555;
          }
          
          code {
            background: #f4f4f5;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          
          pre {
            background: #f4f4f5;
            padding: 1em;
            border-radius: 6px;
            overflow-x: auto;
            margin: 1em 0;
          }
          
          pre code {
            background: none;
            padding: 0;
          }
          
          hr {
            border: none;
            border-top: 1px solid #e5e5e5;
            margin: 2em 0;
          }
          
          a {
            color: #7C3AED;
            text-decoration: underline;
          }
          
          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em 0;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          
          th, td {
            border: 1px solid #e5e5e5;
            padding: 0.5em;
            text-align: left;
          }
          
          th {
            background: #f4f4f5;
            font-weight: 600;
          }
          
          strong {
            font-weight: 600;
          }
          
          /* Print-specific styling */
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <h1>${safeName}</h1>
        ${htmlContent}
      </body>
      </html>
    `;

    // Launch Puppeteer with specific args for Replit/NixOS environment
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/chromium',
    });

    const page = await browser.newPage();
    
    // Block all external resources to prevent SSRF
    // Only allow data URIs and inline content
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      // Only allow the initial document and data URIs
      if (request.isNavigationRequest() || url.startsWith('data:')) {
        request.continue();
      } else {
        // Block all external resources (images, fonts, stylesheets, etc.)
        request.abort('blockedbyclient');
      }
    });
    
    // Set content and wait for it to load
    await page.setContent(fullHTML, {
      waitUntil: 'domcontentloaded', // Don't wait for network resources
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    await browser.close();
    
    return pdfBuffer as Buffer;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}
