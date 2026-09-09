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
  const initialDataMatch = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!initialDataMatch?.[1]) {
    throw new Error("YouTube search data was not found in the response.");
  }

  let initialData: JsonValue;
  try {
    initialData = JSON.parse(initialDataMatch[1]) as JsonValue;
  } catch {
    throw new Error("YouTube search data could not be read.");
  }

  const renderers: Record<string, unknown>[] = [];
  findVideoRenderers(initialData, renderers);
  const seen = new Set<string>();

  return renderers
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
}

export async function scrapeYouTubeSearch(query: string): Promise<YouTubeSearchResult[]> {
  const url = `https://m.youtube.com/results?sp=mAEA&search_query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`YouTube returned HTTP ${response.status}.`);
  }

  return parseYouTubeSearchHtml(await response.text());
}
