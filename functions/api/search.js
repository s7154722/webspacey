const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => {
      const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : parseInt(number, 10);
      try { return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; }
      catch { return ''; }
    });
}

function cleanText(markup) {
  return decodeHtmlEntities(String(markup || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' '))
    .trim();
}

function getRealUrl(href) {
  const decoded = decodeHtmlEntities(href).trim();
  let parsed;
  try { parsed = new URL(decoded, 'https://html.duckduckgo.com'); }
  catch { return null; }

  // DuckDuckGo wraps outbound URLs in /l/?uddg=... links.
  if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname === '/l/') {
    const target = parsed.searchParams.get('uddg');
    if (target) {
      try { parsed = new URL(target); }
      catch { return null; }
    }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return parsed.href;
}

function collectMatches(html, regex) {
  const values = [];
  for (const match of html.matchAll(regex)) values.push(match);
  return values;
}

function parseResults(html, limit = 10) {
  const titleMatches = collectMatches(html, /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])[^>]*?\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const snippetMatches = collectMatches(html, /<(?:a|div|td|span)[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td|span)>/gi);
  const results = [];
  const seen = new Set();

  for (let i = 0; i < titleMatches.length && results.length < limit; i++) {
    const match = titleMatches[i];
    const url = getRealUrl(match[1]);
    const title = cleanText(match[2]);
    if (!url || !title || seen.has(url)) continue;
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('duckduckgo.com')) continue;
    seen.add(url);
    results.push({
      title: title.slice(0, 240),
      url,
      snippet: cleanText(snippetMatches[i]?.[1] || '').slice(0, 600)
    });
  }
  return results;
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const query = (requestUrl.searchParams.get('q') || '').trim().replace(/\s+/g, ' ');
  if (!query) return json({ error: 'Enter something to search for.' }, 400);
  if (query.length > 250) return json({ error: 'Searches must be 250 characters or fewer.' }, 400);

  const searchUrl = new URL('https://html.duckduckgo.com/html/');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('kp', '1'); // Strict Safe Search
  searchUrl.searchParams.set('kl', 'au-en'); // Australia / English

  try {
    const upstream = await fetch(searchUrl.href, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-AU,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; NovaSearch/1.0; +https://developers.cloudflare.com/pages/)'
      },
      redirect: 'follow'
    });

    if (!upstream.ok) {
      return json({ error: 'The search provider is temporarily unavailable. Please try again shortly.' }, 502);
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('html')) {
      return json({ error: 'The search provider returned an unexpected response. Please try again later.' }, 502);
    }

    const html = await upstream.text();
    const results = parseResults(html, 10);
    return json({ query, results, provider: 'DuckDuckGo' });
  } catch {
    return json({ error: 'Could not reach the search provider. Check your connection and try again.' }, 502);
  }
}
