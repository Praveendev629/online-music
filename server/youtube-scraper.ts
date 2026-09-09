export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  description: string;
  publishedAt: string;
  duration: string;
  views: string;
};

type JsonValue = Record<string, unknown> | JsonValue[] | string | number | boolean | null;

function textFrom(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.simpleText === "string") return candidate.simpleText;
  if (Array.isArray(candidate.runs)) {
    return candidate.runs
      .map((run) => (run && typeof run === "object" && typeof (run as Record<string, unknown>).text === "string" ? (run as Record<string, string>).text : ""))
      .join("");
  }
  return "";
}

function findVideoRenderers(value: JsonValue, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => findVideoRenderers(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (record.videoRenderer && typeof record.videoRenderer === "object") {
    output.push(record.videoRenderer as Record<string, unknown>);
  }
  Object.values(record).forEach((child) => findVideoRenderers(child as JsonValue, output));
}

function thumbnailFrom(renderer: Record<string, unknown>) {
  const thumbnail = renderer.thumbnail as Record<string, unknown> | undefined;
  const thumbnails = thumbnail?.thumbnails;
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return "";
  const last = thumbnails[thumbnails.length - 1];
  return last && typeof last === "object" && typeof (last as Record<string, unknown>).url === "string"
    ? (last as Record<string, string>).url
    : "";
}

export function parseYouTubeSearchHtml(html: string): YouTubeSearchResult[] {
  // Look for ytInitialData in the HTML
  const initialDataMatch = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  
  if (!initialDataMatch?.[1]) {
    // YouTube may have returned a different format or an error page
    if (html.includes("consent.youtube.com") || html.includes("Please try again later")) {
      throw new Error("YouTube is requiring additional verification. Please try again later.");
    }
    if (html.length < 100) {
      throw new Error(`YouTube returned unexpected content: ${html.substring(0, 100)}`);
    }
    throw new Error("YouTube search data was not found in the response. YouTube may have changed its format or blocked the request.");
  }

  let initialData: JsonValue;
  try {
    initialData = JSON.parse(initialDataMatch[1]) as JsonValue;
  } catch (error) {
    const preview = initialDataMatch[1].substring(0, 100);
    throw new Error(`Failed to parse YouTube data: ${error instanceof Error ? error.message : "Unknown error"}. Preview: ${preview}`);
  }

  const renderers: Record<string, unknown>[] = [];
  findVideoRenderers(initialData, renderers);
  const seen = new Set<string>();

  const results = renderers
    .map((renderer) => {
      const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
      const title = textFrom(renderer.title);
      const channelTitle = textFrom(renderer.ownerText) || textFrom(renderer.shortBylineText);
      const detailedSnippet = Array.isArray(renderer.detailedMetadataSnippets)
        ? renderer.detailedMetadataSnippets.map((snippet) => textFrom(snippet)).join(" ")
        : "";
      const snippet = textFrom(renderer.descriptionSnippet);
      const publishedAt = textFrom(renderer.publishedTimeText);
      const duration = textFrom(renderer.lengthText);
      const views = textFrom(renderer.viewCountText);
      return {
        videoId,
        title,
        channelTitle,
        thumbnail: thumbnailFrom(renderer),
        description: detailedSnippet || snippet,
        publishedAt,
        duration,
        views,
      } satisfies YouTubeSearchResult;
    })
    .filter((result) => {
      if (!result.videoId || !result.title || seen.has(result.videoId)) return false;
      seen.add(result.videoId);
      return true;
    })
    .slice(0, 18);

  if (results.length === 0) {
    throw new Error("No video results found. YouTube may have returned search results in a different format.");
  }

  return results;
}

export async function scrapeYouTubeSearch(query: string): Promise<YouTubeSearchResult[]> {
  const url = `https://m.youtube.com/results?sp=mAEA&search_query=${encodeURIComponent(query)}`;
  
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("YouTube search timed out. Please try again.");
    }
    throw new Error(`Failed to reach YouTube: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  if (!response.ok) {
    const statusMessage = `HTTP ${response.status}`;
    if (response.status === 403) {
      throw new Error("YouTube blocked the request. Please try again later.");
    }
    if (response.status === 429) {
      throw new Error("Too many requests to YouTube. Please wait a moment and try again.");
    }
    throw new Error(`YouTube returned ${statusMessage}.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.includes("text/html")) {
    throw new Error(`Unexpected response format from YouTube: ${contentType}`);
  }

  let html: string;
  try {
    html = await response.text();
  } catch (error) {
    throw new Error(`Failed to read YouTube response: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  if (!html || html.trim().length === 0) {
    throw new Error("YouTube returned an empty response.");
  }

  try {
    return parseYouTubeSearchHtml(html);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse YouTube search results.");
  }
}
