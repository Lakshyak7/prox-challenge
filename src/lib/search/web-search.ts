import type { SearchResult } from "@/lib/types";

export function isWebSearchAvailable(): boolean {
  return !!(process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY);
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return braveSearch(query);
  }
  if (process.env.TAVILY_API_KEY) {
    return tavilySearch(query);
  }
  throw new Error("No web search API key configured");
}

async function braveSearch(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
      },
    }
  );

  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data?.web?.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? "",
  }));
}

async function tavilySearch(query: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: "basic",
    }),
  });

  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data?.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    snippet: r.content ?? "",
  }));
}
